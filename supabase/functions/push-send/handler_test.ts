// deno test supabase/functions/push-send/handler_test.ts  (pure, no network)
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { classify, quiet, settingsFor, slaDue } from './core.ts';
import { Deps, handle, processOne, Repo } from './handler.ts';
type Row = Record<string, any>;
const T = 'ten-1', U = 'usr-1', PA = 'pa-1', TP = 'ten-pa';
function world(over: Row = {}) {
  const W: Row = { n: [], log: [], subs: [{ id: 's1', tenant_id: T, user_id: U, endpoint: 'e1', lang: 'bm', fail_count: 0 }], prof: { [U]: { id: U, tenant_id: T, role: 'staff' }, [PA]: { id: PA, tenant_id: TP, role: 'platform_admin' } },
    settings: {}, ts: {}, tg: {}, sr: {}, pushed: [], tgSent: [], codes: [], read: [], inserted: [], unread: 3, had: {}, ...over };
  const db: Repo = {
    notifications: async (ids) => W.n.filter((x: Row) => ids.includes(x.id)),
    recentNotifications: async () => W.n.slice(),
    loggedKeys: async (keys) => W.log.map((l: Row) => l.dedupe_key).filter((k: string) => keys.includes(k)),
    claim: async (row) => { if (row.dedupe_key && W.log.some((l: Row) => l.dedupe_key === row.dedupe_key)) return false; W.log.push({ ...row, created_at: W.now.toISOString() }); return true; },
    updateLog: async (k, p) => { Object.assign(W.log.find((l: Row) => l.dedupe_key === k), p); },
    addLog: async (row) => { W.log.push(row); },
    profile: async (u) => W.prof[u] || null,
    settings: async (t, u) => W.settings[u] ? { settings: W.settings[u] } : null,
    tenantSettings: async (t) => W.ts[t] ? { settings: W.ts[t] } : null,
    subs: async (t, u) => W.subs.filter((s: Row) => s.tenant_id === t && s.user_id === u && !s.deleted_at),
    hadSub: async (t, u) => !!W.had[u] || W.subs.some((s: Row) => s.user_id === u),
    touchSub: async (id, p) => { Object.assign(W.subs.find((s: Row) => s.id === id), p); },
    telegramChat: async (t, u) => W.tg[u] || null,
    recentPushed: async (u, since, ex) => W.log.filter((l: Row) => l.user_id === u && l.channel === 'push' && ['sent', 'grouped'].includes(l.status) && l.notification_id && l.notification_id !== ex && l.created_at >= since).map((l: Row) => W.n.find((x: Row) => x.id === l.notification_id)).filter(Boolean),
    sr: async (id) => W.sr[id] || null,
    openSrs: async () => Object.values(W.sr),
    urgentUnpicked: async () => Object.values(W.sr).filter((r: any) => r.priority === 'urgent' && r.status === 'submitted' && !r.assigned_to) as Row[],
    paUsers: async () => [W.prof[PA]],
    insertNotification: async (row) => { const n = { id: 'ins-' + W.inserted.length, ...row }; W.inserted.push(n); W.n.push(n); return n; },
    unreadCount: async () => W.unread,
    allActiveSubs: async () => W.subs.filter((s: Row) => !s.deleted_at),
    markRead: async (id, u) => { W.read.push(id + ':' + u); },
    cleanupSubs: async () => 0,
    tenantName: async () => 'Phion Sdn. Bhd.',
  };
  W.now = new Date('2026-10-22T06:00:00Z'); // 14:00 MYT Thu
  const d: Deps = { now: () => W.now, db, push: async (s, b) => { W.pushed.push({ s: s.id, b }); return W.codes.length ? W.codes.shift() : 201; }, telegram: async (c, t) => { W.tgSent.push(c + '|' + t); return true; },
    sign: async (n, u) => 'sig-' + n + '-' + u, authUser: async (j) => j === 'good' ? U : null, secret: 'S3', fnUrl: 'https://x/functions/v1/push-send' };
  return { W, d };
}
const N = (id: string, x: Row = {}) => ({ id, tenant_id: T, user_id: U, title: 'SR-202610-0025: Delivered', body: 'Offer letter', category: 'service_desk', kind: 'for_you', priority: 0, created_at: '2026-10-22T05:59:00Z', ...x });

