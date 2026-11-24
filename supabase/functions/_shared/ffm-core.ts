// M-Core FFM connector — server I/O shared by ffm-api / ffm-webhook / ffm-cron (service role only).
// Keys are read here from ffm_account_secrets and never returned to any client.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { doStatusFor, extractGoods, listStatusOf, nextStatus, normBaseUrl, NOTIFY_STATUS, nonce, POLL_STATE, ppuOf, Row, same, signAlg1, signAlg2, TERMINAL, unitsToPcs, WEBHOOK_STATE } from './ffm-logic.ts';

export const DEFAULT_BASE = 'https://open.flashfulfillment.my';
export const env = (k: string) => Deno.env.get(k) || '';
export const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-push-secret', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
export const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
// deno-lint-ignore no-explicit-any
export type SB = any;
export function sbAdmin(): SB { const u = env('SUPABASE_URL'), k = env('SUPABASE_SERVICE_ROLE_KEY'); if (!u || !k) throw new Error('supabase env missing'); return createClient(u, k, { auth: { persistSession: false } }); }
export const nowIso = () => new Date().toISOString();
export const mytDay = (d = new Date()) => new Date(d.getTime() + 8 * 3600000).toISOString().slice(0, 10);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class FfmError extends Error { code: string | number; constructor(code: string | number, msg: string) { super(msg); this.code = code; } }

export async function loadAccount(sb: SB, accountId: string, tenantId?: string): Promise<{ acct: Row; sec: Row | null }> {
  let q = sb.from('ffm_accounts').select('*').eq('id', accountId).is('deleted_at', null);
  if (tenantId) q = q.eq('tenant_id', tenantId);
  const { data: acct } = await q.maybeSingle();
  if (!acct) throw new FfmError('not_found', 'FFM account not found');
  const { data: sec } = await sb.from('ffm_account_secrets').select('*').eq('account_id', acct.id).maybeSingle();
  return { acct, sec: sec || null };
}

/** Signed FFM call. Algorithm 2 (JSON, default) or Algorithm 1 (form) per account.sign_mode. 1378 -> backoff; 1002 -> never retry. */
export async function ffmCall(acct: Row, sec: Row | null, path: string, body: Row = {}, tries = 4): Promise<Row> {
  if (!sec?.mch_id || !sec?.api_key) throw new FfmError('no_credentials', 'FFM keys not set for ' + (acct.label || 'account'));
  const base = (normBaseUrl(acct.base_url) || DEFAULT_BASE) + String(acct.api_prefix || '').replace(/\/+$/, '');
  const headers: Row = { Accept: 'application/json', 'Accept-Language': acct.accept_language || 'en' };
  if (acct.source_from) headers['FFM-Source-From'] = acct.source_from;
  let last: FfmError | null = null;
  for (let i = 0; i < tries; i++) {
    let url = base + path, payload: string;
    if (acct.sign_mode === 'form') {
      const p: Row = { ...body, mchId: sec.mch_id, nonceStr: nonce() };
      p.sign = await signAlg1(p, sec.api_key);
      payload = Object.keys(p).map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(typeof p[k] === 'object' ? JSON.stringify(p[k]) : String(p[k] ?? ''))).join('&');
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    } else {
      payload = JSON.stringify(body); // signed string === sent bytes
      const q: Row = { mchId: sec.mch_id, nonceStr: nonce(), timestamp: String(Math.floor(Date.now() / 1000)) };
      q.sign = await signAlg2(q, payload, sec.api_key);
      url += '?' + new URLSearchParams(q).toString();
      headers['Content-Type'] = 'application/json';
    }
    const ac = new AbortController(), to = setTimeout(() => ac.abort(), 20000);
    let res: Response | null = null, txt = '';
    try { res = await fetch(url, { method: 'POST', headers, body: payload, signal: ac.signal }); txt = await res.text(); }
    catch (e) { last = new FfmError('network', 'FFM network error: ' + ((e as Error)?.message || e)); }
    finally { clearTimeout(to); }
    if (res) {
      let j: Row | null = null; try { j = JSON.parse(txt); } catch { j = null; }
      if (j && Number(j.code) === 1) return j;
      if (j && Number(j.code) === 1002) throw new FfmError(1002, 'FFM signature rejected (1002) — check mchId/key and sign mode');
      if (j && Number(j.code) !== 1378 && res.status < 500) throw new FfmError(j.code, 'FFM ' + j.code + ': ' + (j.msg || 'error') + (j.request_id ? ' [req ' + j.request_id + ']' : ''));
      last = new FfmError(j ? j.code : res.status, j ? ('FFM ' + j.code + ': ' + (j.msg || 'rate limited')) : ('FFM HTTP ' + res.status));
      if (!j && res.status < 500 && res.status !== 429) throw last;
    }
    await sleep(800 * Math.pow(2, i) + Math.floor(Math.random() * 300));
  }
  throw last || new FfmError('unknown', 'FFM call failed');
}

