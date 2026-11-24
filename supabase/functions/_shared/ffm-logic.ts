// M-Core FFM connector — pure logic (no I/O): signing, webhook HMAC, state maps, validation, amounts.
// Docs: open-docs.flashfulfillment.co.th (API Standard §5/§6, Webhook signature id=27).
export type Row = Record<string, any>;
export const same = (a: unknown, b: unknown) => String(a) === String(b);
/** Trim + lowercase scheme/host (mobile keyboards auto-capitalise 'Https://Open...'); path/query kept as typed. */
export function normUrlHost(v: unknown): string { const s = String(v ?? '').trim(); const m = s.match(/^([a-z][a-z0-9+.-]*:\/\/[^/?#]*)(.*)$/i); return m ? m[1].toLowerCase() + m[2] : s; }
/** Base URL: normUrlHost + no trailing slash. */
export function normBaseUrl(v: unknown): string { return normUrlHost(v).replace(/\/+$/, ''); }

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('');

export async function sha256Upper(s: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(s))).toUpperCase();
}

/** Algorithm 1 (form): sort keys ASCII, drop sign + loose-empty (null, "", "0", 0, false, whitespace), k=v&..&key=apiKey. */
export function alg1String(params: Row, apiKey: string): string {
  const keys = Object.keys(params).filter((k) => k !== 'sign').sort();
  const parts: string[] = [];
  for (const k of keys) {
    let v = params[k];
    if (v === null || v === undefined || v === false || v === 0) continue;
    if (typeof v === 'object') v = JSON.stringify(v);
    v = String(v).trim();
    if (v === '' || v === '0') continue;
    parts.push(k + '=' + v);
  }
  return parts.join('&') + '&key=' + apiKey;
}
export async function signAlg1(params: Row, apiKey: string): Promise<string> { return sha256Upper(alg1String(params, apiKey)); }

/** Algorithm 2 (JSON): str1 = sorted query (excl. sign) as k1v1k2v2; sign = SHA256(secret + str1 + rawJson + secret).toUpperCase(). */
export function alg2String(query: Row, rawJson: string, secret: string): string {
  const str1 = Object.keys(query).filter((k) => k !== 'sign').sort().map((k) => k + String(query[k])).join('');
  return secret + str1 + rawJson + secret;
}
export async function signAlg2(query: Row, rawJson: string, secret: string): Promise<string> { return sha256Upper(alg2String(query, rawJson, secret)); }

export function nonce(len = 20): string {
  const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', r = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(r).map((x) => a[x % a.length]).join('');
}

/** Webhook: Authorization = HMAC-SHA256(appSecret, appKey + jsonStr). Accept hex (any case) or base64; constant-time compare. */
export async function hmacSign(appSecret: string, appKey: string, raw: string): Promise<{ hex: string; b64: string }> {
  const k = await crypto.subtle.importKey('raw', enc.encode(appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, enc.encode(appKey + raw));
  return { hex: hex(sig), b64: btoa(String.fromCharCode(...new Uint8Array(sig))) };
}
function ctEq(a: string, b: string): boolean { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
export async function hmacOk(header: string | null | undefined, appSecret: string, appKey: string, raw: string): Promise<boolean> {
  const h = String(header || '').trim().replace(/^(Bearer|HMAC-SHA256)\s+/i, '');
  if (!h || !appSecret) return false;
  const s = await hmacSign(appSecret, appKey || '', raw);
  return ctEq(h.toLowerCase(), s.hex) || ctEq(h, s.b64);
}

export function cleanSecret(v: string | null | undefined): string { return String(v || '').trim().replace(/^(['"])(.*)\1$/, '$2').trim(); }
export function secretOk(hdr: string | null | undefined, env: string | null | undefined): boolean { const a = cleanSecret(hdr), b = cleanSecret(env); return !!b && a === b; }

export function maskMch(m: string): string { const s = String(m || '').trim(); if (!s) return ''; return s.length <= 4 ? '••••' : '••••' + s.slice(-4); }

/** RM -> FFM minor unit (default ×100 sen; per-account amount_multiplier). */
export function toMinor(rm: unknown, mult = 100): string { const n = Number(rm || 0); return String(Math.round((isFinite(n) ? n : 0) * (Number(mult) || 100))); }
export function fromMinor(v: unknown, mult = 100): number { const n = Number(v || 0); return Math.round((isFinite(n) ? n : 0) / (Number(mult) || 100) * 100) / 100; }

/** Shipment status rank — never regress (out-of-order webhooks); cancelled/failed/returned are terminal side-states. */
export const RANK: Row = { sending: 0, failed: 0, created: 1, stock_out: 1, withdrawn: 1, verified: 2, received: 3, picked: 4, packed: 5, awaiting_pickup: 6, shipped: 7, exception: 7, delivered: 8, rejected: 8, cancelled: 9, returned: 10 };
/** deliveryOrder webhook state -> status */
export const WEBHOOK_STATE: Row = { 900: 'stock_out', 901: 'created', 910: 'withdrawn', 1001: 'verified', 1002: 'received', 1003: 'picked', 1004: 'packed', 1005: 'awaiting_pickup', 1013: 'cancelled', 1014: 'shipped' };
/** /order/getOrderStatusByNo statusDetail.status -> status */
export const POLL_STATE: Row = { 0: 'cancelled', 10: 'created', 20: 'verified', 30: 'picked', 40: 'packed', 50: 'shipped', 55: 'exception', 60: 'delivered', 70: 'rejected' };
export const TERMINAL = ['delivered', 'rejected', 'cancelled', 'returned', 'failed'];
export const CANCELLABLE = ['created', 'stock_out', 'verified', 'received', 'picked', 'withdrawn'];

export function nextStatus(cur: string, nxt: string): string | null {
  if (!nxt || nxt === cur) return null;
  if (cur === 'cancelled' || cur === 'returned') return nxt === 'returned' ? nxt : null;
  if (nxt === 'cancelled' || nxt === 'returned' || nxt === 'stock_out' || nxt === 'withdrawn' || nxt === 'exception') return nxt;
  if (cur === 'stock_out' || cur === 'withdrawn' || cur === 'exception') return nxt;
  return (RANK[nxt] ?? -1) > (RANK[cur] ?? -1) ? nxt : null;
}
/** Statuses that notify (one per event per recipient). */
export const NOTIFY_STATUS: Row = { packed: 'packed', shipped: 'shipped', delivered: 'delivered', cancelled: 'cancelled', stock_out: 'failed', exception: 'failed', rejected: 'failed' };
/** Shipment status -> delivery_orders.status (null = leave DO alone). */
export function doStatusFor(s: string): string | null { return s === 'shipped' ? 'in_transit' : s === 'delivered' ? 'delivered' : null; }

/** Return (deliveryRollbackOrder) state text. 1060 = receiving completed (stock back). */
export const RETURN_STATE: Row = { 1000: 'Cancel', 1020: 'Awaiting Approval', 1030: 'Awaiting Buyer to Send Back', 1045: 'Arrived', 1050: 'Receiving Processing', 1060: 'Receiving Completed' };
/** ASN: webhook status 20/30/50, detail status 10/20/30/40/50. 50 = receipt done -> stock counts. */
export const ASN_STATE: Row = { 10: 'Pending approval', 20: 'Verified', 30: 'Arrived / goods down', 40: 'Receiving', 50: 'Receipt completed' };

export const MY_STATES = ['Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan', 'Pahang', 'Perak', 'Perlis', 'Pulau Pinang', 'Sabah', 'Sarawak', 'Selangor', 'Terengganu', 'Kuala Lumpur', 'Labuan', 'Putrajaya'];
/** Address validation (no FFM region endpoint): required fields + 5-digit MY postcode + MY state + phone 8–15 digits. */
export function validateConsignee(c: Row): string[] {
  const e: string[] = [], s = (k: string) => String(c?.[k] ?? '').trim();
  if (!s('name')) e.push('name');
  if (!s('address')) e.push('address');
  if (!s('city')) e.push('city');
  if (!/^\d{5}$/.test(s('postcode'))) e.push('postcode');
  const st = s('state').replace(/^W\.?P\.?\s*/i, '');
  if (!MY_STATES.some((x) => x.toLowerCase() === st.toLowerCase())) e.push('state');
  const d = s('phone').replace(/\D/g, '');
  if (d.length < 8 || d.length > 15) e.push('phone');
  return e;
}
export function normState(st: string): string { const x = String(st || '').trim().replace(/^W\.?P\.?\s*/i, ''); return MY_STATES.find((m) => m.toLowerCase() === x.toLowerCase()) || x; }

/** FFM fee from /order_fee/detail (amounts in minor units). fee_source 'shipping' = shippingOriginalFee - platform/other discounts - buyer paid (seller-borne shipping). */
export function feeFromDetail(d: Row, mult = 100): number {
  const of = Array.isArray(d?.orderFee) ? (d.orderFee[0] || {}) : (d?.orderFee || {});
  const n = (k: string) => Number(of[k] || 0) || 0;
  const minor = n('shippingOriginalFee') - n('shippingPlatformDiscount') - n('shippingOtherDiscount') - n('shippingBuyerPaid');
  return Math.max(0, fromMinor(minor, mult));
}

/** Webhook dedupe key — one processing per (method, orderId, state/status, opTime). */
export function dedupeKey(p: Row): string {
  return ['wh', p.method || '', p.orderId || '', p.state ?? p.status ?? p.lossOverflowType ?? '', p.opTime ?? p.updateAt ?? ''].join(':');
}
/** Order SN for a DO attempt: DO no, then DO-R2, DO-R3 ... after failed/cancelled attempts. */
export function orderSnFor(doNo: string, priorAttempts: number): string { const base = String(doNo || '').trim().replace(/[^\w-]/g, ''); return priorAttempts > 0 ? base + '-R' + (priorAttempts + 1) : base; }

// ---------- pack size (pcs per FFM unit) + per-account barcode ----------
/** pcs_per_unit as a positive integer (default 1). */
export const ppuOf = (v: unknown): number => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : 1; };
/** M-Core pcs -> FFM units. Never rounds: ok=false when pcs is not a whole multiple of ppu. */
export function pcsToUnits(pcs: number, ppu: unknown): { ok: boolean; units: number } {
  const p = ppuOf(ppu), q = Number(pcs || 0), u = q / p;
  return { ok: Number.isInteger(u), units: u };
}
/** FFM units -> M-Core pcs. */
export const unitsToPcs = (units: unknown, ppu: unknown): number => Number(units || 0) * ppuOf(ppu);
/** Barcode rule: 1–40 letters/digits only. */
export const barcodeOk = (bc: unknown): boolean => /^[A-Za-z0-9]{1,40}$/.test(String(bc ?? '').trim());
/** EAN-13 check digit (warning only). Non-13-digit codes are not EAN-13 → true. */
export function ean13Ok(bc: unknown): boolean {
  const s = String(bc ?? '').trim(); if (!/^\d{13}$/.test(s)) return true;
  let sum = 0; for (let i = 0; i < 12; i++) sum += Number(s[i]) * (i % 2 ? 3 : 1);
  return (10 - (sum % 10)) % 10 === Number(s[12]);
}


// ---------- outbound list import + funded batch sold (pure) ----------
/** getOrderList / portal status string -> internal shipment status. Unsold in-progress stays below shipped. */
export const LIST_STATE: Row = {
  wait_activate: 'created', pre_sale: 'created', wait_allocate_warehouse: 'created', allocated_warehouse: 'verified',
  wait_approval: 'created', failed_get_the_label: 'exception', sold_out: 'stock_out', cancelled: 'cancelled',
  in_outbound: 'picked', packed: 'packed', awaiting_pickup: 'awaiting_pickup', shipped: 'shipped',
  abnormal_delivery: 'exception', rejected: 'rejected', signed: 'delivered', delivered: 'delivered',
};
export function listStatusOf(raw: unknown): string | null {
  const s = String(raw ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!s) return null;
  if (LIST_STATE[s]) return LIST_STATE[s];
  if (RANK[s] != null) return s;
  return null;
}
export const SOLD_STATUSES = ['shipped', 'delivered'];
export function isSoldStatus(status: unknown): boolean { return SOLD_STATUSES.includes(String(status || '')); }
export function isPendingReview(ship: Row): boolean {
  const raw = String(ship?.state_text || ship?.list_status || '').toLowerCase();
  return raw.includes('wait_approval') || raw.includes('wait approval') || raw.includes('pending review') || raw.includes('pending approval');
}

export function goodsBarcode(g: Row): string {
  return String(g?.barCode || g?.barcode || g?.goodsCode || g?.goods_code || g?.sku || '').trim();
}
export function goodsQty(g: Row): number {
  const n = Number(g?.num ?? g?.qty ?? g?.number ?? g?.quantity ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
/** Pull a goods array out of a list or detail payload (shape varies by endpoint). */
export function extractGoods(data: unknown): Row[] {
  if (!data || typeof data !== 'object') return [];
  const d = data as Row;
  const raw = d.goods || d.goodsList || d.goodList || d.skuList || d.items || d.orderGoods || (Array.isArray(d) ? d : null);
  const arr = Array.isArray(raw) ? raw : (Array.isArray(raw?.list) ? raw.list : []);
  const out: Row[] = [];
  for (const g of arr) {
    if (!g || typeof g !== 'object') continue;
    const barCode = goodsBarcode(g as Row), num = goodsQty(g as Row);
    if (!barCode || !num) continue;
    out.push({ barCode, num, externalName: String((g as Row).externalName || (g as Row).name || (g as Row).goodsName || barCode) });
  }
  return out;
}

export type ComboComp = { barcode: string; qty: number };
export type ComboMap = Record<string, ComboComp[]>;
export function comboMapFromRows(rows: Row[]): ComboMap {
  const m: ComboMap = {};
  for (const r of rows || []) {
    const p = String(r.parent_barcode || '').trim(), c = String(r.component_barcode || '').trim(), q = Number(r.qty || 0);
    if (!p || !c || !(q > 0)) continue;
    (m[p] = m[p] || []).push({ barcode: c, qty: q });
  }
  return m;
}
/** Expand shipment goods into component-barcode bottle counts. Unknown parents count as 1 of themselves. Only `batchBarcodes` are kept when that set is non-empty. */
export function expandGoodsToBottles(goods: unknown, comboMap: ComboMap, batchBarcodes?: Iterable<string>): Record<string, number> {
  const allow = new Set(Array.from(batchBarcodes || []).map((b) => String(b).trim()).filter(Boolean));
  const out: Record<string, number> = {};
  const add = (bc: string, q: number) => {
    if (!bc || !q) return;
    if (allow.size && !allow.has(bc)) return;
    out[bc] = (out[bc] || 0) + q;
  };
  const list = Array.isArray(goods) ? goods : extractGoods(goods);
  for (const g of list) {
    const bc = goodsBarcode(g), q = goodsQty(g);
    if (!bc || !q) continue;
    const comps = comboMap[bc] || comboMap[bc.toUpperCase()];
    if (comps && comps.length) {
      for (const c of comps) add(c.barcode, q * Number(c.qty || 0));
    } else add(bc, q);
  }
  return out;
}
export function bottlesSum(counts: Record<string, number>): number {
  return Object.values(counts).reduce((a, b) => a + Number(b || 0), 0);
}
/** Net bottles sold for a batch from a shipment list. Counting is a replace (idempotent): the same order_sn must appear once. Cancelled / in-progress / rejected are excluded; returned is netted off. */
export function bottlesSoldFromShipments(ships: Row[], comboMap: ComboMap, batchBarcodes: Iterable<string>): { sold: number; returned: number; byBarcode: Record<string, number> } {
  const seen = new Set<string>();
  let sold = 0, returned = 0;
  const by: Record<string, number> = {};
  for (const s of ships || []) {
    const key = String(s.order_sn || s.id || '');
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    const st = String(s.status || '');
    if (st === 'cancelled' || st === 'failed' || st === 'rejected' || st === 'sending') continue;
    const n = bottlesSum(expandGoodsToBottles(s.goods, comboMap, batchBarcodes));
    if (!n) continue;
    if (st === 'returned') { returned += n; continue; }
    if (!isSoldStatus(st)) continue;
    sold += n;
    const part = expandGoodsToBottles(s.goods, comboMap, batchBarcodes);
    for (const [k, v] of Object.entries(part)) by[k] = (by[k] || 0) + v;
  }
  return { sold: Math.max(0, sold - returned), returned, byBarcode: by };
}

/** Bottles that TikTok-listed SKUs (singles + combos) would need of one component barcode. */
export function bottlesListedNeeded(listed: Row[], comboMap: ComboMap, componentBarcode: string): number {
  const want = String(componentBarcode || '').trim();
  if (!want) return 0;
  let n = 0;
  for (const row of listed || []) {
    const bc = String(row.barcode || '').trim(), q = Number(row.tiktok_listed_qty ?? row.qty ?? 0);
    if (!bc || !(q > 0)) continue;
    if (bc === want) { n += q; continue; }
    const comps = comboMap[bc] || comboMap[bc.toUpperCase()] || [];
    for (const c of comps) if (c.barcode === want) n += q * Number(c.qty || 0);
  }
  return n;
}

export function isoDiffDays(from: string, to: string): number {
  const a = Date.parse(String(from || '').slice(0, 10) + 'T00:00:00Z');
  const b = Date.parse(String(to || '').slice(0, 10) + 'T00:00:00Z');
  if (!isFinite(a) || !isFinite(b)) return 0;
  return Math.round((b - a) / 86400000);
}
/** Projected pace to sell `qty` by `due`. 'risk' = At Risk. */
export function paceKey(opts: { sold: number; qty: number; today: string; due?: string | null; inbound?: string | null; watchPct?: number }): 'on' | 'watch' | 'risk' | 'overdue' | 'ns' | 'ach' {
  const qty = Number(opts.qty || 0), sold = Number(opts.sold || 0);
  if (!(qty > 0)) return 'ns';
  if (sold >= qty - 1e-9) return 'ach';
  const today = String(opts.today || '').slice(0, 10), due = opts.due ? String(opts.due).slice(0, 10) : '';
  if (due && today > due) return 'overdue';
  const daysLeft = due ? Math.max(0, isoDiffDays(today, due)) : null;
  const inbound = opts.inbound ? String(opts.inbound).slice(0, 10) : '';
  const elapsed = inbound && inbound < today ? Math.max(1, isoDiffDays(inbound, today)) : Math.max(1, inbound === today ? 1 : 1);
  const rate = sold / elapsed;
  if (daysLeft == null) return qty > 0 && sold / qty >= 0.6 ? 'on' : 'watch';
  const projected = sold + rate * daysLeft;
  const pct = projected / qty * 100;
  const watch = opts.watchPct != null ? Number(opts.watchPct) : 85;
  if (pct >= 100 - 1e-9) return 'on';
  if (pct >= watch - 1e-9) return 'watch';
  return 'risk';
}
