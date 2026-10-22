// M-Core push-send — request handler with injected I/O (index.ts wires Supabase, Web Push and Telegram; tests use fakes).
import { ch, classify, myt, payload, quiet, roleAllows, Row, same, settingsFor, summary, tx } from './core.ts';
import { escalate, morning, sla } from './jobs.ts';

export interface Repo {
  notifications(ids: string[]): Promise<Row[]>;
  recentNotifications(sinceIso: string, limit: number): Promise<Row[]>;
  loggedKeys(keys: string[]): Promise<string[]>;
  claim(row: Row): Promise<boolean>;
  updateLog(key: string, patch: Row): Promise<void>;
  addLog(row: Row): Promise<void>;
  profile(uid: string): Promise<Row | null>;
  settings(tid: string, uid: string): Promise<Row | null>;
  tenantSettings(tid: string): Promise<Row | null>;
  subs(tid: string, uid: string): Promise<Row[]>;
  hadSub(tid: string, uid: string): Promise<boolean>;
  touchSub(id: string, patch: Row): Promise<void>;
  telegramChat(tid: string, uid: string): Promise<string | null>;
  recentPushed(uid: string, sinceIso: string, exceptId: string): Promise<Row[]>;
  sr(id: string): Promise<Row | null>;
  openSrs(): Promise<Row[]>;
  urgentUnpicked(sinceIso: string): Promise<Row[]>;
  paUsers(): Promise<Row[]>;
  insertNotification(row: Row): Promise<Row | null>;
  unreadCount(tid: string, uid: string): Promise<number>;
  allActiveSubs(): Promise<Row[]>;
  markRead(id: string, uid: string): Promise<void>;
  cleanupSubs(beforeIso: string): Promise<number>;
  tenantName(tid: string): Promise<string>;
}
export interface Deps {
  now(): Date;
  db: Repo;
  push(sub: Row, body: Row, prio: number): Promise<number>;
  telegram(chatId: string, text: string): Promise<boolean>;
  sign(nid: string, uid: string): Promise<string>;
  authUser(jwt: string): Promise<string | null>;
  secret: string;
  fnUrl: string;
}
export const iso = (d: Date) => d.toISOString();
export const ago = (now: Date, ms: number) => new Date(now.getTime() - ms);

/** Deliver one notification row to its recipient (idempotent via push_log.dedupe_key 'n:<id>'). */
export async function processOne(n: Row, d: Deps): Promise<string> {
  const db = d.db, now = d.now(), key = 'n:' + n.id;
  if (!n || !n.id || !n.user_id) return 'bad';
  const info = classify(n);
  if (info.kind === 'activity') return 'activity'; /* never phone; no log row */
  if (!(await db.claim({ dedupe_key: key, tenant_id: n.tenant_id, user_id: n.user_id, notification_id: n.id, channel: 'push', status: 'pending' }))) return 'dup';
  const done = async (status: string, reason: string | null, channel = 'push') => { await db.updateLog(key, { status, reason, channel }); return status + (reason ? ':' + reason : ''); };
  if (n.deleted_at || n.read_at) return done('skipped', 'read');
  const prof = await db.profile(n.user_id);
  if (!prof || !n.tenant_id || !same(prof.tenant_id, n.tenant_id)) return done('skipped', 'tenant');
  if (n.ref_table === 'service_requests' && n.ref_id) { const sr = await db.sr(String(n.ref_id)); if (sr && sr.priority === 'urgent') info.prio = 2; }
  const s = settingsFor(prof.role, (await db.settings(n.tenant_id, n.user_id))?.settings);
  if (!ch(s, info.cat, 'p')) return done('skipped', 'channel_off');
  if (!roleAllows((await db.tenantSettings(n.tenant_id))?.settings, prof.role, info.cat)) return done('skipped', 'role');
  if (quiet(s, info.prio, now)) return done('skipped', 'quiet');
  const tgFallback = async (why: string) => {
    if (ch(s, info.cat, 't')) return done('skipped', why + ':telegram_on');
    if (why === 'no_sub' && !(await db.hadSub(n.tenant_id, n.user_id))) return done('skipped', 'no_sub');
    const chat = await db.telegramChat(n.tenant_id, n.user_id);
    if (!chat) return done(why === 'no_sub' ? 'skipped' : 'failed', why);
    const ok = await d.telegram(chat, 'M-Core · ' + n.title + (n.body ? '\n' + n.body : ''));
    return done(ok ? 'sent' : 'failed', why, 'telegram');
  };
  const subs = await db.subs(n.tenant_id, n.user_id);
  if (!subs.length) return tgFallback('no_sub');
  const recent = await db.recentPushed(n.user_id, iso(ago(now, 120000)), n.id), group = recent.length > 0;
  const rt = await d.sign(n.id, n.user_id);
  let ok = 0, gone = 0;
  for (const sub of subs) {
    const lang = sub.lang || 'en';
    const body = group ? Object.assign(summary([n].concat(recent), lang, n.user_id), { nid: n.id, replaces: recent.map((x) => 'mcore-n-' + x.id), fn: d.fnUrl, rt })
      : payload(n, info, lang, { fn: d.fnUrl, rt });
    let code = 0; try { code = await d.push(sub, body, info.prio); } catch (_e) { code = 0; }
    if (code >= 200 && code < 300) { ok++; await db.touchSub(sub.id, { last_ok_at: iso(now), fail_count: 0 }); }
    else if (code === 404 || code === 410) { gone++; await db.touchSub(sub.id, { deleted_at: iso(now) }); }
    else await db.touchSub(sub.id, { fail_count: (sub.fail_count || 0) + 1 });
  }
  if (!ok) return tgFallback(gone === subs.length ? 'gone' : 'push_failed');
  return done(group ? 'grouped' : 'sent', group ? 'n=' + (recent.length + 1) : null);
}

