// M-Core Service Desk - client result link logic (pure; the DB is injected so it can be unit-tested without Supabase).
// Token flow: WhatsApp message carries ?sr_result=TOKEN -> page POSTs { token, action } here -> we look up sha256(token)
// in service_result_links (never the raw token), check revoked / expired / deleted, then:
//   view    -> request summary + 10-min signed URLs for deliverables (only if the client's contract is paid) + log view
//   confirm -> delivered -> closed   (+ status event + response row + bell to platform admins)
//   revise  -> delivered -> revision (comment 3..2000 chars required)
//   reopen  -> closed -> in_progress (reason 3..2000 required; needs sd_reopen_01.sql: reopen_count/reopened_at). SLA restarts:
//              due_at = now + same business-hour window (created_at -> old due_at); paused/delivered/closed cleared. Bells admins + owner.
export type Link = { id: string; tenant_id: string; request_id: string; expires_at: string; revoked_at: string | null; deleted_at: string | null; viewed_at: string | null; view_count: number };
export type Req = { id: string; tenant_id: string; contract_id: string | null; ref_no: string; title: string; service_code: string; status: string; created_at: string; due_at: string | null; delivered_at: string | null; closed_at: string | null; sla_paused_seconds: number | null; deleted_at: string | null; reopen_count?: number | null; reopened_at?: string | null };
// optional enrichment so bellAdmins/bellOwners can mirror app/notif-core.js's NT.notify() row shape
// (type/ref_table/ref_id/group_key) for bell grouping + Telegram fan-out; category/link routing for
// service_desk notifications stays on the existing "SR-xxxxxx-n" regex in notif-items.js's link() -
// deliberately NOT overridden here to avoid touching that already-working routing.
export type NotifyMeta = { type: string; refTable?: string; refId?: string; groupKey?: string };
export interface Db {
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
  // count of prior free-standing 'message' action sends on this request (type='comment' events whose
  // meta.message === true) - a separate budget from MAX_RESPONSES/responseCount, which only governs
  // confirm/revise/reopen. Optional for the same reason as uploadUrl above.
  messageCount?(requestId: string): Promise<number>;
}
// same allowlist as app/sd-pub-form.js's client-side check (extension-based, not mime-sniffed) and the
// same 10MB cap - kept independently duplicated (Deno can't import that browser file), not shared with
// the 'service-files' bucket's own 25MB limit which stays as the hard backstop.
const FILE_TYPES = /\.(pdf|jpe?g|png|webp|heic|xlsx?|csv|txt|docx?)$/i;
const FILE_MAX = 10485760;
const FILES_MAX = 3;
// free-standing "leave a message" action - available at any request status (not gated on 'delivered'
// like confirm/revise), so it gets its own, more generous per-request budget.
const MAX_MESSAGES = 10;
export const ORIGINS = ['https://mpflemedia.my', 'https://www.mpflemedia.my'];
const TOKEN_RE = /^[A-Za-z0-9_-]{32,64}$/;
const MAX_RESPONSES = 5, RL_MAX = 30, RL_WIN = 60000;
const hits = new Map<string, number[]>();
export function rateOk(key: string, now: number): boolean {
  const a = (hits.get(key) || []).filter((t) => now - t < RL_WIN);
  a.push(now); hits.set(key, a);
  if (hits.size > 5000) for (const k of hits.keys()) { hits.delete(k); if (hits.size < 2500) break; }
  return a.length <= RL_MAX;
}
export async function sha256hex(s: string): Promise<string> {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('');
}
// Business hours Mon-Fri in Asia/Kuala_Lumpur, same rule as SD.bhBetween in sd-data.js.
const wk = (ms: number) => { const d = new Date(ms + 8 * 3600000).getUTCDay(); return d !== 0 && d !== 6; };
export function bhBetween(a: string | number, b: string | number): number {
  let x = new Date(a).getTime(), y = new Date(b).getTime(), sign = 1;
  if (y < x) { const t = x; x = y; y = t; sign = -1; }
  let h = 0, guard = 0; const step = 900000;
  for (let m = x; m < y && guard++ < 40000; m += step) if (wk(m)) h += Math.min(step, y - m);
  return sign * h / 3600000;
}
export function addBH(from: number, hours: number): number {
  let ms = from, left = Math.max(0, hours) * 3600000, guard = 0; const step = 900000;
  while (left > 0 && guard++ < 20000) { if (wk(ms)) left -= step; ms += step; }
  return ms;
}
export function cors(origin: string | null): Record<string, string> {
  const h: Record<string, string> = { 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' };
  if (origin && ORIGINS.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}
export async function handle(req: Request, db: Db, now = Date.now()): Promise<Response> {
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
  if (!TOKEN_RE.test(token) || !['view', 'confirm', 'revise', 'reopen', 'upload_url', 'message'].includes(action)) return json({ error: 'inactive' }, 404);
  const link = await db.linkByHash(await sha256hex(token));
  if (!link || link.deleted_at || link.revoked_at || new Date(link.expires_at).getTime() <= now) return json({ error: 'inactive' }, 404);
  const r = await db.request(link.request_id);
  if (!r || r.deleted_at || String(r.tenant_id) !== String(link.tenant_id)) return json({ error: 'inactive' }, 404);
  const nowIso = new Date(now).toISOString();
  if (action === 'upload_url') {
    if (!db.uploadUrl) return json({ error: 'unsupported' }, 501);
    // no status gate here deliberately: 'message' (below) is available at any request status, and
    // needs a signed upload slot too. confirm/revise still gate on 'delivered' themselves, further down.
    const filename = typeof p.filename === 'string' ? p.filename.slice(-200) : '';
    const size = typeof p.size === 'number' ? p.size : 0;
    if (!filename || !FILE_TYPES.test(filename)) return json({ error: 'file_type' }, 400);
    if (!size || size > FILE_MAX) return json({ error: 'file_size' }, 400);
    const up = await db.uploadUrl(r.tenant_id, r.id, filename);
    if (!up) return json({ error: 'upload_failed' }, 500);
    return json({ ok: true, path: up.path, token: up.token });
  }
  if (action === 'message') {
    if (!db.messageCount) return json({ error: 'unsupported' }, 501);
    const msg = typeof p.comment === 'string' ? p.comment.trim().slice(0, 2000) : '';
    if (!msg) return json({ error: 'comment' }, 400);
    if ((await db.messageCount(r.id)) >= MAX_MESSAGES) return json({ error: 'rate' }, 429);
    const filesIn = Array.isArray(p.files) ? (p.files as Record<string, unknown>[]).slice(0, FILES_MAX) : [];
    const files = filesIn.filter((f): f is { path: string; name: string; size: number } =>
      typeof f.path === 'string' && f.path.startsWith(r.tenant_id + '/service-requests/' + r.id + '/') && typeof f.name === 'string' && typeof f.size === 'number');
    await db.insertEvent({ tenant_id: r.tenant_id, request_id: r.id, type: 'comment', body: msg, actor_id: null, meta: { via: 'result_link', link_id: link.id, message: true } });
    for (const f of files) {
      await db.insertEvent({ tenant_id: r.tenant_id, request_id: r.id, type: 'attachment', file_path: f.path, file_name: f.name.slice(-200), file_size: f.size, body: null, actor_id: null, meta: { via: 'result_link', link_id: link.id, client_reply: true } });
    }
    const fileTag = files.length ? ' \u{1F4CE}' + (files.length > 1 ? 'x' + files.length : '') : '';
    await db.bellAdmins(r.ref_no + fileTag + ': client sent a message (Mesej dari klien)', msg, { type: 'sd.message', refTable: 'service_requests', refId: r.id, groupKey: 'sd_event:' + r.id + ':message:' + nowIso.slice(0, 10) }).catch(() => {});
    return json({ ok: true });
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