// ---------- recipients + notifications (bell + push via push-send tick) ----------
const L = (lang: string, en: string, bm: string) => (lang === 'bm' ? bm : en);
// Mirrors client canAccess(): owner/admin/platform_admin all; else module_override, else tenants.config.roles, else default role modules.
const DEFAULT_ROLE_MODULES: Row = {
  manager: ['crm', 'sales', 'pos', 'sales_commission', 'sales_academy', 'inventory', 'logistics', 'purchasing', 'production', 'hr_attendance', 'hr_employees', 'hr_payroll', 'hr_recruit', 'accounting', 'vouchers', 'reports'],
  accountant: ['accounting', 'vouchers', 'reports', 'purchasing', 'sales', 'crm', 'sales_academy'], cashier: ['pos', 'sales'], staff: ['hr_attendance', 'sales_academy'],
};
// Tenant gate (platform-managed ffm_tenant_access). Platform admin bypass is applied by callers.
export async function tenantEnabled(sb: SB, tenantId: string): Promise<boolean> {
  if (!tenantId) return false;
  const { data, error } = await sb.from('ffm_tenant_access').select('enabled').eq('tenant_id', tenantId).is('deleted_at', null).maybeSingle();
  return !error && !!data && data.enabled === true;
}
export async function enabledTenants(sb: SB): Promise<Set<string>> {
  const { data } = await sb.from('ffm_tenant_access').select('tenant_id').eq('enabled', true).is('deleted_at', null);
  return new Set<string>((data || []).map((r: Row) => String(r.tenant_id)));
}
export function isAdminRole(role: unknown): boolean { const r = String(role || '').toLowerCase().trim(); return r === 'owner' || r === 'admin' || r === 'platform_admin'; }
export function userMods(u: Row, roles: Row): string[] {
  if (Array.isArray(u.module_override)) return u.module_override.map(String);
  const r = String(u.role || '').toLowerCase().trim(), rk = r.replace(/\s+/g, '_');
  const k = Object.keys(roles || {}).find((x) => x === r || x === rk || x.toLowerCase() === r || x.toLowerCase() === rk);
  if (k && Array.isArray(roles[k])) return roles[k].map(String);
  if (Object.keys(roles || {}).length) return [];
  return (DEFAULT_ROLE_MODULES[rk] || []).slice();
}
export function hasModule(u: Row, roles: Row, mods: string[]): boolean { return isAdminRole(u.role) || mods.some((m) => userMods(u, roles).includes(m)); }
export async function recipients(sb: SB, tenantId: string, mods: string[] = ['logistics']): Promise<Row[]> {
  const [{ data: ups }, { data: ten }] = await Promise.all([
    sb.from('user_profiles').select('*').eq('tenant_id', tenantId),
    sb.from('tenants').select('config').eq('id', tenantId).maybeSingle(),
  ]);
  const roles: Row = (ten?.config && ten.config.roles) || {};
  return (ups || []).filter((u: Row) => !u.deleted_at && u.is_active !== false && hasModule(u, roles, mods));
}
export interface Note { tenantId: string; actorId?: string | null; ev: string; ref: string; title: [string, string]; body?: [string, string]; link: Row; refTable?: string; refId?: string; kind?: string; prio?: number; mods?: string[] }
/** One row per event per recipient (group_key dedupe), actor excluded, same tenant only. */
export async function notify(sb: SB, n: Note): Promise<number> {
  try {
    const rs = (await recipients(sb, n.tenantId, n.mods)).filter((u) => !n.actorId || !same(u.id, n.actorId));
    if (!rs.length) return 0;
    const gk = 'ffm:' + n.ev + ':' + n.ref;
    const { data: had } = await sb.from('notifications').select('user_id').eq('group_key', gk).eq('tenant_id', n.tenantId).in('user_id', rs.map((u) => u.id));
    const done = new Set((had || []).map((x: Row) => String(x.user_id)));
    const rows = rs.filter((u) => !done.has(String(u.id))).map((u) => {
      const lg = u.language === 'bm' ? 'bm' : 'en';
      return { tenant_id: n.tenantId, user_id: u.id, actor_id: n.actorId || null, title: L(lg, n.title[0], n.title[1]).slice(0, 200), body: n.body ? L(lg, n.body[0], n.body[1]).slice(0, 300) : null,
        category: 'logistics', kind: n.kind || 'for_you', type: 'assigned.ffm_' + n.ev, priority: n.prio || 0, link: n.link, group_key: gk, ref_table: n.refTable || null, ref_id: n.refId ? String(n.refId) : null };
    });
    if (!rows.length) return 0;
    const { error } = await sb.from('notifications').insert(rows);
    if (error) console.warn(JSON.stringify({ ffm: 'notify_fail', ev: n.ev, err: error.message }));
    return error ? 0 : rows.length;
  } catch (e) { console.warn(JSON.stringify({ ffm: 'notify_err', err: String((e as Error)?.message || e) })); return 0; }
}

