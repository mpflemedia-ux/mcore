// ffm-api — authenticated FFM operations for M-Core (JWT required; verify_jwt default on).
// Credentials are WRITE-ONLY: save_account stores mchId/key server-side; nothing secret is ever returned.
import {
  applyShipment, CORS, credentialAlert, FfmError, ffmCall, hasModule, isAdminRole, json, loadAccount, markAccount,
  notify, nowIso, pollAsn, pollShipment, pullStock, reconTenant, SB, sbAdmin, tenantEnabled,
} from '../_shared/ffm-core.ts';
import { barcodeOk, CANCELLABLE, ean13Ok, maskMch, normBaseUrl, normState, normUrlHost, orderSnFor, pcsToUnits, ppuOf, Row, same, toMinor, feeFromDetail, validateConsignee } from '../_shared/ffm-logic.ts';

const SAFE_FIELDS = ['label', 'base_url', 'api_prefix', 'sign_mode', 'warehouse_id', 'store_code', 'order_source_platform', 'pay_mode', 'amount_multiplier', 'accept_language', 'source_from',
  'auto_approve', 'low_stock_enabled', 'is_funded', 'sales_plan_id', 'fee_source', 'tracking_url_template', 'is_active'];
const SECRET_FIELDS = ['mch_id', 'api_key', 'webhook_app_key', 'webhook_app_secret', 'webhook_app_code'];
const ACCT_COLS = 'id,tenant_id,label,base_url,api_prefix,sign_mode,mch_id_masked,has_api_key,has_webhook_secret,warehouse_id,store_code,order_source_platform,pay_mode,amount_multiplier,accept_language,source_from,auto_approve,low_stock_enabled,is_funded,sales_plan_id,fee_source,tracking_url_template,is_active,last_sync_at,last_error,last_error_at,created_at,updated_at';

class HttpErr extends Error { status: number; constructor(s: number, m: string) { super(m); this.status = s; } }
const need = (c: unknown, m: string, s = 400) => { if (!c) throw new HttpErr(s, m); };

interface Ctx { sb: SB; user: Row; tenantId: string; roles: Row; lang: string }
const tl = (c: Ctx, en: string, bm: string) => (c.lang === 'bm' ? bm : en);

async function auth(req: Request, body: Row): Promise<Ctx> {
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  need(jwt, 'Not signed in', 401);
  const sb = sbAdmin();
  const { data: u, error } = await sb.auth.getUser(jwt);
  need(!error && u?.user?.id, 'Invalid session', 401);
  const { data: prof } = await sb.from('user_profiles').select('*').eq('id', u.user.id).maybeSingle();
  need(prof && !prof.deleted_at && prof.is_active !== false, 'No active profile', 403);
  const pa = String(prof.role || '').toLowerCase() === 'platform_admin';
  const tenantId = pa && body.tenant_id ? String(body.tenant_id) : String(prof.tenant_id || '');
  need(tenantId, 'No tenant', 403);
  need(pa || (await tenantEnabled(sb, tenantId)), 'Flash Fulfillment is not enabled for this company', 403);
  const { data: ten } = await sb.from('tenants').select('config').eq('id', tenantId).maybeSingle();
  return { sb, user: prof, tenantId, roles: (ten?.config && ten.config.roles) || {}, lang: String(body.lang || prof.language || '') === 'bm' ? 'bm' : 'en' };
}
const requireAdmin = (c: Ctx) => need(isAdminRole(c.user.role), 'Owner/admin only', 403);
const requireMod = (c: Ctx, mods: string[]) => need(hasModule(c.user, c.roles, mods), 'No access', 403);

async function acctOf(c: Ctx, id: unknown) { need(id, 'account_id required'); return await loadAccount(c.sb, String(id), c.tenantId); }
async function shipOf(c: Ctx, id: unknown) {
  need(id, 'shipment_id required');
  const { data } = await c.sb.from('ffm_shipments').select('*').eq('id', String(id)).eq('tenant_id', c.tenantId).is('deleted_at', null).maybeSingle();
  need(data, 'Shipment not found', 404); return data as Row;
}
const errMsg = (e: unknown) => String((e as Error)?.message || e);
async function onFfmErr(c: Ctx, acct: Row, e: unknown) {
  if (e instanceof FfmError && [1001, 1002, 1669, 'no_credentials'].some((k) => String(k) === String(e.code))) { await markAccount(c.sb, acct, e.message); await credentialAlert(c.sb, acct, 'connection', e.message); }
}

