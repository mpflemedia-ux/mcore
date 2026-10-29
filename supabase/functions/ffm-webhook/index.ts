// ffm-webhook — FFM push endpoint (verify_jwt = false). URL: https://<project>.supabase.co/functions/v1/ffm-webhook
// Auth: Authorization = HMAC-SHA256(appSecret, appKey + rawJson) per FFM docs. Idempotent via ffm_events.dedupe_key.
// If the matched account has NO webhook secret yet, the push is only a trigger: state is re-fetched from the FFM API (never trusted).
import { applyAsn, applyShipment, claim, CORS, credentialAlert, nowIso, pollAsn, pollShipment, pullStock, SB, sbAdmin } from '../_shared/ffm-core.ts';
import { dedupeKey, hmacOk, RETURN_STATE, Row, WEBHOOK_STATE } from '../_shared/ffm-logic.ts';

const ok = () => new Response(JSON.stringify({ code: 1, msg: 'success' }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
const fail = (s: number, m: string) => new Response(JSON.stringify({ code: 0, msg: m }), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function accountsWithSecrets(sb: SB, ids: string[] | null, mchId: string): Promise<Row[]> {
  let q = sb.from('ffm_account_secrets').select('*');
  if (ids) q = q.in('account_id', ids); else if (mchId) q = q.eq('mch_id', mchId); else q = q.not('webhook_app_secret', 'is', null);
  const { data: secs } = await q;
  if (!secs?.length) return [];
  const { data: accts } = await sb.from('ffm_accounts').select('*').in('id', secs.map((s: Row) => s.account_id)).is('deleted_at', null);
  return (accts || []).map((a: Row) => ({ acct: a, sec: secs.find((s: Row) => String(s.account_id) === String(a.id)) }));
}
async function entityAccountIds(sb: SB, p: Row): Promise<string[] | null> {
  const id = String(p.orderId || ''), sn = String(p.outTradeNo || p.orderSn || '');
  const tbl = p.method === 'arrivalNotice' ? 'ffm_asn' : 'ffm_shipments';
  const ors = [id && `ffm_order_id.eq.${id}`, sn && `order_sn.eq.${sn}`].filter(Boolean).join(',');
  if (!ors || /[,()]/.test(id + sn)) return null;
  const { data } = await sb.from(tbl).select('account_id').or(ors).is('deleted_at', null).limit(5);
  const ids: string[] = Array.from(new Set<string>((data || []).map((r: Row) => String(r.account_id))));
  return ids.length ? ids : null;
}

async function findShipment(sb: SB, acct: Row, p: Row): Promise<Row | null> {
  const id = String(p.orderId || ''), sn = String(p.outTradeNo || p.orderSn || '');
  if (id) { const { data } = await sb.from('ffm_shipments').select('*').eq('account_id', acct.id).eq('ffm_order_id', id).is('deleted_at', null).maybeSingle(); if (data) return data; }
  if (sn) {
    const { data } = await sb.from('ffm_shipments').select('*').eq('account_id', acct.id).eq('order_sn', sn).is('deleted_at', null).maybeSingle(); if (data) return data;
    const base = sn.split('-')[0]; // demo outTradeNo = "<orderSn>-<n>-<pno>"
    const { data: d2 } = await sb.from('ffm_shipments').select('*').eq('account_id', acct.id).is('deleted_at', null).like('order_sn', base.replace(/[%_]/g, '') + '%').order('created_at', { ascending: false }).limit(5);
    return (d2 || []).find((s: Row) => sn === s.order_sn || sn.startsWith(s.order_sn + '-')) || null;
  }
  return null;
}

async function process(sb: SB, acct: Row, sec: Row, p: Row, verified: boolean): Promise<string> {
  const m = String(p.method || '');
  if (m === 'deliveryOrder') {
    const ship = await findShipment(sb, acct, p); if (!ship) return 'no_shipment';
    if (!verified) { await pollShipment(sb, acct, sec, ship); return 'polled'; }
    const st = WEBHOOK_STATE[Number(p.state)];
    const extra: Row = { state: Number(p.state) || null, state_text: String(p.stateText || p.message || '').slice(0, 200) };
    if (p.pno) extra.pno = String(p.pno); if (p.recentPno) extra.recent_pno = String(p.recentPno);
    if (!ship.ffm_order_id && p.orderId) extra.ffm_order_id = String(p.orderId);
    if (st) await applyShipment(sb, ship, st, extra); else await sb.from('ffm_shipments').update({ ...extra, updated_at: nowIso() }).eq('id', ship.id);
    return 'applied:' + (st || p.state);
  }
  if (m === 'deliveryRollbackOrder') {
    const ship = await findShipment(sb, acct, { orderSn: p.orderSn });
    const state = Number(p.state) || null, done = state === 1060;
    await sb.from('ffm_returns').upsert({ tenant_id: acct.tenant_id, account_id: acct.id, shipment_id: ship?.id || null, ffm_return_id: String(p.orderId), order_sn: p.orderSn ? String(p.orderSn) : null, state, state_text: RETURN_STATE[state as number] || String(p.state ?? ''), received_at: done && verified ? nowIso() : null, updated_at: nowIso(), deleted_at: null }, { onConflict: 'account_id,ffm_return_id' });
    if (done) { try { await pullStock(sb, acct, sec); } catch (_) { /* cron retries */ } }
    if (done && verified && ship) await applyShipment(sb, ship, 'returned', { state_text: 'Return received (' + p.orderId + ')' });
    return 'return:' + state + (verified ? '' : ':unverified');
  }
  if (m === 'arrivalNotice') {
    const id = String(p.orderId || ''), sn = String(p.orderSn || '');
    let asn: Row | null = null;
    if (id) asn = (await sb.from('ffm_asn').select('*').eq('account_id', acct.id).eq('ffm_order_id', id).is('deleted_at', null).maybeSingle()).data;
    if (!asn && sn) asn = (await sb.from('ffm_asn').select('*').eq('account_id', acct.id).eq('order_sn', sn).is('deleted_at', null).maybeSingle()).data;
    if (!asn) return 'no_asn';
    if (!verified || Number(p.status) === 50) { await pollAsn(sb, acct, sec, asn); return 'asn_polled'; } // 50: fetch received qty too
    await applyAsn(sb, acct, sec, asn, Number(p.status), null);
    return 'asn:' + p.status;
  }
  if (m === 'lossOverflow') { try { await pullStock(sb, acct, sec); } catch (_) { /* cron retries */ } return 'stock_refreshed'; }
  return 'ignored:' + m;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return fail(405, 'POST only');
  const raw = await req.text();
  if (raw.length > 200000) return fail(413, 'too large');
  let p: Row;
  try { p = JSON.parse(raw); } catch { return fail(400, 'bad json'); }
  if (!p || typeof p !== 'object' || !p.method) return fail(400, 'no method');
  const sb = sbAdmin(), sig = req.headers.get('Authorization') || req.headers.get('authorization');
  const mch = String(p.mchId || '').trim();
  // 1) candidate accounts: by mchId, else by the referenced order, else every account that has a webhook secret (signature decides)
  let cands = await accountsWithSecrets(sb, null, mch);
  if (!cands.length) { const ids = await entityAccountIds(sb, p); if (ids) cands = await accountsWithSecrets(sb, ids, ''); }
  if (!cands.length && !mch) cands = await accountsWithSecrets(sb, null, '');
  // 2) verify
  let hit: Row | null = null, verified = false;
  for (const c of cands) { if (c.sec?.webhook_app_secret && (await hmacOk(sig, c.sec.webhook_app_secret, c.sec.webhook_app_key || '', raw))) { hit = c; verified = true; break; } }
  if (!hit) {
    const noSecret = cands.filter((c) => !c.sec?.webhook_app_secret);
    if (noSecret.length === 1 && cands.length === 1) hit = noSecret[0]; // trigger-only mode (state re-fetched from API)
  }
  if (!hit) {
    const a = cands[0]?.acct;
    await claim(sb, { tenant_id: a?.tenant_id || null, account_id: a?.id || null, method: String(p.method), dedupe_key: 'badsig:' + (a?.id || 'none') + ':' + dedupeKey(p), verified: false, payload: p, error: cands.length ? 'signature mismatch' : 'no matching account' });
    if (a) await credentialAlert(sb, a, 'webhook', 'Webhook signature mismatch — check App Key/App Secret');
    console.warn(JSON.stringify({ ffm: 'webhook_reject', method: p.method, cands: cands.length }));
    return fail(401, 'signature');
  }
  const { acct, sec } = hit;
  const key = acct.id + ':' + dedupeKey(p);
  if (!(await claim(sb, { tenant_id: acct.tenant_id, account_id: acct.id, method: String(p.method), dedupe_key: key, verified, payload: p }))) return ok(); // duplicate
  try {
    const res = await process(sb, acct, sec, p, verified);
    await sb.from('ffm_events').update({ processed_at: nowIso(), error: res.startsWith('no_') ? res : null }).eq('dedupe_key', key);
    return ok();
  } catch (e) {
    const msg = String((e as Error)?.message || e);
    await sb.from('ffm_events').delete().eq('dedupe_key', key); // allow FFM retry
    console.warn(JSON.stringify({ ffm: 'webhook_err', method: p.method, err: msg }));
    return fail(500, 'retry');
  }
});