Deno.test('classify + defaults + quiet (MYT, high priority bypass)', () => {
  assertEquals(classify({ category: 'service_desk', title: 'x' }).cat, 'sd');
  assertEquals(classify({ category: 'sales', title: 'x' }).kind, 'activity');
  assertEquals(classify({ category: 'service_desk', title: 'Pindaan diminta' }).prio, 1);
  const s = settingsFor('staff', { q: { on: 1, from: '22:00', to: '07:00', days: [1, 2, 3, 4, 5], hi: 1 } });
  const late = new Date('2026-10-22T15:30:00Z'); // 23:30 MYT Thu
  assert(quiet(s, 0, late)); assert(!quiet(s, 1, late)); assert(!quiet(s, 0, new Date('2026-10-22T06:00:00Z')));
  assert(quiet(s, 0, new Date('2026-10-23T22:30:00Z')), 'Sat 06:30 MYT continues Fri night window');
  assert(!quiet(s, 0, new Date('2026-10-24T15:30:00Z')), 'Sat 23:30 MYT: Sat not in days');
  assertEquals(settingsFor('owner').m.approval.t, 1); assertEquals(settingsFor('staff').m.approval.t, 0);
});
Deno.test('sent once, dedupe, payload with actions + signed read token', async () => {
  const { W, d } = world(); const n = N('n1'); W.n.push(n);
  assertEquals(await processOne(n, d), 'sent'); assertEquals(await processOne(n, d), 'dup');
  const b = W.pushed[0].b; assertEquals(b.tag, 'mcore-n-n1'); assertEquals(b.url, '/app/?nt=n1'); assertEquals(b.actions[0].title, 'Buka SR'); assertEquals(b.rt, 'sig-n1-usr-1'); assertEquals(b.requireInteraction, false);
});
Deno.test('urgent SR -> prio 2 stays until tapped', async () => {
  const { W, d } = world({ sr: { sr1: { id: 'sr1', priority: 'urgent' } } }); const n = N('n2', { ref_table: 'service_requests', ref_id: 'sr1' });
  await processOne(n, d); assertEquals(W.pushed[0].b.requireInteraction, true); assertEquals(W.pushed[0].b.prio, 2);
});
Deno.test('channel off / role routing / quiet / tenant mismatch / activity', async () => {
  let { W, d } = world({ settings: { [U]: { m: { sd: { p: 0 } } } } }); assertEquals(await processOne(N('a'), d), 'skipped:channel_off');
  ({ W, d } = world({ ts: { [T]: { roles: { staff: ['approval'] } } } })); assertEquals(await processOne(N('b'), d), 'skipped:role');
  ({ W, d } = world({ ts: { [T]: { roles: { finance: ['approval'] } } } })); assertEquals(await processOne(N('b2'), d), 'sent');
  ({ W, d } = world({ settings: { [U]: { q: { on: 1, from: '13:00', to: '15:00', days: [], hi: 1 } } } })); assertEquals(await processOne(N('c'), d), 'skipped:quiet');
  assertEquals(await processOne(N('c2', { priority: 1 }), d), 'sent');
  ({ W, d } = world()); assertEquals(await processOne(N('d', { tenant_id: 'other' }), d), 'skipped:tenant');
  assertEquals(await processOne(N('e', { category: 'sales', kind: null }), d), 'activity'); assertEquals(W.log.length, 1);
});
Deno.test('410 -> soft delete + Telegram fallback; no_sub without opt-in stays quiet', async () => {
  let { W, d } = world({ tg: { [U]: 'chat9' }, codes: [410] });
  assertEquals(await processOne(N('f'), d), 'sent:gone'); assert(W.subs[0].deleted_at); assertEquals(W.tgSent.length, 1); assertEquals(W.log[0].channel, 'telegram');
  ({ W, d } = world({ subs: [], tg: { [U]: 'chat9' } })); assertEquals(await processOne(N('g'), d), 'skipped:no_sub'); assertEquals(W.tgSent.length, 0);
  ({ W, d } = world({ subs: [], tg: { [U]: 'chat9' }, had: { [U]: 1 } })); assertEquals(await processOne(N('h'), d), 'sent:no_sub');
  ({ W, d } = world({ subs: [], tg: { [U]: 'chat9' }, had: { [U]: 1 }, settings: { [U]: { m: { sd: { t: 1 } } } } })); assertEquals(await processOne(N('i'), d), 'skipped:no_sub:telegram_on');
  ({ W, d } = world({ codes: [500] })); assertEquals(await processOne(N('j'), d), 'failed:push_failed'); assertEquals(W.subs[0].fail_count, 1);
});
Deno.test('grouping within 2 min -> one summary replacing earlier tags', async () => {
  const { W, d } = world(); const a = N('g1'), b = N('g2', { title: 'SR-202610-0025: new message' }); W.n.push(a, b);
  assertEquals(await processOne(a, d), 'sent'); W.now = new Date(W.now.getTime() + 60000);
  assertEquals(await processOne(b, d), 'grouped:n=2'); const s = W.pushed[1].b;
  assertEquals(s.tag, 'mcore-sum-usr-1'); assert(s.title.includes('2 amaran baharu')); assertEquals(s.replaces, ['mcore-n-g1']);
  W.now = new Date(W.now.getTime() + 180000); const c = N('g3'); W.n.push(c); assertEquals(await processOne(c, d), 'sent');
});
Deno.test('handle: auth, webhook secret, read token, flush, test', async () => {
  const { W, d } = world(); W.n.push(N('w1'), N('w2'));
  assertEquals((await handle({ action: 'flush' }, new Headers(), d)).status, 401);
  assertEquals((await handle({ type: 'INSERT', table: 'notifications', record: { id: 'w1' } }, new Headers(), d)).status, 401);
  assertEquals((await handle({ type: 'INSERT', table: 'notifications', record: { id: 'w1' } }, new Headers({ 'x-push-secret': 'S3' }), d)).body.r, 'sent');
  const f = await handle({ action: 'flush' }, new Headers({ authorization: 'Bearer good' }), d); assertEquals(f.body.r.grouped, 1);
  assertEquals((await handle({ action: 'read', id: 'w1', uid: U, t: 'bad' }, new Headers(), d)).status, 401);
  assertEquals((await handle({ action: 'read', id: 'w1', uid: U, t: 'sig-w1-usr-1' }, new Headers(), d)).status, 200); assertEquals(W.read, ['w1:usr-1']);
  const t = await handle({ action: 'test' }, new Headers({ authorization: 'Bearer good' }), d); assertEquals(t.body.sent, 1); assertEquals(W.log.at(-1).status, 'test');
  assertEquals((await handle({ action: 'tick' }, new Headers({ 'x-push-secret': 'no' }), d)).status, 401);
});
Deno.test('tick: SLA 2h + overdue (once), escalation after 30 min (0 = off), morning summary once at 08:00 MYT', async () => {
  const sr = { id: 'sr9', tenant_id: 'cli', ref_no: 'SR-202610-0031', title: 'Letter', status: 'in_progress', priority: 'normal', assigned_to: U, due_at: '2026-10-22T07:30:00Z' };
  const u = { id: 'sr8', tenant_id: 'cli', ref_no: 'SR-202610-0032', title: 'Urgent fix', status: 'submitted', priority: 'urgent', assigned_to: null, created_at: '2026-10-22T05:20:00Z' };
  const { W, d } = world({ sr: { sr9: sr, sr8: u }, tg: { [PA]: 'chatPA' } });
  assertEquals(slaDue(sr, W.now)!.toISOString(), '2026-10-22T07:30:00.000Z');
  let r = await handle({ action: 'tick' }, new Headers({ 'x-push-secret': 'S3' }), d);
  assertEquals(r.body.sla, 1); assertEquals(W.inserted[0].title, 'SR-202610-0031: SLA tamat dalam 2j'); assertEquals(W.inserted[0].priority, 1); assertEquals(r.body.esc, 1); assert(W.tgSent[0].startsWith('chatPA|M-Core · SR-202610-0032'));
  r = await handle({ action: 'tick' }, new Headers({ 'x-push-secret': 'S3' }), d); assertEquals(r.body.sla, 0); assertEquals(r.body.esc, 0);
  W.now = new Date('2026-10-22T07:31:00Z'); r = await handle({ action: 'tick' }, new Headers({ 'x-push-secret': 'S3' }), d); assertEquals(r.body.sla, 1); assertEquals(W.inserted[1].priority, 2);
  const w2 = world({ sr: { sr8: u }, tg: { [PA]: 'c' }, ts: { [TP]: { escalate_min: 0 } } }); assertEquals((await handle({ action: 'tick' }, new Headers({ 'x-push-secret': 'S3' }), w2.d)).body.esc, 0);
  const w3 = world(); w3.W.now = new Date('2026-10-23T00:05:00Z'); // 08:05 MYT
  assertEquals((await handle({ action: 'tick' }, new Headers({ 'x-push-secret': 'S3' }), w3.d)).body.morning, 1); assert(w3.W.pushed.at(-1).b.body.startsWith('3 amaran'));
  assertEquals((await handle({ action: 'tick' }, new Headers({ 'x-push-secret': 'S3' }), w3.d)).body.morning, 0);
  w3.W.now = new Date('2026-10-23T02:05:00Z'); const w4 = world(); w4.W.now = new Date('2026-10-23T02:05:00Z'); assertEquals((await handle({ action: 'tick' }, new Headers({ 'x-push-secret': 'S3' }), w4.d)).body.morning, 0);
});