// ---------- accounts ----------
async function saveAccount(c: Ctx, b: Row) {
  requireAdmin(c);
  const row: Row = {};
  for (const k of SAFE_FIELDS) if (k in b) row[k] = b[k];
  if ('label' in row) { row.label = String(row.label || '').trim().slice(0, 60); need(row.label, 'Label required'); }
  if ('sign_mode' in row) need(['json', 'form'].includes(row.sign_mode), 'sign_mode json|form');
  if ('fee_source' in row) need(['shipping', 'manual'].includes(row.fee_source), 'fee_source shipping|manual');
  if ('pay_mode' in row) need(['1', '2', '3'].includes(String(row.pay_mode)), 'pay_mode 1|2|3');
  if ('amount_multiplier' in row) { row.amount_multiplier = Number(row.amount_multiplier); need([1, 100].includes(row.amount_multiplier), 'amount_multiplier 1|100'); }
  if ('base_url' in row) { row.base_url = normBaseUrl(row.base_url); need(/^https:\/\/[\w.-]+(\/[\w./-]*)?$/.test(row.base_url), 'base_url must be https'); }
  if ('api_prefix' in row) need(/^(\/[\w.-]+)*$/.test(String(row.api_prefix || '')), 'api_prefix like /open/v2 or empty');
  if ('tracking_url_template' in row) { row.tracking_url_template = normUrlHost(row.tracking_url_template) || null; need(!row.tracking_url_template || /^https:\/\/\S+\{pno\}\S*$/.test(row.tracking_url_template), 'Tracking URL must be https and contain {pno}'); }
  if (row.sales_plan_id === '') row.sales_plan_id = null;
  if (row.sales_plan_id) { const { data: sp } = await c.sb.from('sales_plans').select('id').eq('id', row.sales_plan_id).eq('tenant_id', c.tenantId).maybeSingle(); need(sp, 'Sales Plan not found'); }
  const sec: Row = {};
  for (const k of SECRET_FIELDS) { const v = String(b[k] ?? '').trim(); if (v) sec[k] = v.slice(0, 500); } // empty = keep existing
  let id = b.id ? String(b.id) : '';
  if (id) {
    const { data: ex } = await c.sb.from('ffm_accounts').select('id').eq('id', id).eq('tenant_id', c.tenantId).is('deleted_at', null).maybeSingle();
    need(ex, 'Account not found', 404);
    if (Object.keys(row).length) { const { error } = await c.sb.from('ffm_accounts').update({ ...row, updated_at: nowIso() }).eq('id', id); need(!error, error?.message || 'save failed'); }
  } else {
    need(row.label, 'Label required');
    const { data: ins, error } = await c.sb.from('ffm_accounts').insert({ ...row, tenant_id: c.tenantId, created_by: c.user.id }).select('id').single();
    need(!error, error?.message?.includes('ffm_accounts_label_uidx') ? 'Label already used' : (error?.message || 'save failed'));
    id = ins.id;
  }
  if (Object.keys(sec).length) {
    const { data: cur } = await c.sb.from('ffm_account_secrets').select('*').eq('account_id', id).maybeSingle();
    const merged = { ...(cur || {}), ...sec, account_id: id, tenant_id: c.tenantId, updated_by: c.user.id, updated_at: nowIso() };
    const { error } = await c.sb.from('ffm_account_secrets').upsert(merged, { onConflict: 'account_id' });
    need(!error, error?.message || 'secret save failed');
    await c.sb.from('ffm_accounts').update({ mch_id_masked: maskMch(merged.mch_id), has_api_key: !!merged.api_key, has_webhook_secret: !!merged.webhook_app_secret, last_error: null, last_error_at: null, updated_at: nowIso() }).eq('id', id);
  }
  const { data: out } = await c.sb.from('ffm_accounts').select(ACCT_COLS).eq('id', id).single();
  return { account: out };
}
async function deleteAccount(c: Ctx, b: Row) {
  requireAdmin(c);
  const { acct } = await acctOf(c, b.account_id || b.id);
  await c.sb.from('ffm_accounts').update({ deleted_at: nowIso(), is_active: false, mch_id_masked: null, has_api_key: false, has_webhook_secret: false, updated_at: nowIso() }).eq('id', acct.id);
  await c.sb.from('ffm_account_secrets').update({ mch_id: null, api_key: null, webhook_app_key: null, webhook_app_secret: null, webhook_app_code: null, updated_by: c.user.id, updated_at: nowIso() }).eq('account_id', acct.id);
  return { ok: true };
}
async function testAccount(c: Ctx, b: Row) {
  requireAdmin(c);
  const { acct, sec } = await acctOf(c, b.account_id || b.id);
  try {
    const w = await ffmCall(acct, sec, '/open/getWarehouseList', {});
    let stores: Row[] = [];
    try { const s = await ffmCall(acct, sec, '/order/getStoreList', {}); stores = (Array.isArray(s.data) ? s.data : []).map((x: Row) => ({ storeCode: x.storeCode, storeName: x.storeName, platform: x.platformSourceName, status: x.status })); } catch (_) { /* optional */ }
    await markAccount(c.sb, acct, null);
    return { ok: true, warehouses: (Array.isArray(w.data) ? w.data : []).map((x: Row) => ({ id: x.id, name: x.name, warehouseNo: x.warehouseNo })), stores };
  } catch (e) { await onFfmErr(c, acct, e); throw e; }
}