/* tolerant compare: Vault/dashboard pastes often carry a trailing newline, spaces or wrapping quotes */
export function cleanSecret(v: string | null | undefined): string { return String(v || '').trim().replace(/^(['"])(.*)\1$/, '$2').trim(); }
export function secretOk(hdr: string | null | undefined, env: string | null | undefined): boolean { const a = cleanSecret(hdr), b = cleanSecret(env); return !!b && a === b; }
export async function flush(d: Deps, minutes = 10): Promise<Row> {
  const rows = await d.db.recentNotifications(iso(ago(d.now(), minutes * 60000)), 100);
  const have = new Set(await d.db.loggedKeys(rows.map((r) => 'n:' + r.id)));
  const out: Row = {};
  for (const r of rows) { if (have.has('n:' + r.id)) continue; const k = (await processOne(r, d)).split(':')[0]; out[k] = (out[k] || 0) + 1; }
  return out;
}

export async function testSend(uid: string, subId: string | null, d: Deps): Promise<Row> {
  const prof = await d.db.profile(uid); if (!prof) return { ok: false, error: 'profile' };
  let subs = await d.db.subs(prof.tenant_id, uid); if (subId) subs = subs.filter((s) => same(s.id, subId));
  const r: Row = { ok: true, subs: subs.length, sent: 0, failed: 0, gone: 0 }, now = d.now();
  for (const sub of subs) {
    const lang = sub.lang || 'en';
    const body = { title: 'M-Core · ' + tx(lang, 'test'), body: tx(lang, 'testB'), tag: 'mcore-test-' + sub.id, url: '/app/?page=notifikasi', prio: 1, vibrate: [200, 100, 200], actions: [{ action: 'open', title: tx(lang, 'open') }] };
    let code = 0; try { code = await d.push(sub, body, 1); } catch (_e) { code = 0; }
    if (code >= 200 && code < 300) { r.sent++; await d.db.touchSub(sub.id, { last_ok_at: iso(now), fail_count: 0 }); }
    else if (code === 404 || code === 410) { r.gone++; await d.db.touchSub(sub.id, { deleted_at: iso(now) }); }
    else { r.failed++; await d.db.touchSub(sub.id, { fail_count: (sub.fail_count || 0) + 1 }); }
    await d.db.addLog({ tenant_id: prof.tenant_id, user_id: uid, subscription_id: sub.id, channel: 'push', status: 'test', reason: 'code=' + code });
  }
  return r;
}

export async function handle(body: Row, headers: Headers, d: Deps): Promise<{ status: number; body: Row }> {
  const trusted = secretOk(headers.get('x-push-secret'), d.secret);
  if (body && body.type === 'INSERT' && body.table === 'notifications' && body.record) {
    if (!trusted) return { status: 401, body: { ok: false, error: 'secret' } };
    const rows = await d.db.notifications([String(body.record.id)]);
    return { status: 200, body: { ok: true, r: rows[0] ? await processOne(rows[0], d) : 'missing' } };
  }
  const a = String((body && body.action) || '');
  if (a === 'tick') {
    if (!trusted) return { status: 401, body: { ok: false, error: 'secret' } };
    const out: Row = { ok: true, flush: await flush(d, 15), sla: await sla(d), esc: await escalate(d), morning: await morning(d) };
    if (myt(d.now()).hm.slice(3) === '17') out.cleaned = await d.db.cleanupSubs(iso(ago(d.now(), 120 * 864e5)));
    return { status: 200, body: out };
  }
  if (a === 'read') {
    const id = String(body.id || ''), uid = String(body.uid || '');
    if (!id || !uid || !body.t || body.t !== (await d.sign(id, uid))) return { status: 401, body: { ok: false, error: 'token' } };
    await d.db.markRead(id, uid); return { status: 200, body: { ok: true } };
  }
  const jwt = (headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const uid = jwt ? await d.authUser(jwt) : null;
  if (!uid) return { status: 401, body: { ok: false, error: 'auth' } };
  if (a === 'flush') return { status: 200, body: { ok: true, r: await flush(d, 10) } };
  if (a === 'test') return { status: 200, body: await testSend(uid, body.sub_id ? String(body.sub_id) : null, d) };
  return { status: 400, body: { ok: false, error: 'action' } };
}
