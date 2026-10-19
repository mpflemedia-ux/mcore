// M-Core Edge Function: sd-result - public client result page for Service Desk (?sr_result=TOKEN).
// Deploy: supabase functions deploy sd-result --no-verify-jwt   (public page has no user JWT; access = token only)
// Secrets: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are injected by Supabase automatically. Nothing else needed.
//
// NOTE: this is a single-file merge of index.ts + handler.ts (handler.ts's content inlined below,
// no import) made ONLY so this can be pasted into ONE file in the Supabase dashboard editor without
// needing a second "Add File" step. The source of truth / the file the repo and tests use is still
// the separate index.ts + handler.ts in supabase/functions/sd-result/ - this merged version is for
// this one manual deploy only.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ---- inlined from handler.ts ----
// M-Core Service Desk - client result link logic (pure; the DB is injected so it can be unit-tested without Supabase).
// Token flow: WhatsApp message carries ?sr_result=TOKEN -> page POSTs { token, action } here -> we look up sha256(token)
// in service_result_links (never the raw token), check revoked / expired / deleted, then:
//   view       -> request summary + 10-min signed URLs for deliverables (only if the client's contract is paid) + log view
//   upload_url -> signed Storage upload slot for a client-submitted attachment on confirm/revise (type/size checked here)
//   confirm    -> delivered -> closed   (+ status event + response row + optional attachment events + bell to platform admins)
//   revise     -> delivered -> revision (comment 3..2000 chars required; same optional attachments as confirm)
//   reopen     -> closed -> in_progress (reason 3..2000 required; needs sd_reopen_01.sql: reopen_count/reopened_at). SLA restarts:
//                 due_at = now + same business-hour window (created_at -> old due_at); paused/delivered/closed cleared. Bells admins + owner.
type Link = { id: string; tenant_id: string; request_id: string; expires_at: string; revoked_at: string | null; deleted_at: string | null; viewed_at: string | null; view_count: number };
type Req = { id: string; tenant_id: string; contract_id: string | null; ref_no: string; title: string; service_code: string; status: string; created_at: string; due_at: string | null; delivered_at: string | null; closed_at: string | null; sla_paused_seconds: number | null; deleted_at: string | null; reopen_count?: number | null; reopened_at?: string | null };
// optional enrichment so bellAdmins/bellOwners can mirror app/notif-core.js's NT.notify() row shape
// (type/ref_table/ref_id/group_key) for bell grouping + Telegram fan-out; category/link routing for
// service_desk notifications stays on the existing "SR-xxxxxx-n" regex in notif-items.js's link() -
// deliberately NOT overridden here to avoid touching that already-working routing.
type NotifyMeta = { type: string; refTable?: string; refId?: string; groupKey?: string };
interface Db {
  linkByHash(hash: string): Promise<Link | null>;
  request(id: string): Promise<Req | null>;
  tenantName(id: string): Promise<string>;
  service(code: string): Promise<{ name_en: string; name_bm: string; default_sla_hours: number | null } | null>;
  contractPaid(tenantId: string, contractId: string | null): Promise<boolean>;
  deliverables(requestId: string): Promise<{ file_path: string; body: string | null; meta: Record<string, unknown> | null; created_at: string }[]>;
  timeline(requestId: string): Promise<{ type: string; body: string | null; created_at: string; actor: string | null; file_path?: string | null; file_name?: string | null }[]>;
  sign(paths: string[], seconds: number): Promise<Record<string, string>>;
  markViewed(link: Link, nowIso: string): Promise<void>;
  responseCount(linkId: string): Promise<number>;
  lastResponse(linkId: string): Promise<{ action: string; created_at: string } | null>;
  moveStatus(req: Req, to: 'closed' | 'revision', nowIso: string): Promise<boolean>;
  insertResponse(row: Record<string, unknown>): Promise<void>;
  insertEvent(row: Record<string, unknown>): Promise<void>;
  bellAdmins(title: string, body: string, meta?: NotifyMeta): Promise<void>;
  reopen?(req: Req, patch: Record<string, unknown>): Promise<boolean>;
  bellOwners?(tenantId: string, title: string, body: string, meta?: NotifyMeta): Promise<void>;
  // client-submitted attachment on confirm/revise (not admin deliverables): a signed upload slot the
  // public page PUTs the file to directly (sb.storage.uploadToSignedUrl) - no anon Storage RLS needed,
  // the signed token itself is the one-time grant. Optional so the pre-existing handler_test.ts mock
  // (already missing `timeline`, a separate pre-existing bug) doesn't need touching.
  uploadUrl?(tenantId: string, requestId: string, filename: string): Promise<{ path: string; token: string } | null>;
}
// same allowlist as app/sd-pub-form.js's client-side check (extension-based, not mime-sniffed) and the
// same 10MB cap - kept independently duplicated (Deno can't import that browser file), not shared with
// the 'service-files' bucket's own 25MB limit which stays as the hard backstop.
const FILE_TYPES = /\.(pdf|jpe?g|png|webp|heic|xlsx?|csv|txt|docx?)$/i;
const FILE_MAX = 10485760;
const FILES_MAX = 3;
const ORIGINS = ['https://mpflemedia.my', 'https://www.mpflemedia.my'];
const TOKEN_RE = /^[A-Za-z0-9_-]{32,64}$/;
const MAX_RESPONSES = 5, RL_MAX = 30, RL_WIN = 60000;
const hits = new Map<string, number[]>();
function rateOk(key: string, now: number): boolean {
  const a = (hits.get(key) || []).filter((t) => now - t < RL_WIN);
  a.push(now); hits.set(key, a);
  if (hits.size > 5000) for (const k of hits.keys()) { hits.delete(k); if (hits.size < 2500) break; }
  return a.length <= RL_MAX;
}
async function sha256hex(s: string): Promise<string> {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('');
}
// Business hours Mon-Fri in Asia/Kuala_Lumpur, same rule as SD.bhBetween in sd-data.js.
const wk = (ms: number) => { const d = new Date(ms + 8 * 3600000).getUTCDay(); return d !== 0 && d !== 6; };
function bhBetween(a: string | number, b: string | number): number {
  let x = new Date(a).getTime(), y = new Date(b).getTime(), sign = 1;
  if (y < x) { const t = x; x = y; y = t; sign = -1; }
  let h = 0, guard = 0; const step = 900000;
  for (let m = x; m < y && guard++ < 40000; m += step) if (wk(m)) h += Math.min(step, y - m);
  return sign * h / 3600000;
}
function addBH(from: number, hours: number): number {
  let ms = from, left = Math.max(0, hours) * 3600000, guard = 0; const step = 900000;
  while (left > 0 && guard++ < 20000) { if (wk(ms)) left -= step; ms += step; }
  return ms;
}
function cors(origin: string | null): Record<string, string> {
  const h: Record<string, string> = { 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' };
  if (origin && ORIGINS.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}
async function handle(req: Request, db: Db, now = Date.now()): Promise<Response> {
  const origin = req.headers.get('origin');
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  if (req.method === 'OPTIONS') return new Response(null, { status: origin && ORIGINS.includes(origin) ? 204 : 403, headers: cors(origin) });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  if (origin && !ORIGINS.includes(origin)) return json({ error: 'origin' }, 403);
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'na';
  if (!rateOk(ip, now)) return json({ error: 'rate' }, 429);
  let p: { token?: unknown; action?: unknown; comment?: unknown; filename?: unknown; size?: unknown; files?: unknown };
  try { p = await req.json(); } catch { return json({ error: 'bad' }, 400); }
  const token = typeof p.token === 'string' ? p.token : '', action = typeof p.action === 'string' ? p.action : 'view';
  if (!TOKEN_RE.test(token) || !['view', 'confirm', 'revise', 'reopen', 'upload_url'].includes(action)) return json({ error: 'inactive' }, 404);
  const link = await db.linkByHash(await sha256hex(token));
  if (!link || link.deleted_at || link.revoked_at || new Date(link.expires_at).getTime() <= now) return json({ error: 'inactive' }, 404);
  const r = await db.request(link.request_id);
  if (!r || r.deleted_at || String(r.tenant_id) !== String(link.tenant_id)) return json({ error: 'inactive' }, 404);
  const nowIso = new Date(now).toISOString();
  if (action === 'upload_url') {
    if (!db.uploadUrl) return json({ error: 'unsupported' }, 501);
    if (r.status !== 'delivered') return json({ error: 'state', status: r.status }, 409);
    const filename = typeof p.filename === 'string' ? p.filename.slice(-200) : '';
    const size = typeof p.size === 'number' ? p.size : 0;
    if (!filename || !FILE_TYPES.test(filename)) return json({ error: 'file_type' }, 400);
    if (!size || size > FILE_MAX) return json({ error: 'file_size' }, 400);
    const up = await db.uploadUrl(r.tenant_id, r.id, filename);
    if (!up) return json({ error: 'upload_failed' }, 500);
    return json({ ok: true, path: up.path, token: up.token });
  }
  if (action === 'view') {
    const [tname, svc, paid, files, last, tl] = await Promise.all([db.tenantName(r.tenant_id), db.service(r.service_code), db.contractPaid(r.tenant_id, r.contract_id), db.deliverables(r.id), db.lastResponse(link.id), db.timeline(r.id)]);
    const urls = paid && files.length ? await db.sign(files.map((f) => f.file_path), 600) : {};
    const tlPaths = tl.map((e) => e.file_path).filter((p): p is string => !!p);
    const tlUrls = tlPaths.length ? await db.sign(tlPaths, 300) : {};
    await db.markViewed(link, nowIso);
    const end = r.delivered_at || r.closed_at;
    const sla = r.due_at ? Math.round(bhBetween(r.created_at, r.due_at)) : (svc && svc.default_sla_hours) || null;
    return json({
      ok: true, ref_no: r.ref_no, title: r.title, status: r.status, tenant_name: tname,
      service_en: svc ? svc.name_en : r.service_code, service_bm: svc ? svc.name_bm : r.service_code,
      delivered_at: r.delivered_at, closed_at: r.closed_at, expires_at: link.expires_at,
      hours_taken: end ? Math.max(0, Math.round(bhBetween(r.created_at, end) - (r.sla_paused_seconds || 0) / 3600)) : null, sla_hours: sla,
      paid, files: files.map((f) => ({ name: String(f.body || (f.meta && (f.meta as { name?: string }).name) || f.file_path.split('/').pop()), size: Number((f.meta && (f.meta as { size?: number }).size) || 0), url: urls[f.file_path] || null })),
      response: last, timeline: tl.map((e) => ({ type: e.type, body: e.body, created_at: e.created_at, actor: e.actor, file: e.file_path ? { name: e.file_name || e.file_path.split('/').pop() || '', url: tlUrls[e.file_path] || null } : null })), timeline_count: (tl || []).length, can_respond: r.status === 'delivered',
      can_reopen: r.status === 'closed' && 'reopen_count' in r && !!db.reopen, reopened_at: r.reopened_at || null,
    });
  }
  const comment = typeof p.comment === 'string' ? p.comment.trim().slice(0, 2000) : '';
  if ((action === 'revise' || action === 'reopen') && comment.length < 3) return json({ error: 'comment' }, 400);
  if (action === 'reopen') {
    if (r.status !== 'closed' || !('reopen_count' in r) || !db.reopen) return json({ error: 'state', status: r.status }, 409);
    if ((await db.responseCount(link.id)) >= MAX_RESPONSES) return json({ error: 'rate' }, 429);
    const win = r.due_at ? Math.max(1, Math.round(bhBetween(r.created_at, r.due_at))) : 0;
    const patch: Record<string, unknown> = { status: 'in_progress', updated_at: nowIso, closed_at: null, delivered_at: null, paused_at: null, sla_paused_seconds: 0, reopened_at: nowIso, reopen_count: (Number(r.reopen_count) || 0) + 1 };
    if (win) patch.due_at = new Date(addBH(now, win)).toISOString();
    if (!(await db.reopen(r, patch))) return json({ error: 'state' }, 409);
    await db.insertResponse({ tenant_id: r.tenant_id, request_id: r.id, link_id: link.id, action, comment });
    await db.insertEvent({ tenant_id: r.tenant_id, request_id: r.id, type: 'status', from_status: 'closed', to_status: 'in_progress', body: comment, actor_id: null, meta: { via: 'result_link', link_id: link.id, reopen: true } });
    const t = r.ref_no + ': reopened by client (Dibuka semula)';
    const reopenMeta: NotifyMeta = { type: 'sd.reopened', refTable: 'service_requests', refId: r.id, groupKey: 'sd_event:' + r.id + ':reopen:' + nowIso.slice(0, 10) };
    await db.bellAdmins(t, comment, reopenMeta).catch(() => {});
    if (db.bellOwners) await db.bellOwners(r.tenant_id, t, comment, reopenMeta).catch(() => {});
    return json({ ok: true, status: 'in_progress' });
  }
  if (r.status !== 'delivered') return json({ error: 'state', status: r.status }, 409);
  if ((await db.responseCount(link.id)) >= MAX_RESPONSES) return json({ error: 'rate' }, 429);
  const filesIn = Array.isArray(p.files) ? (p.files as Record<string, unknown>[]).slice(0, FILES_MAX) : [];
  const files = filesIn.filter((f): f is { path: string; name: string; size: number } =>
    typeof f.path === 'string' && f.path.startsWith(r.tenant_id + '/service-requests/' + r.id + '/') && typeof f.name === 'string' && typeof f.size === 'number');
  const to = action === 'confirm' ? 'closed' : 'revision';
  if (!(await db.moveStatus(r, to, nowIso))) return json({ error: 'state' }, 409);
  await db.insertResponse({ tenant_id: r.tenant_id, request_id: r.id, link_id: link.id, action, comment: comment || null });
  await db.insertEvent({ tenant_id: r.tenant_id, request_id: r.id, type: 'status', from_status: 'delivered', to_status: to, body: comment || null, actor_id: null, meta: { via: 'result_link', link_id: link.id } });
  for (const f of files) {
    await db.insertEvent({ tenant_id: r.tenant_id, request_id: r.id, type: 'attachment', file_path: f.path, file_name: f.name.slice(-200), file_size: f.size, body: null, actor_id: null, meta: { via: 'result_link', link_id: link.id, client_reply: true } });
  }
  const fileTag = files.length ? ' \u{1F4CE}' + (files.length > 1 ? 'x' + files.length : '') : '';
  await db.bellAdmins(r.ref_no + fileTag + (to === 'closed' ? ': client confirmed (Disahkan)' : ': revision requested (Minta pindaan)'), comment || r.title, { type: to === 'closed' ? 'sd.confirmed' : 'sd.revision', refTable: 'service_requests', refId: r.id, groupKey: 'sd_event:' + r.id + ':' + action + ':' + nowIso.slice(0, 10) }).catch(() => {});
  return json({ ok: true, status: to });
}
// ---- end inlined handler.ts ----

// mirrors app/notif-core.js's NT.tgFan() + NT.quiet() (browser JS this edge function can't import) -
// same channel-toggle + quiet-hours rules, sent through the existing telegram-send function so the
// bot token never needs to be duplicated here. Scoped to one tenant (bellOwners); bellAdmins
// (platform_admin, spans tenants) is intentionally left bell-only - see OUT-OF-SCOPE note in the PR.
async function tgFanOut(sb: ReturnType<typeof createClient>, tenantId: string, userIds: string[], cat: string, title: string, body: string) {
  if (!userIds.length) return;
  try {
    const { data: rows } = await sb.from('notification_settings').select('user_id,settings').eq('tenant_id', tenantId).in('user_id', userIds);
    const smap: Record<string, Record<string, unknown>> = {};
    ((rows || []) as Record<string, unknown>[]).forEach((r) => { smap[r.user_id as string] = (r.settings as Record<string, unknown>) || {}; });
    const url = Deno.env.get('SUPABASE_URL') || '', key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const nowKL = new Date(Date.now() + 8 * 3600000);
    const wd = nowKL.getUTCDay() || 7;
    const hm = String(nowKL.getUTCHours()).padStart(2, '0') + ':' + String(nowKL.getUTCMinutes()).padStart(2, '0');
    for (const id of userIds) {
      const s = smap[id] || {};
      const m = ((s.m as Record<string, { t?: number }>) || {})[cat];
      if (!m || !m.t) continue; // channel toggle: off unless the admin turned Telegram on for this category
      const q = s.q as { on?: number; from?: string; to?: string; days?: number[] } | undefined;
      if (q && q.on) {
        const f = q.from || '22:00', t = q.to || '07:00';
        const inR = f <= t ? (hm >= f && hm < t) : (hm >= f || hm < t);
        const days = q.days || [1, 2, 3, 4, 5];
        const dayOk = !days.length || days.indexOf(f > t && hm < t ? ((wd + 5) % 7) + 1 : wd) >= 0;
        if (inR && dayOk) continue; // quiet hours
      }
      try {
        await fetch(url + '/functions/v1/telegram-send', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
          body: JSON.stringify({ tenant_id: tenantId, subject_type: 'user', subject_id: id, text: 'M-Core · ' + title + (body ? '\n' + body : '') }),
        });
      } catch (_e) { /* best-effort */ }
    }
  } catch (_e) { /* best-effort, never blocks the caller */ }
}

function db(): Db {
  const url = Deno.env.get('SUPABASE_URL') || '', key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!url || !key) throw new Error('supabase env missing');
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const one = async <T>(q: PromiseLike<{ data: T | null; error: unknown }>) => { const r = await q; if (r.error) throw r.error; return r.data; };
  return {
    linkByHash: (h) => one<Link>(sb.from('service_result_links').select('id,tenant_id,request_id,expires_at,revoked_at,deleted_at,viewed_at,view_count').eq('token_hash', h).maybeSingle()),
    request: (id) => one<Req>(sb.from('service_requests').select('*').eq('id', id).maybeSingle()),
    tenantName: async (id) => ((await one<{ name: string }>(sb.from('tenants').select('name').eq('id', id).maybeSingle())) || { name: '' }).name,
    service: (code) => one(sb.from('service_catalog').select('name_en,name_bm,default_sla_hours').eq('code', code).is('deleted_at', null).maybeSingle()),
    // Unlocked when the ticket's own contract is paid OR the tenant has a currently active paid contract. invoice_ref 'FREE…' counts as paid.
    contractPaid: async (tid, cid) => {
      type C = { id: string; payment_status: string; invoice_ref: string | null; status: string; start_date: string | null; end_date: string | null };
      const rows = (await one<C[]>(sb.from('service_contracts').select('id,payment_status,invoice_ref,status,start_date,end_date').eq('tenant_id', tid).is('deleted_at', null))) || [];
      const today = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10); // Asia/Kuala_Lumpur
      const paid = (c: C) => c.payment_status === 'paid' || /^FREE/i.test(c.invoice_ref || '');
      const live = (c: C) => c.status === 'active' && (!c.start_date || c.start_date.slice(0, 10) <= today) && (!c.end_date || today <= c.end_date.slice(0, 10));
      return rows.some((c) => paid(c) && ((!!cid && String(c.id) === String(cid)) || live(c)));
    },
    deliverables: async (rid) => ((await one<{ file_path: string; body: string | null; meta: Record<string, unknown> | null; created_at: string }[]>(
      sb.from('service_request_events').select('file_path,body,meta,created_at').eq('request_id', rid).eq('type', 'attachment').not('file_path', 'is', null).order('created_at'))) || [])
      .filter((e) => e.meta && (e.meta as { deliverable?: boolean }).deliverable === true),
    sign: async (paths, sec) => {
      const r = await sb.storage.from('service-files').createSignedUrls(paths, sec); const m: Record<string, string> = {};
      (r.data || []).forEach((x) => { if (x.path && x.signedUrl) m[x.path] = x.signedUrl; }); return m;
    },
    timeline: async (rid) => {
      const rows = (await one<{ type: string; body: string | null; created_at: string; actor_id: string | null; file_path: string | null; file_name: string | null }[]>(
        sb.from('service_request_events').select('type,body,created_at,actor_id,file_path,file_name').eq('request_id', rid).order('created_at', { ascending: false }).limit(40))) || [];
      return rows.map((e) => ({ type: e.type || 'note', body: e.body, created_at: e.created_at, actor: e.actor_id, file_path: e.file_path, file_name: e.file_name }));
    },
    // signed upload slot for a client-submitted attachment on confirm/revise - the public page PUTs
    // the file straight to this URL (sb.storage.uploadToSignedUrl); no anon Storage RLS added, the
    // signed token is itself the one-time authorization. Path matches the existing deliverables
    // convention ((storage.foldername(name))[2] = 'service-requests') for consistency.
    uploadUrl: async (tid, rid, filename) => {
      const safe = filename.replace(/[^\w.\-]+/g, '_').slice(-120);
      const path = tid + '/service-requests/' + rid + '/client-' + Date.now() + '-' + safe;
      const r = await sb.storage.from('service-files').createSignedUploadUrl(path);
      if (r.error || !r.data) return null;
      return { path: r.data.path, token: r.data.token };
    },

    markViewed: async (l, now) => { await sb.from('service_result_links').update({ viewed_at: l.viewed_at || now, view_count: (l.view_count || 0) + 1 }).eq('id', l.id); },
    responseCount: async (lid) => { const r = await sb.from('service_result_responses').select('id', { count: 'exact', head: true }).eq('link_id', lid); return r.count || 0; },
    lastResponse: (lid) => one(sb.from('service_result_responses').select('action,created_at').eq('link_id', lid).is('deleted_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle()),
    moveStatus: async (r, to, now) => {
      const p: Record<string, unknown> = { status: to, updated_at: now }; if (to === 'closed') p.closed_at = now;
      const x = await sb.from('service_requests').update(p).eq('id', r.id).eq('status', 'delivered').select('id');
      return !x.error && (x.data || []).length === 1;
    },
    insertResponse: async (row) => { const x = await sb.from('service_result_responses').insert(row); if (x.error) throw x.error; },
    insertEvent: async (row) => { const x = await sb.from('service_request_events').insert(row); if (x.error) throw x.error; },
    reopen: async (r, patch) => {
      const x = await sb.from('service_requests').update(patch).eq('id', r.id).eq('status', 'closed').select('id');
      return !x.error && (x.data || []).length === 1;
    },
    // enrichment (type/ref_table/ref_id/group_key) mirrors app/notif-core.js's NT.notify() row shape
    // for bell grouping; category stays 'service_desk' and link is left unset so the existing
    // "SR-xxxxxx-n" regex routing in notif-items.js's link() keeps deep-linking correctly (unchanged).
    bellOwners: async (tid, title, body, meta?: NotifyMeta) => {
      const a = await sb.from('user_profiles').select('id,tenant_id,role').eq('tenant_id', tid).eq('role', 'owner');
      const ids = (a.data || []).map((u) => u.id);
      const rows = (a.data || []).map((u) => ({ tenant_id: u.tenant_id, user_id: u.id, actor_id: null, title, body, category: 'service_desk', kind: 'for_you', type: meta?.type || null, ref_table: meta?.refTable || null, ref_id: meta?.refId != null ? String(meta.refId) : null, group_key: meta?.groupKey || null }));
      if (!rows.length) return;
      await sb.from('notifications').insert(rows);
      await tgFanOut(sb, tid, ids, 'sd', title, body);
    },
    bellAdmins: async (title, body, meta?: NotifyMeta) => {
      const a = await sb.from('user_profiles').select('id,tenant_id').eq('role', 'platform_admin');
      const rows = (a.data || []).filter((u) => u.tenant_id).map((u) => ({ tenant_id: u.tenant_id, user_id: u.id, actor_id: null, title, body, category: 'service_desk', kind: 'for_you', type: meta?.type || null, ref_table: meta?.refTable || null, ref_id: meta?.refId != null ? String(meta.refId) : null, group_key: meta?.groupKey || null }));
      if (rows.length) await sb.from('notifications').insert(rows);
      // platform_admin Telegram fan-out intentionally skipped - telegram_links/notification_settings
      // are tenant-scoped and a platform admin's own tenant_id for this purpose isn't established
      // anywhere in the schema seen; see OUT-OF-SCOPE FINDINGS.
    },
  };
}
Deno.serve(async (req) => {
  try { return await handle(req, db()); } catch (e) {
    console.error('sd-result', e);
    return new Response(JSON.stringify({ error: 'server' }), { status: 500, headers: { ...cors(req.headers.get('origin')), 'Content-Type': 'application/json' } });
  }
});