/** Idempotency claim: true only the first time a dedupe key is seen. */
export async function claim(sb: SB, row: Row): Promise<boolean> {
  const { data, error } = await sb.from('ffm_events').insert(row).select('id');
  return !error && !!(data && data.length);
}

export async function markAccount(sb: SB, acct: Row, err: string | null) {
  if (!err) { await sb.from('ffm_accounts').update({ last_error: null, last_error_at: null, last_sync_at: nowIso(), updated_at: nowIso() }).eq('id', acct.id); return; }
  await sb.from('ffm_accounts').update({ last_error: err.slice(0, 500), last_error_at: nowIso(), updated_at: nowIso() }).eq('id', acct.id);
}
/** Credential / webhook error alert — at most one per account per MYT day. */
export async function credentialAlert(sb: SB, acct: Row, what: string, err: string) {
  const ok = await claim(sb, { tenant_id: acct.tenant_id, account_id: acct.id, source: 'alert', method: 'error.' + what, dedupe_key: 'err:' + acct.id + ':' + what + ':' + mytDay(), error: err.slice(0, 500) });
  if (!ok) return;
  await notify(sb, { tenantId: acct.tenant_id, ev: 'error', ref: acct.id + ':' + what + ':' + mytDay(), kind: 'action', prio: 1,
    title: ['FFM ' + what + ' error (' + acct.label + ')', 'Ralat ' + (what === 'webhook' ? 'webhook' : 'sambungan') + ' FFM (' + acct.label + ')'],
    body: [err, err], link: { page: 'logistics', params: { view: 'ffm', tab: 'accounts' }, icon: 'ti-plug-connected-x' }, refTable: 'ffm_accounts', refId: acct.id, mods: ['__admin_only__'] });
}

// ---------- shipment status ----------
const EV_TXT: Row = {
  packed: ['FFM packed', 'FFM dibungkus'], shipped: ['FFM shipped out', 'FFM telah dihantar keluar'], delivered: ['FFM delivered', 'FFM telah sampai'],
  cancelled: ['FFM order cancelled', 'Pesanan FFM dibatalkan'], failed: ['FFM order problem', 'Masalah pesanan FFM'], returned: ['FFM return received', 'Pulangan FFM diterima'],
};
export async function applyShipment(sb: SB, ship: Row, status: string, extra: Row = {}, actorId: string | null = null): Promise<boolean> {
  const nxt = nextStatus(String(ship.status), status);
  const patch: Row = { ...extra, updated_at: nowIso() };
  if (nxt) {
    patch.status = nxt;
    if (nxt === 'shipped' && !ship.shipped_at) patch.shipped_at = nowIso();
    if (nxt === 'delivered') patch.delivered_at = nowIso();
    if (nxt === 'cancelled') patch.cancelled_at = nowIso();
    if (nxt === 'returned') patch.returned_at = nowIso();
  }
  await safeShipPatch(sb, ship, patch);
  if (!nxt) return false;
  const ds = doStatusFor(nxt);
  if (ds && ship.delivery_order_id) {
    const up: Row = { status: ds }; if (ds === 'delivered') up.delivered_at = nowIso();
    await sb.from('delivery_orders').update(up).eq('id', ship.delivery_order_id).eq('tenant_id', ship.tenant_id).not('status', 'in', '("delivered","cancelled")');
  }
  const ev = nxt === 'returned' ? 'returned' : NOTIFY_STATUS[nxt];
  if (ev) {
    const { data: d } = await sb.from('delivery_orders').select('do_no').eq('id', ship.delivery_order_id).maybeSingle();
    const ref = d?.do_no || ship.order_sn, why = String(extra.state_text || extra.last_error || '');
    const doId = ship.delivery_order_id;
    await notify(sb, { tenantId: ship.tenant_id, actorId, ev, ref: ship.id + ':' + nxt, kind: ev === 'failed' ? 'action' : 'for_you', prio: ev === 'failed' ? 1 : 0,
      title: [EV_TXT[ev][0] + ': ' + ref, EV_TXT[ev][1] + ': ' + ref], body: why ? [why, why] : undefined,
      link: { page: 'logistics', params: doId ? { view: 'do-detail', id: doId } : { view: 'ffm', tab: 'daily' }, icon: 'ti-truck-delivery' }, refTable: doId ? 'delivery_orders' : 'ffm_shipments', refId: doId || ship.id });
  }
  return true;
}

