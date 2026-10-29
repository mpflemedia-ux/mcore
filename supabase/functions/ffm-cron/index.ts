// ffm-cron — pg_cron entry (verify_jwt = false; x-push-secret must equal PUSH_CRON_SECRET, same as pj-auto).
// tick (every 30 min): FFM stock pull -> ffm_stock (NEVER products.stock_qty) + low-stock alerts; poll live shipments; poll pending ASNs.
// recon (daily 07:15 MYT): M-Core stock_qty vs FFM per tenant -> ffm_recon_runs + notification when diffs.
import { credentialAlert, enabledTenants, env, FfmError, isLive, json, CORS, markAccount, pollAsn, pollShipment, pullStock, reconTenant, SB, sbAdmin } from '../_shared/ffm-core.ts';
import { Row, secretOk } from '../_shared/ffm-logic.ts';

const msg = (e: unknown) => String((e as Error)?.message || e);
const isCred = (e: unknown) => e instanceof FfmError && ['1001', '1002', '1669', 'no_credentials'].includes(String(e.code));

async function tickAccount(sb: SB, acct: Row): Promise<Row> {
  const { data: sec } = await sb.from('ffm_account_secrets').select('*').eq('account_id', acct.id).maybeSingle();
  if (!sec?.mch_id || !sec?.api_key) return { account_id: acct.id, skipped: 'no_credentials' };
  const out: Row = { account_id: acct.id };
  try { out.stock = await pullStock(sb, acct, sec); }
  catch (e) { out.stock_error = msg(e); await markAccount(sb, acct, msg(e)); if (isCred(e)) { await credentialAlert(sb, acct, 'connection', msg(e)); return out; } }
  const { data: ships } = await sb.from('ffm_shipments').select('*').eq('account_id', acct.id).is('deleted_at', null).not('status', 'in', '("delivered","rejected","cancelled","returned","failed","sending")').order('last_polled_at', { ascending: true, nullsFirst: true }).limit(30);
  let polled = 0;
  for (const s of ships || []) { if (!isLive(s.status)) continue; try { await pollShipment(sb, acct, sec, s); polled++; } catch (e) { if (isCred(e)) break; } }
  out.shipments_polled = polled;
  const { data: asns } = await sb.from('ffm_asn').select('*').eq('account_id', acct.id).is('deleted_at', null).is('received_at', null).not('ffm_order_id', 'is', null).limit(20);
  let ap = 0;
  for (const a of asns || []) { try { await pollAsn(sb, acct, sec, a); ap++; } catch (e) { if (isCred(e)) break; } }
  out.asn_polled = ap;
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (!secretOk(req.headers.get('x-push-secret'), env('PUSH_CRON_SECRET'))) return json({ error: 'unauthorized' }, 401);
  let b: Row = {}; try { b = await req.json(); } catch { b = {}; }
  const sb = sbAdmin(), t0 = Date.now();
  const { data: all } = await sb.from('ffm_accounts').select('*').is('deleted_at', null).eq('is_active', true).eq('has_api_key', true);
  const on = await enabledTenants(sb);
  const accts = (all || []).filter((a: Row) => on.has(String(a.tenant_id))); // FFM-enabled tenants only
  if (b.action === 'recon') {
    const tenants = Array.from(new Set<string>((accts || []).map((a: Row) => String(a.tenant_id))));
    const res: Row[] = [];
    for (const t of tenants) { try { res.push({ tenant_id: t, ...(await reconTenant(sb, t)) }); } catch (e) { res.push({ tenant_id: t, error: msg(e) }); } }
    return json({ ok: true, recon: res, ms: Date.now() - t0 });
  }
  const res: Row[] = [];
  for (const a of accts || []) {
    if (Date.now() - t0 > 120000) { res.push({ account_id: a.id, skipped: 'time_budget' }); continue; }
    try { res.push(await tickAccount(sb, a)); } catch (e) { res.push({ account_id: a.id, error: msg(e) }); }
  }
  console.log(JSON.stringify({ ffm: 'tick', accounts: res.length, ms: Date.now() - t0 }));
  return json({ ok: true, results: res, ms: Date.now() - t0 });
});
