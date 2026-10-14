// M-Core Service Desk - client result link logic (pure; the DB is injected so it can be unit-tested without Supabase).
// Token flow: WhatsApp message carries ?sr_result=TOKEN -> page POSTs { token, action } here -> we look up sha256(token)
// in service_result_links (never the raw token), check revoked / expired / deleted, then:
//   view    -> request summary + 10-min signed URLs for deliverables (only if the client's contract is paid) + log view
//   confirm -> delivered -> closed   (+ status event + response row + bell to platform admins)
//   revise  -> delivered -> revision (comment 3..2000 chars required)
export type Link = { id: string; tenant_id: string; request_id: string; expires_at: string; revoked_at: string | null; deleted_at: string | null; viewed_at: string | null; view_count: number };
export type Req = { id: string; tenant_id: string; contract_id: string | null; ref_no: string; title: string; service_code: string; status: string; created_at: string; due_at: string | null; delivered_at: string | null; closed_at: string | null; sla_paused_seconds: number | null; deleted_at: string | null };
export interface Db {
  linkByHash(hash: string): Promise<Link | null>;
  request(id: string): Promise<Req | null>;
  tenantName(id: string): Promise<string>;
  service(code: string): Promise<{ name_en: string; name_bm: string; default_sla_hours: number | null } | null>;
  contractPaid(tenantId: string, contractId: string | null): Promise<boolean>;
  deliverables(requestId: string): Promise<{ file_path: string; body: string | null; meta: Record<string, unknown> | null; created_at: string }[]>;
  sign(paths: string[], seconds: number): Promise<Record<string, string>>;
  markViewed(link: Link, nowIso: string): Promise<void>;
  responseCount(linkId: string): Promise<number>;
  lastResponse(linkId: string): Promise<{ action: string; created_at: string } | null>;
  moveStatus(req: Req, to: 'closed' | 'revision', nowIso: string): Promise<boolean>;
  insertResponse(row: Record<string, unknown>): Promise<void>;
  insertEvent(row: Record<string, unknown>): Promise<void>;
  bellAdmins(title: string, body: string): Promise<void>;
}
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
  let p: { token?: unknown; action?: unknown; comment?: unknown };
  try { p = await req.json(); } catch { return json({ error: 'bad' }, 400); }
  const token = typeof p.token === 'string' ? p.token : '', action = typeof p.action === 'string' ? p.action : 'view';
  if (!TOKEN_RE.test(token) || !['view', 'confirm', 'revise'].includes(action)) return json({ error: 'inactive' }, 404);
  const link = await db.linkByHash(await sha256hex(token));
  if (!link || link.deleted_at || link.revoked_at || new Date(link.expires_at).getTime() <= now) return json({ error: 'inactive' }, 404);
  const r = await db.request(link.request_id);
  if (!r || r.deleted_at || String(r.tenant_id) !== String(link.tenant_id)) return json({ error: 'inactive' }, 404);
  const nowIso = new Date(now).toISOString();
  if (action === 'view') {
    const [tname, svc, paid, files, last] = await Promise.all([db.tenantName(r.tenant_id), db.service(r.service_code), db.contractPaid(r.tenant_id, r.contract_id), db.deliverables(r.id), db.lastResponse(link.id)]);
    const urls = paid && files.length ? await db.sign(files.map((f) => f.file_path), 600) : {};
    await db.markViewed(link, nowIso);
    const end = r.delivered_at || r.closed_at;
    const sla = r.due_at ? Math.round(bhBetween(r.created_at, r.due_at)) : (svc && svc.default_sla_hours) || null;
    return json({
      ok: true, ref_no: r.ref_no, title: r.title, status: r.status, tenant_name: tname,
      service_en: svc ? svc.name_en : r.service_code, service_bm: svc ? svc.name_bm : r.service_code,
      delivered_at: r.delivered_at, closed_at: r.closed_at, expires_at: link.expires_at,
      hours_taken: end ? Math.max(0, Math.round(bhBetween(r.created_at, end) - (r.sla_paused_seconds || 0) / 3600)) : null, sla_hours: sla,
      paid, files: files.map((f) => ({ name: String(f.body || (f.meta && (f.meta as { name?: string }).name) || f.file_path.split('/').pop()), size: Number((f.meta && (f.meta as { size?: number }).size) || 0), url: urls[f.file_path] || null })),
      response: last, can_respond: r.status === 'delivered',
    });
  }
  const comment = typeof p.comment === 'string' ? p.comment.trim().slice(0, 2000) : '';
  if (action === 'revise' && comment.length < 3) return json({ error: 'comment' }, 400);
  if (r.status !== 'delivered') return json({ error: 'state', status: r.status }, 409);
  if ((await db.responseCount(link.id)) >= MAX_RESPONSES) return json({ error: 'rate' }, 429);
  const to = action === 'confirm' ? 'closed' : 'revision';
  if (!(await db.moveStatus(r, to, nowIso))) return json({ error: 'state' }, 409);
  await db.insertResponse({ tenant_id: r.tenant_id, request_id: r.id, link_id: link.id, action, comment: comment || null });
  await db.insertEvent({ tenant_id: r.tenant_id, request_id: r.id, type: 'status', from_status: 'delivered', to_status: to, body: comment || null, actor_id: null, meta: { via: 'result_link', link_id: link.id } });
  await db.bellAdmins(r.ref_no + (to === 'closed' ? ': client confirmed (Disahkan)' : ': revision requested (Minta pindaan)'), comment || r.title).catch(() => {});
  return json({ ok: true, status: to });
}