/** Poll one shipment via /order/getOrderStatusByNo (works with or without webhook). */
export async function pollShipment(sb: SB, acct: Row, sec: Row | null, ship: Row): Promise<Row> {
  const r = await ffmCall(acct, sec, '/order/getOrderStatusByNo', ship.ffm_order_id ? { deliverySn: ship.ffm_order_id } : { orderSn: ship.order_sn });
  const d = r.data || {}, steps: Row[] = Array.isArray(d.statusDetail) ? d.statusDetail : [];
  const lastStep = steps.length ? steps[steps.length - 1] : null;
  const st = lastStep ? POLL_STATE[Number(lastStep.status)] : null;
  const extra: Row = { last_polled_at: nowIso() };
  if (d.expressSn) extra.pno = d.expressSn;
  if (d.expressCompany) extra.courier = String(d.expressCompany).slice(0, 80);
  const goods = extractGoods(d);
  if (goods.length && !(Array.isArray(ship.goods) && ship.goods.length)) extra.goods = goods;
  if (lastStep) extra.state_text = String(lastStep.statusDesc || d.status || '');
  const nxt = st || null;
  if ((nxt === 'awaiting_pickup' || nxt === 'shipped' || nxt === 'delivered') && !ship.pickup_at) extra.pickup_at = nowIso();
  if (st) await applyShipment(sb, ship, st, extra); else await safeShipPatch(sb, ship, extra);
  return { status: d.status || '', expressSn: d.expressSn || '', expressCompany: d.expressCompany || '', steps, goods };
}


// ---------- safe shipment writes (new columns courier/pickup_at/source appear only after SQL) ----------
const NEW_SHIP_COLS = ['courier', 'pickup_at', 'source'];
function stripNewShipCols(row: Row): Row { const o = { ...row }; for (const k of NEW_SHIP_COLS) delete o[k]; return o; }
function missingCol(err: { message?: string } | null, keys: string[]): boolean {
  const m = String(err?.message || '');
  return keys.some((k) => m.includes(k)) || /column|schema cache|could not find/i.test(m);
}
export async function safeShipPatch(sb: SB, ship: Row, patch: Row): Promise<void> {
  let r = await sb.from('ffm_shipments').update(patch).eq('id', ship.id).eq('tenant_id', ship.tenant_id);
  if (!r.error) { Object.assign(ship, patch); return; }
  if (!missingCol(r.error, NEW_SHIP_COLS)) throw new Error(r.error.message);
  r = await sb.from('ffm_shipments').update(stripNewShipCols(patch)).eq('id', ship.id).eq('tenant_id', ship.tenant_id);
  if (r.error) throw new Error(r.error.message);
  Object.assign(ship, stripNewShipCols(patch));
}

function ymdAdd(day: string, n: number): string {
  const t0 = Date.parse(day.slice(0, 10) + 'T00:00:00+08:00') + n * 86400000;
  return new Date(t0 + 8 * 3600000).toISOString().slice(0, 10);
}

