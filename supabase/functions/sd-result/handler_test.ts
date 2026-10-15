import { handle, sha256hex, bhBetween, type Db, type Link, type Req } from './handler.ts';
const eq = (a: unknown, b: unknown, m: string) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(m + ': ' + JSON.stringify(a) + ' != ' + JSON.stringify(b)); };
const TOK = 'Qm7xA9kPz3LwR5tY8uVb2NcD4eFgH6jK', NOW = Date.parse('2026-10-14T07:30:00Z');
async function mk(o: { link?: Partial<Link>; req?: Partial<Req>; paid?: boolean; rc?: number } = {}) {
  const H = await sha256hex(TOK), log: Record<string, unknown[]> = { ev: [], resp: [], move: [], view: [], bell: [], sign: [] };
  const link: Link = Object.assign({ id: 'L1', tenant_id: 'T1', request_id: 'R1', expires_at: '2026-10-21T07:00:00Z', revoked_at: null, deleted_at: null, viewed_at: null, view_count: 0 }, o.link || {});
  const req: Req = Object.assign({ id: 'R1', tenant_id: 'T1', contract_id: 'C1', ref_no: 'SR-202610-0007', title: 'Penyediaan payroll Oktober', service_code: 'payroll', status: 'delivered', created_at: '2026-10-12T07:00:00Z', due_at: '2026-10-14T07:00:00Z', delivered_at: '2026-10-13T19:00:00Z', closed_at: null, sla_paused_seconds: 0, deleted_at: null }, o.req || {});
  const db: Db = {
    linkByHash: async (h) => h === H ? link : null, request: async (id) => id === req.id ? req : null, tenantName: async () => 'Phion Sdn. Bhd.',
    service: async () => ({ name_en: 'Payroll', name_bm: 'Penggajian', default_sla_hours: 48 }), contractPaid: async () => o.paid !== false,
    deliverables: async () => [{ file_path: 'T1/service-requests/R1/1-slip.pdf', body: 'slip_gaji_okt_2026.pdf', meta: { size: 421888, deliverable: true }, created_at: '' }],
    sign: async (p, s) => { log.sign.push([p, s]); return Object.fromEntries(p.map((x) => [x, 'https://signed/' + x])); },
    markViewed: async (l, n) => { log.view.push([l.id, n]); }, responseCount: async () => o.rc || 0, lastResponse: async () => null,
    moveStatus: async (r, to) => { log.move.push(to); if (r.status !== 'delivered') return false; r.status = to; return true; },
    insertResponse: async (row) => { log.resp.push(row); }, insertEvent: async (row) => { log.ev.push(row); }, bellAdmins: async (t) => { log.bell.push(t); },
  };
  return { db, log, req };
}
const post = (b: unknown, origin = 'https://mpflemedia.my', ip = '1.1.1.1') => new Request('https://x/functions/v1/sd-result', { method: 'POST', headers: { origin, 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(b) });
Deno.test('view: summary, SLA x/y, signed urls 600s, view logged, CORS echo', async () => {
  const { db, log } = await mk(); const r = await handle(post({ token: TOK }), db, NOW); const j = await r.json();
  eq(r.status, 200, 'status'); eq(r.headers.get('access-control-allow-origin'), 'https://mpflemedia.my', 'cors');
  eq([j.ref_no, j.service_bm, j.tenant_name, j.can_respond], ['SR-202610-0007', 'Penggajian', 'Phion Sdn. Bhd.', true], 'fields');
  eq(j.sla_hours, 48, 'sla'); eq(j.hours_taken, 36, 'hours'); eq(j.files[0].url, 'https://signed/T1/service-requests/R1/1-slip.pdf', 'url');
  eq((log.sign[0] as unknown[])[1], 600, 'ttl'); eq(log.view.length, 1, 'viewed'); eq('token' in j || 'token_hash' in j || 'tenant_id' in j, false, 'no secrets');
});
Deno.test('view: unpaid contract -> files listed without urls', async () => { const { db, log } = await mk({ paid: false }); const j = await (await handle(post({ token: TOK }), db, NOW)).json(); eq(j.files[0].url, null, 'nourl'); eq(j.paid, false, 'paid'); eq(log.sign.length, 0, 'nosign'); });
for (const [n, o] of [['expired', { link: { expires_at: '2026-10-14T07:00:00Z' } }], ['revoked', { link: { revoked_at: '2026-10-13T00:00:00Z' } }], ['deleted link', { link: { deleted_at: '2026-10-13T00:00:00Z' } }], ['deleted request', { req: { deleted_at: '2026-10-13T00:00:00Z' } }], ['tenant mismatch', { req: { tenant_id: 'T2' } }]] as const)
  Deno.test('inactive: ' + n, async () => { const { db } = await mk(o as never); const r = await handle(post({ token: TOK }), db, NOW); eq(r.status, 404, 'st'); eq((await r.json()).error, 'inactive', 'err'); });
Deno.test('inactive: unknown / malformed token', async () => { const { db } = await mk(); for (const t of ['x'.repeat(40), 'short', "a'; drop--" + 'x'.repeat(30), 123]) eq((await handle(post({ token: t }), db, NOW)).status, 404, String(t)); });
Deno.test('cors: foreign origin 403, preflight', async () => {
  const { db } = await mk(); eq((await handle(post({ token: TOK }, 'https://evil.example'), db, NOW)).status, 403, 'evil');
  const pf = await handle(new Request('https://x', { method: 'OPTIONS', headers: { origin: 'https://mpflemedia.my' } }), db, NOW); eq(pf.status, 204, 'pf'); eq(pf.headers.get('access-control-allow-origin'), 'https://mpflemedia.my', 'pfo');
  eq((await handle(new Request('https://x', { method: 'GET' }), db, NOW)).status, 405, 'get');
});
Deno.test('confirm: delivered -> closed, response + status event via result_link + bell', async () => {
  const { db, log, req } = await mk(); const j = await (await handle(post({ token: TOK, action: 'confirm' }, undefined, '2.2.2.2'), db, NOW)).json();
  eq(j, { ok: true, status: 'closed' }, 'res'); eq(req.status, 'closed', 'req'); eq((log.resp[0] as { action: string }).action, 'confirm', 'resp');
  const ev = log.ev[0] as Record<string, unknown>; eq([ev.type, ev.from_status, ev.to_status, (ev.meta as { via: string }).via, ev.tenant_id], ['status', 'delivered', 'closed', 'result_link', 'T1'], 'ev'); eq(log.bell.length, 1, 'bell');
});
Deno.test('revise: needs comment; then delivered -> revision with comment', async () => {
  const { db, log, req } = await mk(); eq((await handle(post({ token: TOK, action: 'revise', comment: ' x ' }, undefined, '3.3.3.3'), db, NOW)).status, 400, 'short');
  const j = await (await handle(post({ token: TOK, action: 'revise', comment: 'Elaun OT Ali belum dimasukkan' }, undefined, '3.3.3.3'), db, NOW)).json();
  eq(j.status, 'revision', 'st'); eq(req.status, 'revision', 'req'); eq((log.ev[0] as { body: string }).body, 'Elaun OT Ali belum dimasukkan', 'body');
});
Deno.test('confirm when not delivered -> 409, no writes', async () => { const { db, log } = await mk({ req: { status: 'closed' } }); eq((await handle(post({ token: TOK, action: 'confirm' }, undefined, '4.4.4.4'), db, NOW)).status, 409, 'st'); eq(log.resp.length + log.ev.length, 0, 'nowrite'); });
Deno.test('max 5 responses per link -> 429', async () => { const { db } = await mk({ rc: 5 }); eq((await handle(post({ token: TOK, action: 'confirm' }, undefined, '5.5.5.5'), db, NOW)).status, 429, 'st'); });
Deno.test('rate limit 30/min per IP', async () => { const { db } = await mk(); let last = 0; for (let i = 0; i < 31; i++) last = (await handle(post({ token: TOK }, undefined, '9.9.9.9'), db, NOW)).status; eq(last, 429, 'rl'); });
Deno.test('bhBetween matches sd-data (Fri 15:00 -> Mon 15:00 MYT = 24h)', () => { eq(bhBetween('2026-10-16T07:00:00Z', '2026-10-19T07:00:00Z'), 24, 'wkend'); });
Deno.test('reopen: closed -> in_progress, SLA window restarts, event + response + bells; hidden until SQL', async () => {
  const { db, log } = await mk({ req: { status: 'closed', closed_at: '2026-10-13T20:00:00Z', reopen_count: 0, reopened_at: null } }); let patch: Record<string, unknown> = {}, own = 0;
  db.reopen = async (r, p) => { if (r.status !== 'closed') return false; patch = p; r.status = 'in_progress'; return true; }; db.bellOwners = async () => { own++; };
  const v = await (await handle(post({ token: TOK }), db, NOW)).json(); eq(v.can_reopen, true, 'can');
  eq((await handle(post({ token: TOK, action: 'reopen', comment: 'x' }), db, NOW)).status, 400, 'reason req');
  const j = await (await handle(post({ token: TOK, action: 'reopen', comment: 'Angka Mac salah' }), db, NOW)).json();
  eq(j, { ok: true, status: 'in_progress' }, 'ok'); eq([patch.status, patch.closed_at, patch.delivered_at, patch.reopen_count, patch.sla_paused_seconds], ['in_progress', null, null, 1, 0], 'patch');
  eq(patch.due_at, '2026-10-16T07:30:00.000Z', 'due = now + 48 bh'); eq((log.ev[0] as { meta: { reopen: boolean } }).meta.reopen, true, 'ev'); eq((log.resp[0] as { action: string }).action, 'reopen', 'resp'); eq([log.bell.length, own], [1, 1], 'bells');
  eq((await handle(post({ token: TOK, action: 'reopen', comment: 'again ok' }), db, NOW)).status, 409, 'not closed now');
  const m = await mk({ req: { status: 'closed' } }); eq((await (await handle(post({ token: TOK }), m.db, NOW)).json()).can_reopen, false, 'no column -> hidden');
});