// ---------- products (barcode) ----------
async function syncProducts(c: Ctx, b: Row) {
  requireMod(c, ['logistics', 'inventory']);
  const { acct, sec } = await acctOf(c, b.account_id);
  let q = c.sb.from('products').select('id,code,name_en,name_bm,unit_price,barcode,image_url').eq('tenant_id', c.tenantId).is('deleted_at', null);
  if (Array.isArray(b.product_ids) && b.product_ids.length) q = q.in('id', b.product_ids.slice(0, 100).map(String));
  const { data: prods } = await q.limit(500);
  const { data: lks } = await c.sb.from('ffm_product_links').select('product_id,barcode').eq('account_id', acct.id).is('deleted_at', null);
  const lbc = new Map<string, string>((lks || []).map((l: Row) => [String(l.product_id), String(l.barcode || '').trim()] as [string, string]));
  const bcOf = (p: Row) => lbc.get(String(p.id)) || String(p.barcode || '').trim(); // per-account link barcode, else products.barcode
  const withBc = (prods || []).filter((p: Row) => bcOf(p));
  const skipped = (prods || []).length - withBc.length, todo = withBc.slice(0, 100), failed: Row[] = [];
  let ok = 0;
  for (const p of todo) {
    const bc = bcOf(p), body: Row = { barCode: bc, name: String(p.name_en || p.name_bm || p.code || bc).slice(0, 100), price: toMinor(p.unit_price, acct.amount_multiplier) };
    if (p.code) body.goodsCode = String(p.code);
    if (p.image_url && /^https?:\/\//.test(p.image_url)) body.image = p.image_url;
    let err = '';
    try { await ffmCall(acct, sec, '/open/add_goods', body); }
    catch (e) {
      if (e instanceof FfmError && String(e.code) === '1002') { await onFfmErr(c, acct, e); throw e; }
      try { await ffmCall(acct, sec, '/open/edit_goods', body); } catch (e2) { err = errMsg(e2) + ' | add: ' + errMsg(e); }
    }
    await c.sb.from('ffm_product_links').upsert({ tenant_id: c.tenantId, account_id: acct.id, product_id: p.id, barcode: bc, synced_ok: !err, last_synced_at: nowIso(), last_error: err ? err.slice(0, 300) : null, updated_at: nowIso(), deleted_at: null }, { onConflict: 'account_id,product_id' });
    if (err) failed.push({ product_id: p.id, name: p.name_en || bc, error: err.slice(0, 200) }); else ok++;
  }
  await markAccount(c.sb, acct, null);
  return { ok, failed, skipped_no_barcode: skipped, remaining: Math.max(0, withBc.length - todo.length) };
}

/** Per-account FFM barcode + pcs per FFM unit for one product. Barcode change => needs re-sync; stale FFM stock row for the old barcode is soft-deleted. */
async function saveLink(c: Ctx, b: Row) {
  requireMod(c, ['logistics', 'inventory']);
  const { acct } = await acctOf(c, b.account_id);
  need(b.product_id, 'product_id required');
  const pid = String(b.product_id), bc = String(b.barcode ?? '').trim(), ppu = Number(b.pcs_per_unit ?? 1);
  need(barcodeOk(bc), tl(c, 'Barcode: letters and digits only (max 40).', 'Barkod: huruf dan digit sahaja (maks 40).'));
  need(Number.isInteger(ppu) && ppu >= 1 && ppu <= 100000, tl(c, 'Pcs per unit must be a whole number of 1 or more.', 'Pcs seunit mesti nombor bulat 1 atau lebih.'));
  const { data: prod } = await c.sb.from('products').select('id,name_en').eq('id', pid).eq('tenant_id', c.tenantId).is('deleted_at', null).maybeSingle();
  need(prod, 'Product not found', 404);
  const { data: lks } = await c.sb.from('ffm_product_links').select('product_id,barcode').eq('account_id', acct.id).is('deleted_at', null);
  const mine = (lks || []).find((l: Row) => same(l.product_id, pid));
  let clash = (lks || []).find((l: Row) => !same(l.product_id, pid) && String(l.barcode).trim() === bc)?.product_id;
  if (!clash) { // products without a link on this account fall back to products.barcode
    const { data: ps } = await c.sb.from('products').select('id').eq('tenant_id', c.tenantId).is('deleted_at', null).eq('barcode', bc).neq('id', pid);
    clash = (ps || []).find((p: Row) => !(lks || []).some((l: Row) => same(l.product_id, p.id)))?.id;
  }
  if (clash) {
    const { data: o } = await c.sb.from('products').select('name_en').eq('id', clash).maybeSingle();
    need(false, tl(c, 'Barcode ' + bc + ' is already used on ' + acct.label + ' by "' + (o?.name_en || 'another product') + '".', 'Barkod ' + bc + ' sudah digunakan di ' + acct.label + ' oleh "' + (o?.name_en || 'produk lain') + '".'), 409);
  }
  const changed = !mine || String(mine.barcode).trim() !== bc;
  const row: Row = { tenant_id: c.tenantId, account_id: acct.id, product_id: pid, barcode: bc, pcs_per_unit: ppu, updated_at: nowIso(), deleted_at: null };
  if (changed) { row.synced_ok = false; row.last_error = null; }
  const { error } = await c.sb.from('ffm_product_links').upsert(row, { onConflict: 'account_id,product_id' });
  need(!error, error?.message?.includes('ffm_product_links_bc_uidx') ? tl(c, 'Barcode already used on this account.', 'Barkod sudah digunakan di akaun ini.') : (error?.message || 'save failed'), error?.message?.includes('bc_uidx') ? 409 : 400);
  if (changed && mine) await c.sb.from('ffm_stock').update({ deleted_at: nowIso() }).eq('account_id', acct.id).eq('product_id', pid).neq('barcode', bc).is('deleted_at', null);
  return { ok: true, resync: changed, ean13_warning: !ean13Ok(bc) };
}

// ---------- DO -> addOrder ----------
async function doGoods(c: Ctx, doRow: Row, acctId: string) {
  need(doRow.invoice_id, 'DO has no linked invoice — FFM needs items');
  const { data: items } = await c.sb.from('invoice_items').select('product_id,description,qty,unit_price,line_total').eq('invoice_id', doRow.invoice_id).eq('tenant_id', c.tenantId);
  const pids = (items || []).map((i: Row) => i.product_id).filter(Boolean);
  need(pids.length, 'Invoice has no product lines');
  const [{ data: prods }, { data: links }] = await Promise.all([
    c.sb.from('products').select('id,name_en,barcode').eq('tenant_id', c.tenantId).in('id', pids),
    c.sb.from('ffm_product_links').select('product_id,barcode,pcs_per_unit,synced_ok').eq('account_id', acctId).is('deleted_at', null).in('product_id', pids),
  ]);
  const pm = new Map<string, Row>((prods || []).map((p: Row) => [String(p.id), p] as [string, Row])), lm = new Map<string, Row>((links || []).map((l: Row) => [String(l.product_id), l] as [string, Row]));
  const goods = new Map<string, Row>(), problems: string[] = [];
  let total = 0;
  for (const it of items || []) {
    if (!it.product_id) continue;
    const p: Row | undefined = pm.get(String(it.product_id)), l = lm.get(String(it.product_id)), bc = String(l?.barcode || p?.barcode || '').trim();
    if (!bc) { problems.push((p?.name_en || it.description || 'item') + ': no barcode'); continue; }
    if (!l?.synced_ok) { problems.push((p?.name_en || bc) + ': not synced to this FFM account'); continue; }
    const g = goods.get(bc) || { barCode: bc, pcs: 0, amount: 0, ppu: ppuOf(l.pcs_per_unit), name: p?.name_en || it.description || bc };
    g.pcs += Number(it.qty || 0); g.amount += Number(it.line_total ?? (Number(it.qty || 0) * Number(it.unit_price || 0))); goods.set(bc, g); // invoice qty = M-Core pcs
  }
  for (const g of goods.values()) { // pcs -> FFM units ONCE here; never rounded
    const u = pcsToUnits(g.pcs, g.ppu);
    if (!u.ok) problems.push(tl(c, g.name + ': ' + g.pcs + ' pcs is not a whole number of FFM units (1 unit = ' + g.ppu + ' pcs). Change the quantity to a multiple of ' + g.ppu + '.',
      g.name + ': ' + g.pcs + ' pcs bukan bilangan unit FFM yang bulat (1 unit = ' + g.ppu + ' pcs). Tukar kuantiti kepada gandaan ' + g.ppu + '.'));
    g.num = u.units;
  }
  total = Array.from(goods.values()).reduce((a, g) => a + g.amount, 0);
  return { goods: Array.from(goods.values()).filter((g) => g.num > 0), problems, total };
}

async function sendOrder(c: Ctx, b: Row) {
  requireMod(c, ['logistics']);
  const { acct, sec } = await acctOf(c, b.account_id);
  need(acct.is_active !== false, 'Account inactive');
  need(acct.store_code, 'Set Store code on this FFM account first (Accounts → Test connection)');
  need(b.do_id, 'do_id required');
  const { data: doRow } = await c.sb.from('delivery_orders').select('*').eq('id', String(b.do_id)).eq('tenant_id', c.tenantId).maybeSingle();
  need(doRow && !doRow.deleted_at, 'DO not found', 404);
  need(!['delivered', 'cancelled'].includes(String(doRow.status)), 'DO already ' + doRow.status);
  const cons: Row = { name: String(b.consignee?.name || '').trim(), phone: String(b.consignee?.phone || '').trim(), address: String(b.consignee?.address || '').trim(), city: String(b.consignee?.city || '').trim(), district: String(b.consignee?.district || '').trim(), state: normState(b.consignee?.state), postcode: String(b.consignee?.postcode || '').trim() };
  const bad = validateConsignee(cons);
  if (bad.length) return { ok: false, invalid: bad };
  const { goods, problems, total } = await doGoods(c, doRow, acct.id);
  if (problems.length || !goods.length) return { ok: false, problems: problems.length ? problems : ['No FFM goods'] };
  const { data: prior } = await c.sb.from('ffm_shipments').select('id,status').eq('delivery_order_id', doRow.id).is('deleted_at', null);
  need(!(prior || []).some((s: Row) => !['failed', 'cancelled'].includes(String(s.status))), 'This DO already has a live FFM order');
  const orderSn = orderSnFor(doRow.do_no || doRow.id, (prior || []).length);
  const payMode = String(b.pay_mode || acct.pay_mode || '2'), mult = acct.amount_multiplier || 100;
  const ffmGoods = goods.map((g) => ({ barCode: g.barCode, num: String(g.num), price: toMinor(g.num ? g.amount / g.num : 0, mult), discountPrice: '0', externalName: String(g.name).slice(0, 100) })); // num = FFM units, price per FFM unit
  const keptGoods = goods.map((g, i) => ({ ...ffmGoods[i], pcs_per_unit: g.ppu, pcs: g.pcs })); // stored copy for display (units + pcs); FFM body stays clean
  const { data: ship, error: insErr } = await c.sb.from('ffm_shipments').insert({ tenant_id: c.tenantId, account_id: acct.id, delivery_order_id: doRow.id, invoice_id: doRow.invoice_id, order_sn: orderSn, status: 'sending', consignee: cons, goods: keptGoods, total_amount: total, created_by: c.user.id }).select('*').single();
  need(!insErr, insErr?.message?.includes('uidx') ? 'This DO already has a live FFM order' : (insErr?.message || 'insert failed'), 409);
  const body: Row = {
    storeCode: String(acct.store_code), orderSn, orderSourceCode: orderSn, orderSourcePlatform: acct.order_source_platform || 'Line',
    province: cons.state, city: cons.city, district: cons.district || cons.city, postalCode: cons.postcode, consigneeName: cons.name, consigneeAddress: cons.address, phoneNumber: cons.phone.replace(/[^\d+]/g, ''),
    logisticCharge: '0', totalPrice: toMinor(total, mult), payMode: Number(payMode), insured: 0, buyTime: nowIso().slice(0, 19).replace('T', ' '), check: acct.auto_approve ? 1 : 0, goods: ffmGoods,
  };
  if (acct.warehouse_id) body.warehouseId = String(acct.warehouse_id);
  if (doRow.notes) body.remark = String(doRow.notes).slice(0, 200);
  try {
    const r = await ffmCall(acct, sec, '/Order/addOrder', body, 2);
    const ffmId = typeof r.data === 'string' ? r.data : String(r.data?.deliverySn || r.data?.orderNo || r.data || '');
    await c.sb.from('ffm_shipments').update({ ffm_order_id: ffmId || null, status: 'created', state: 901, state_text: 'Created', last_error: null, updated_at: nowIso() }).eq('id', ship.id);
    await markAccount(c.sb, acct, null);
    return { ok: true, shipment_id: ship.id, ffm_order_id: ffmId, order_sn: orderSn };
  } catch (e) {
    const m = errMsg(e);
    await c.sb.from('ffm_shipments').update({ status: 'failed', last_error: m.slice(0, 500), updated_at: nowIso() }).eq('id', ship.id);
    await onFfmErr(c, acct, e);
    await notify(c.sb, { tenantId: c.tenantId, actorId: c.user.id, ev: 'failed', ref: ship.id + ':send', kind: 'action', prio: 1, title: ['FFM order failed: ' + (doRow.do_no || orderSn), 'Pesanan FFM gagal: ' + (doRow.do_no || orderSn)], body: [m, m],
      link: { page: 'logistics', params: { view: 'do-detail', id: doRow.id }, icon: 'ti-truck-delivery' }, refTable: 'delivery_orders', refId: doRow.id });
    return { ok: false, error: m, shipment_id: ship.id };
  }
}

async function cancelOrder(c: Ctx, b: Row) {
  requireMod(c, ['logistics']);
  const ship = await shipOf(c, b.shipment_id), { acct, sec } = await loadAccount(c.sb, ship.account_id, c.tenantId);
  need(CANCELLABLE.includes(String(ship.status)), 'Cannot cancel after packing (status: ' + ship.status + ')', 409);
  const fresh = await pollShipment(c.sb, acct, sec, ship).catch(() => null);
  const { data: s2 } = await c.sb.from('ffm_shipments').select('*').eq('id', ship.id).single();
  need(CANCELLABLE.includes(String(s2.status)), 'FFM already ' + s2.status + ' — cannot cancel', 409);
  await ffmCall(acct, sec, '/order/cancelOrder', s2.ffm_order_id ? { deliverySn: s2.ffm_order_id } : { orderSn: s2.order_sn }, 2);
  await applyShipment(c.sb, s2, 'cancelled', { state: 1013, state_text: 'Cancelled by ' + (c.user.full_name || 'user') }, c.user.id);
  return { ok: true, fresh: !!fresh };
}
async function label(c: Ctx, b: Row) {
  requireMod(c, ['logistics']);
  const ship = await shipOf(c, b.shipment_id), { acct, sec } = await loadAccount(c.sb, ship.account_id, c.tenantId);
  const r = await ffmCall(acct, sec, '/order/getDocument', ship.ffm_order_id ? { deliverySn: ship.ffm_order_id } : { orderSn: ship.order_sn });
  const docs: Row[] = Array.isArray(r.data?.document) ? r.data.document : [];
  const tn = docs.find((d) => d.trackNo)?.trackNo;
  if (tn && !ship.pno) await c.sb.from('ffm_shipments').update({ pno: tn, updated_at: nowIso() }).eq('id', ship.id);
  need(docs.length, 'Label not ready yet — FFM creates it after review/packing', 409);
  return { documents: docs.map((d) => ({ file: d.file, mimeType: d.mimeType || 'application/pdf', trackNo: d.trackNo || '' })) };
}
async function tracking(c: Ctx, b: Row) {
  requireMod(c, ['logistics']);
  const ship = await shipOf(c, b.shipment_id), { acct, sec } = await loadAccount(c.sb, ship.account_id, c.tenantId);
  const t = await pollShipment(c.sb, acct, sec, ship);
  const { data: s2 } = await c.sb.from('ffm_shipments').select('*').eq('id', ship.id).single();
  return { ...t, shipment: s2 };
}
async function fee(c: Ctx, b: Row) {
  requireMod(c, ['logistics', 'accounting']);
  const ship = await shipOf(c, b.shipment_id), { acct, sec } = await loadAccount(c.sb, ship.account_id, c.tenantId);
  let amt: number, raw: Row | null = null;
  if (acct.fee_source === 'manual' || b.amount != null) {
    amt = Math.round(Number(b.amount) * 100) / 100; need(isFinite(amt) && amt >= 0, 'Invalid amount');
  } else {
    const r = await ffmCall(acct, sec, '/order_fee/detail', { orderSn: ship.order_sn, deliverySn: ship.ffm_order_id || undefined });
    raw = r.data || null; amt = feeFromDetail(raw || {}, acct.amount_multiplier || 100);
  }
  await c.sb.from('ffm_shipments').update({ fee_amount: amt, fee_raw: raw, updated_at: nowIso() }).eq('id', ship.id);
  return { fee_amount: amt };
}

// ---------- ASN (PO -> arrival notice); stock counts only when FFM confirms (status 50) ----------
async function createAsn(c: Ctx, b: Row) {
  requireMod(c, ['purchasing', 'logistics']);
  const { acct, sec } = await acctOf(c, b.account_id);
  need(acct.warehouse_id, 'Set Warehouse on this FFM account first');
  const { data: po } = await c.sb.from('purchase_orders').select('*').eq('id', String(b.po_id || '')).eq('tenant_id', c.tenantId).maybeSingle();
  need(po && !po.deleted_at, 'PO not found', 404);
  const { data: items } = await c.sb.from('purchase_order_items').select('product_id,description,qty,unit_cost').eq('po_id', po.id);
  const pids = (items || []).map((i: Row) => i.product_id).filter(Boolean);
  need(pids.length, 'PO has no product lines');
  const [{ data: prods }, { data: links }] = await Promise.all([
    c.sb.from('products').select('id,name_en,barcode').eq('tenant_id', c.tenantId).in('id', pids),
    c.sb.from('ffm_product_links').select('product_id,barcode,pcs_per_unit,synced_ok').eq('account_id', acct.id).is('deleted_at', null).in('product_id', pids),
  ]);
  const pm = new Map<string, Row>((prods || []).map((p: Row) => [String(p.id), p] as [string, Row])), lm = new Map<string, Row>((links || []).map((l: Row) => [String(l.product_id), l] as [string, Row]));
  const problems: string[] = [], goods: Row[] = [];
  for (const it of items || []) {
    if (!it.product_id) continue;
    const p: Row | undefined = pm.get(String(it.product_id)), l = lm.get(String(it.product_id)), bc = String(l?.barcode || p?.barcode || '').trim();
    if (!bc) { problems.push((p?.name_en || it.description || 'item') + ': no barcode'); continue; }
    if (!l?.synced_ok) { problems.push((p?.name_en || bc) + ': not synced to this FFM account'); continue; }
    if (!(Number(it.qty) > 0)) continue;
    const k = ppuOf(l.pcs_per_unit), u = pcsToUnits(Number(it.qty), k); // PO qty = M-Core pcs -> FFM units, no rounding
    if (!u.ok) { problems.push(tl(c, (p?.name_en || bc) + ': ' + Number(it.qty) + ' pcs is not a whole number of FFM units (1 unit = ' + k + ' pcs).', (p?.name_en || bc) + ': ' + Number(it.qty) + ' pcs bukan bilangan unit FFM yang bulat (1 unit = ' + k + ' pcs).')); continue; }
    goods.push({ i: String(goods.length + 1), barCode: bc, num: String(u.units), price: toMinor(Number(it.unit_cost || 0) * k, acct.amount_multiplier) });
  }
  if (problems.length || !goods.length) return { ok: false, problems: problems.length ? problems : ['No goods'] };
  const { data: prior } = await c.sb.from('ffm_asn').select('id,status,last_error,ffm_order_id').eq('purchase_order_id', po.id).eq('account_id', acct.id).is('deleted_at', null);
  need(!(prior || []).some((a: Row) => a.ffm_order_id), 'ASN already created for this PO on this account');
  const orderSn = orderSnFor(po.po_no || po.id, (prior || []).length);
  const { data: asn, error } = await c.sb.from('ffm_asn').insert({ tenant_id: c.tenantId, account_id: acct.id, purchase_order_id: po.id, order_sn: orderSn, goods, created_by: c.user.id }).select('*').single();
  need(!error, error?.message || 'insert failed');
  const body: Row = { warehouseId: String(acct.warehouse_id), type: 1, orderSn, check: acct.auto_approve ? 1 : 0, goods };
  const fmt = (v: unknown) => String(v || '').replace('T', ' ').slice(0, 16);
  if (b.arrival_start) body.arrivalStart = fmt(b.arrival_start);
  if (b.arrival_end) body.arrivalEnd = fmt(b.arrival_end);
  try {
    const r = await ffmCall(acct, sec, '/arrival_notice/create', body, 2);
    const id = typeof r.data === 'string' ? r.data : String(r.data?.inboundSn || r.data?.orderNo || r.data || '');
    await c.sb.from('ffm_asn').update({ ffm_order_id: id || null, status: 10, status_text: 'Pending approval', updated_at: nowIso() }).eq('id', asn.id);
    return { ok: true, asn_id: asn.id, ffm_order_id: id };
  } catch (e) {
    await c.sb.from('ffm_asn').update({ last_error: errMsg(e).slice(0, 500), deleted_at: nowIso(), updated_at: nowIso() }).eq('id', asn.id);
    await onFfmErr(c, acct, e);
    return { ok: false, error: errMsg(e) };
  }
}
async function refreshAsn(c: Ctx, b: Row) {
  requireMod(c, ['purchasing', 'logistics']);
  const { data: asn } = await c.sb.from('ffm_asn').select('*').eq('id', String(b.asn_id || '')).eq('tenant_id', c.tenantId).is('deleted_at', null).maybeSingle();
  need(asn, 'ASN not found', 404);
  const { acct, sec } = await loadAccount(c.sb, asn.account_id, c.tenantId);
  return await pollAsn(c.sb, acct, sec, asn);
}

async function syncStock(c: Ctx, b: Row) {
  requireMod(c, ['logistics', 'inventory']);
  const { data: accts } = await c.sb.from('ffm_accounts').select('id').eq('tenant_id', c.tenantId).is('deleted_at', null).eq('is_active', true);
  const ids = (accts || []).map((a: Row) => String(a.id)).filter((id: string) => !b.account_id || same(id, b.account_id));
  const out: Row[] = [];
  for (const id of ids) {
    const { acct, sec } = await loadAccount(c.sb, id, c.tenantId);
    try { out.push({ account_id: id, ...(await pullStock(c.sb, acct, sec)) }); }
    catch (e) { await markAccount(c.sb, acct, errMsg(e)); await onFfmErr(c, acct, e); out.push({ account_id: id, error: errMsg(e) }); }
  }
  return { results: out };
}
async function recon(c: Ctx) { requireMod(c, ['logistics', 'inventory']); return await reconTenant(c.sb, c.tenantId, c.user.id); }

const ACTIONS: Record<string, (c: Ctx, b: Row) => Promise<Row>> = {
  save_account: saveAccount, delete_account: deleteAccount, test: testAccount, sync_products: syncProducts, send_order: sendOrder, cancel: cancelOrder,
  save_link: saveLink, label, tracking, fee, create_asn: createAsn, refresh_asn: refreshAsn, sync_stock: syncStock, recon,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  let b: Row = {};
  try { b = await req.json(); } catch { return json({ error: 'Bad JSON' }, 400); }
  const fn = ACTIONS[String(b.action || '')];
  if (!fn) return json({ error: 'Unknown action' }, 400);
  try {
    const c = await auth(req, b);
    return json(await fn(c, b));
  } catch (e) {
    const st = e instanceof HttpErr ? e.status : 502;
    if (!(e instanceof HttpErr)) console.warn(JSON.stringify({ ffm: 'api_err', action: b.action, err: errMsg(e) }));
    return json({ error: errMsg(e), code: e instanceof FfmError ? e.code : undefined }, st);
  }
});