/** Create a skeleton ffm_shipments row for an FFM-native order (no M-Core DO). Returns null if SQL not applied yet. */
export async function ensureImportedShipment(sb: SB, acct: Row, p: Row): Promise<Row | null> {
  const ffmId = String(p.orderId || p.deliverySn || '').trim();
  const orderSn = String(p.outTradeNo || p.orderSn || ffmId || '').trim();
  if (!orderSn && !ffmId) return null;
  const existing = await findImported(sb, acct, { order_sn: orderSn, ffm_order_id: ffmId });
  if (existing) return existing;
  const st = listStatusOf(p.stateText || p.status) || WEBHOOK_STATE[Number(p.state)] || 'created';
  const row: Row = {
    tenant_id: acct.tenant_id, account_id: acct.id, delivery_order_id: null, order_sn: orderSn || ffmId,
    ffm_order_id: ffmId || null, status: st, state: p.state != null ? Number(p.state) : null,
    state_text: String(p.stateText || p.message || p.status || '').slice(0, 200),
    pno: p.pno ? String(p.pno) : (p.expressSn ? String(p.expressSn) : null),
    recent_pno: p.recentPno ? String(p.recentPno) : null,
    courier: p.logistic || p.expressCompany ? String(p.logistic || p.expressCompany).slice(0, 80) : null,
    goods: extractGoods(p), total_amount: Number(p.total_price ?? p.totalPrice ?? p.totalAmount ?? 0) || 0,
    source: 'ffm_import', created_at: nowIso(), updated_at: nowIso(), deleted_at: null,
  };
  if (st === 'shipped' || st === 'delivered') row.shipped_at = nowIso();
  if (st === 'cancelled') row.cancelled_at = nowIso();
  const ins = await sb.from('ffm_shipments').insert(row).select('*').single();
  if (!ins.error) return ins.data;
  if (/duplicate|unique/i.test(ins.error.message || '')) return await findImported(sb, acct, { order_sn: orderSn, ffm_order_id: ffmId });
  if (missingCol(ins.error, ['delivery_order_id', 'source', 'courier', 'pickup_at'])) {
    console.warn(JSON.stringify({ ffm: 'import_schema', err: ins.error.message }));
    return null;
  }
  console.warn(JSON.stringify({ ffm: 'import_insert', err: ins.error.message }));
  return null;
}
async function findImported(sb: SB, acct: Row, ids: { order_sn?: string; ffm_order_id?: string }): Promise<Row | null> {
  if (ids.ffm_order_id) {
    const { data } = await sb.from('ffm_shipments').select('*').eq('account_id', acct.id).eq('ffm_order_id', ids.ffm_order_id).is('deleted_at', null).maybeSingle();
    if (data) return data;
  }
  if (ids.order_sn) {
    const { data } = await sb.from('ffm_shipments').select('*').eq('account_id', acct.id).eq('order_sn', ids.order_sn).is('deleted_at', null).maybeSingle();
    if (data) return data;
  }
  return null;
}

/** Pull /order/getOrderList into ffm_shipments (idempotent on account_id + order_sn). Does not write products.stock_qty. */
export async function importOrders(sb: SB, acct: Row, sec: Row | null, opts: Row = {}): Promise<Row> {
  const to = String(opts.to || mytDay()).slice(0, 10);
  const from = String(opts.from || ymdAdd(to, -45)).slice(0, 10);
  const maxPages = Math.min(20, Number(opts.max_pages || 12) || 12);
  let page = 1, upserted = 0, detailed = 0, skipped = 0;
  const needDetail: Row[] = [];
  for (; page <= maxPages; page++) {
    const body: Row = { startTime: from, endTime: to, page: String(page), limit: '50' };
    const r = await ffmCall(acct, sec, '/order/getOrderList', body);
    const list: Row[] = Array.isArray(r.data?.list) ? r.data.list : (Array.isArray(r.data) ? r.data : []);
    if (!list.length) break;
    for (const row of list) {
      const res = await upsertListRow(sb, acct, row);
      if (res === 'skip') { skipped++; continue; }
      if (res) { upserted++; if (!Array.isArray(res.goods) || !res.goods.length || (!res.pno && !res.courier)) needDetail.push(res); }
    }
    if (list.length < 50) break;
    await sleep(120);
  }
  const budget = Math.min(20, needDetail.length);
  for (let i = 0; i < budget; i++) {
    try { await pollShipment(sb, acct, sec, needDetail[i]); detailed++; } catch { /* next tick */ }
    await sleep(80);
  }
  return { from, to, pages: page, upserted, detailed, skipped };
}

async function upsertListRow(sb: SB, acct: Row, row: Row): Promise<Row | 'skip' | null> {
  const deliverySn = String(row.deliverySn || row.delivery_sn || '').trim();
  const orderSn = String(row.orderSn || row.outTradeNo || deliverySn || '').trim();
  if (!orderSn) return 'skip';
  const st = listStatusOf(row.status || row.statusId);
  const goods = extractGoods(row);
  const pno = String(row.expressSn || row.pno || '').trim();
  const courier = String(row.logistic || row.expressCompany || row.logisticCompany || '').trim();
  const amount = Number(row.total_price ?? row.totalPrice ?? row.totalAmount ?? 0) || 0;
  const existing = await findImported(sb, acct, { order_sn: orderSn, ffm_order_id: deliverySn });
  const extra: Row = {
    updated_at: nowIso(),
    state_text: String(row.status || row.statusText || '').slice(0, 200),
  };
  if (deliverySn) extra.ffm_order_id = deliverySn;
  if (pno) extra.pno = pno;
  if (courier) extra.courier = courier.slice(0, 80);
  if (goods.length) extra.goods = goods;
  if (amount) extra.total_amount = amount;
  if (st === 'shipped' || st === 'delivered') { extra.shipped_at = extra.shipped_at || nowIso(); if (!existing?.pickup_at) extra.pickup_at = nowIso(); }
  if (st === 'awaiting_pickup' && !existing?.pickup_at) extra.pickup_at = nowIso();
  if (existing) {
    if (st) await applyShipment(sb, existing, st, extra);
    else await safeShipPatch(sb, existing, extra);
    return existing;
  }
  const created = await ensureImportedShipment(sb, acct, {
    orderSn, orderId: deliverySn, expressSn: pno, logistic: courier, status: row.status, total_price: amount,
    goods, stateText: row.status,
  });
  if (!created) return null;
  if (st && st !== created.status) await applyShipment(sb, created, st, extra);
  else if (Object.keys(extra).length) await safeShipPatch(sb, created, extra);
  return created;
}

// ---------- stock (ffm_stock ONLY — never products.stock_qty) ----------
export async function pullStock(sb: SB, acct: Row, sec: Row | null): Promise<{ count: number; low: number; failed: { barcode: string; error: string }[] }> {
  const { data: links } = await sb.from('ffm_product_links').select('product_id,barcode').eq('account_id', acct.id).is('deleted_at', null).eq('synced_ok', true);
  const map = new Map<string, string>(); (links || []).forEach((l: Row) => { if (l.barcode) map.set(String(l.barcode), String(l.product_id)); });
  const codes = Array.from(map.keys()).filter((c) => /^[\w-]+$/.test(c));
  const failed: { barcode: string; error: string }[] = [], okCodes: string[] = [];
  const query = async (list: string[]): Promise<Row> => {
    const body: Row = { barCode: list.join(','), goodsStatus: 'normal' };
    if (acct.warehouse_id) body.warehouseId = String(acct.warehouse_id);
    return (await ffmCall(acct, sec, '/open/goodsStock', body)).data || {};
  };
  // FFM rejects the WHOLE batch (e.g. 1608 goods not exist / not enabled) when one barcode is unknown -> retry one by one so valid barcodes still load.
  const bizErr = (e: unknown) => e instanceof FfmError && /^\d+$/.test(String(e.code)) && String(e.code) !== '1002';
  let count = 0;
  for (let i = 0; i < codes.length; i += 40) {
    const chunk = codes.slice(i, i + 40); let data: Row = {};
    try { data = await query(chunk); }
    catch (e) {
      if (!bizErr(e)) throw e;
      if (chunk.length === 1) failed.push({ barcode: chunk[0], error: (e as Error).message });
      else for (const bc of chunk) {
        try { const d = await query([bc]); if (d[bc]) data[bc] = d[bc]; }
        catch (e2) { if (!bizErr(e2)) throw e2; failed.push({ barcode: bc, error: (e2 as Error).message }); }
        await sleep(120); // /open/goodsStock: 10 req / 1 s
      }
    }
    const rows: Row[] = [];
    for (const bc of chunk) {
      const s = data[bc]; if (!s) continue; okCodes.push(bc);
      rows.push({ tenant_id: acct.tenant_id, account_id: acct.id, product_id: map.get(bc) || null, barcode: bc, available_qty: Number(s.availableInventory || 0), inventory_qty: Number(s.inventory || 0), total_qty: Number(s.totalInventory || 0), synced_at: nowIso(), deleted_at: null });
    }
    if (rows.length) { const { error } = await sb.from('ffm_stock').upsert(rows, { onConflict: 'account_id,barcode' }); if (error) throw new Error(error.message); count += rows.length; }
  }
  // Per-barcode stock note on the product link (shown on Products tab); synced_ok untouched so ASN / orders are not blocked.
  for (const f of failed) await sb.from('ffm_product_links').update({ last_error: ('Stock: ' + f.error).slice(0, 300), updated_at: nowIso() }).eq('account_id', acct.id).eq('barcode', f.barcode).is('deleted_at', null);
  if (okCodes.length) await sb.from('ffm_product_links').update({ last_error: null, updated_at: nowIso() }).eq('account_id', acct.id).in('barcode', okCodes).like('last_error', 'Stock:%');
  await markAccount(sb, acct, failed.length ? 'Stock not loaded for ' + failed.map((f) => f.barcode).join(', ') + ' — ' + failed[0].error : null);
  const low = acct.low_stock_enabled === false ? 0 : await lowStock(sb, acct);
  return { count, low, failed };
}
async function lowStock(sb: SB, acct: Row): Promise<number> {
  const { data: st } = await sb.from('ffm_stock').select('product_id,barcode,available_qty').eq('account_id', acct.id).is('deleted_at', null).not('product_id', 'is', null);
  if (!st?.length) return 0;
  const { data: ps } = await sb.from('products').select('id,name_en,name_bm,reorder_point').eq('tenant_id', acct.tenant_id).is('deleted_at', null).in('id', st.map((x: Row) => x.product_id));
  const pm = new Map<string, Row>((ps || []).map((p: Row) => [String(p.id), p] as [string, Row]));
  const { data: lk } = await sb.from('ffm_product_links').select('product_id,pcs_per_unit').eq('account_id', acct.id).is('deleted_at', null);
  const ppu = new Map<string, number>((lk || []).map((l: Row) => [String(l.product_id), ppuOf(l.pcs_per_unit)] as [string, number]));
  let n = 0;
  for (const s of st) {
    const p: Row | undefined = pm.get(String(s.product_id)); if (!p) continue;
    const rp = p.reorder_point == null ? 5 : Number(p.reorder_point);
    const k = ppu.get(String(s.product_id)) || 1, pcs = unitsToPcs(s.available_qty, k); // reorder_point is in M-Core pcs
    if (pcs > rp) continue;
    const day = mytDay();
    if (!(await claim(sb, { tenant_id: acct.tenant_id, account_id: acct.id, source: 'cron', method: 'low_stock', dedupe_key: 'low:' + acct.id + ':' + p.id + ':' + day }))) continue;
    n++;
    const nm = p.name_en || s.barcode, nb = p.name_bm || nm;
    await notify(sb, { tenantId: acct.tenant_id, ev: 'low_stock', ref: acct.id + ':' + p.id + ':' + day, prio: 0,
      title: ['FFM low stock (' + acct.label + '): ' + nm, 'Stok FFM rendah (' + acct.label + '): ' + nb],
      body: ['Available ' + qtyTxt(s.available_qty, k, 'en') + ' ≤ reorder point ' + rp + ' pcs', 'Tersedia ' + qtyTxt(s.available_qty, k, 'bm') + ' ≤ paras pesanan semula ' + rp + ' pcs'],
      link: { page: 'logistics', params: { view: 'ffm', tab: 'stock' }, icon: 'ti-box' }, refTable: 'products', refId: p.id, mods: ['logistics', 'inventory'] });
  }
  return n;
}

/** '36 ctn (864 pcs)' / '36 ktn (864 pcs)'; 'unit' when pcs_per_unit = 1. */
export function qtyTxt(units: unknown, ppu: unknown, lg: string): string {
  const k = ppuOf(ppu), u = Number(units || 0);
  return u + ' ' + (k > 1 ? (lg === 'bm' ? 'ktn' : 'ctn') : 'unit') + ' (' + unitsToPcs(u, k) + ' pcs)';
}

// ---------- ASN ----------
export async function pollAsn(sb: SB, acct: Row, sec: Row | null, asn: Row): Promise<Row> {
  const r = await ffmCall(acct, sec, '/Inbound/getInBoundDetail', asn.ffm_order_id ? { inboundSn: asn.ffm_order_id } : { orderSn: asn.order_sn });
  const d = Array.isArray(r.data) ? r.data[0] : r.data;
  if (!d) return { status: null };
  await applyAsn(sb, acct, sec, asn, Number(d.status), Array.isArray(d.goodsList) ? d.goodsList.map((g: Row) => ({ barCode: g.barCode, number: g.number, inNum: g.inNum, normalNum: g.normalNum, badNum: g.badNum })) : null);
  return { status: Number(d.status), goods: d.goodsList || [] };
}
export async function applyAsn(sb: SB, acct: Row, sec: Row | null, asn: Row, status: number, received: Row[] | null) {
  const patch: Row = { status, status_text: ({ 10: 'Pending approval', 20: 'Verified', 30: 'Arrived', 40: 'Receiving', 50: 'Receipt completed' } as Row)[status] || String(status), last_polled_at: nowIso(), updated_at: nowIso() };
  if (received) patch.received_goods = received;
  const first = status === 50 && !asn.received_at;
  if (first) patch.received_at = nowIso();
  await sb.from('ffm_asn').update(patch).eq('id', asn.id).eq('tenant_id', asn.tenant_id);
  if (!first) return;
  try { await pullStock(sb, acct, sec); } catch (e) { console.warn('ffm asn stock pull', (e as Error)?.message); }
  const { data: po } = await sb.from('purchase_orders').select('po_no').eq('id', asn.purchase_order_id).maybeSingle();
  const ref = po?.po_no || asn.order_sn;
  await notify(sb, { tenantId: asn.tenant_id, ev: 'asn_received', ref: asn.id, title: ['FFM ASN received: ' + ref + ' (' + acct.label + ')', 'ASN FFM diterima: ' + ref + ' (' + acct.label + ')'],
    body: ['FFM confirmed receipt — FFM stock updated.', 'FFM sahkan terima — stok FFM dikemas kini.'], link: { page: 'purchasing', params: { view: 'po-detail', id: asn.purchase_order_id }, icon: 'ti-building-warehouse' },
    refTable: 'purchase_orders', refId: asn.purchase_order_id, mods: ['logistics', 'purchasing'] });
}

export const isLive = (s: string) => !TERMINAL.includes(String(s)) && s !== 'sending';

// ---------- daily reconciliation: products.stock_qty (M-Core) vs SUM(ffm_stock.total_qty × link.pcs_per_unit) in pcs across the tenant's FFM accounts ----------
export async function reconTenant(sb: SB, tenantId: string, actorId: string | null = null): Promise<Row> {
  const day = mytDay();
  const { data: accts } = await sb.from('ffm_accounts').select('id,label').eq('tenant_id', tenantId).is('deleted_at', null).eq('is_active', true);
  const ids = (accts || []).map((a: Row) => a.id);
  if (!ids.length) return { run_date: day, product_count: 0, diff_count: 0 };
  const { data: st } = await sb.from('ffm_stock').select('account_id,product_id,total_qty,available_qty').in('account_id', ids).is('deleted_at', null).not('product_id', 'is', null);
  const { data: lk } = await sb.from('ffm_product_links').select('account_id,product_id,pcs_per_unit').in('account_id', ids).is('deleted_at', null);
  const ppu = new Map<string, number>((lk || []).map((l: Row) => [l.account_id + ':' + l.product_id, ppuOf(l.pcs_per_unit)] as [string, number]));
  const agg = new Map<string, Row>();
  for (const s of st || []) { // FFM qty is in FFM units -> pcs (× pcs_per_unit of that account's link); M-Core stock_qty is pcs
    const k = String(s.product_id), a = agg.get(k) || { total: 0, available: 0, by: {} as Row, units: {} as Row }, f = ppu.get(s.account_id + ':' + s.product_id) || 1;
    const tp = unitsToPcs(s.total_qty, f);
    a.total += tp; a.available += unitsToPcs(s.available_qty, f); a.by[String(s.account_id)] = tp; a.units[String(s.account_id)] = { units: Number(s.total_qty || 0), ppu: f }; agg.set(k, a);
  }
  const pids = Array.from(agg.keys());
  const { data: ps } = pids.length ? await sb.from('products').select('id,code,name_en,name_bm,stock_qty').eq('tenant_id', tenantId).is('deleted_at', null).in('id', pids) : { data: [] };
  const rows: Row[] = [];
  for (const p of ps || []) {
    const a = agg.get(String(p.id)); if (!a) continue;
    const m = Number(p.stock_qty || 0), diff = Math.round((m - a.total) * 1000) / 1000;
    rows.push({ product_id: p.id, code: p.code || '', name_en: p.name_en || '', name_bm: p.name_bm || '', mcore_qty: m, ffm_total: a.total, ffm_available: a.available, by_account: a.by, by_account_units: a.units, diff });
  }
  rows.sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));
  const diffCount = rows.filter((r) => r.diff !== 0).length;
  await sb.from('ffm_recon_runs').upsert({ tenant_id: tenantId, run_date: day, product_count: rows.length, diff_count: diffCount, rows, created_at: nowIso(), deleted_at: null }, { onConflict: 'tenant_id,run_date' });
  if (diffCount > 0 && (await claim(sb, { tenant_id: tenantId, source: 'cron', method: 'recon', dedupe_key: 'recon:' + tenantId + ':' + day }))) {
    await notify(sb, { tenantId, actorId, ev: 'recon', ref: tenantId + ':' + day, kind: 'action',
      title: ['FFM reconciliation: ' + diffCount + ' stock difference(s)', 'Rekonsiliasi FFM: ' + diffCount + ' perbezaan stok'],
      body: ['M-Core stock vs FFM warehouse — ' + day, 'Stok M-Core vs gudang FFM — ' + day],
      link: { page: 'logistics', params: { view: 'ffm', tab: 'recon' }, icon: 'ti-scale' }, refTable: 'ffm_recon_runs', mods: ['logistics', 'inventory'] });
  }
  return { run_date: day, product_count: rows.length, diff_count: diffCount };
}
