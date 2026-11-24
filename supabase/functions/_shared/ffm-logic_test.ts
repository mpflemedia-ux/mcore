// deno test supabase/functions/_shared/ffm-logic_test.ts
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { normBaseUrl, normUrlHost, barcodeOk, ean13Ok, pcsToUnits, ppuOf, unitsToPcs, alg1String, alg2String, dedupeKey, feeFromDetail, hmacOk, hmacSign, nextStatus, orderSnFor, sha256Upper, signAlg1, signAlg2, toMinor, validateConsignee, listStatusOf, extractGoods, expandGoodsToBottles, bottlesSoldFromShipments, bottlesListedNeeded, paceKey, comboMapFromRows } from './ffm-logic.ts';

const KEY = 'dd807a8e18b40153888e5a9864e70080';
Deno.test('Algorithm 1 — FFM doc vector', async () => {
  const p = { mchId: '5a7bdfd22593414adb72df5f', nonceStr: 'yyv6YJP436wCkdpNdghC', orderSn: 'test' };
  assertEquals(alg1String(p, KEY), 'mchId=5a7bdfd22593414adb72df5f&nonceStr=yyv6YJP436wCkdpNdghC&orderSn=test&key=' + KEY);
  assertEquals(await signAlg1(p, KEY), '8107C24646A303501127BACC90EF521C8AD2A9C39DDCF407C70644E34153E280');
});
Deno.test('Algorithm 1 — doc vector with & (sign before encode)', async () => {
  const p = { orderSn: 'Lisa&Ruby', mchId: '5a7bdfd22593414adb72df5f', nonceStr: 'yyv6YJP436wCkdpNdghC' };
  assertEquals(await signAlg1(p, KEY), '1476BC28701A74AFDEA1A5833AE6AAF76CDC1200628E2600DBD934BBA9A0818B');
});
Deno.test('Algorithm 1 — loose mode drops null/""/0/false/whitespace + sign', () => {
  assertEquals(alg1String({ b: '2', a: ' 1 ', z: '', y: 0, x: null, w: false, v: '  ', sign: 'X' }, 'K'), 'a=1&b=2&key=K');
});
Deno.test('Algorithm 2 — string layout per doc + self-computed hash', async () => {
  const q = { timestamp: '1718096016', mchId: 'C1000001', nonceStr: '123456' };
  const raw = '{"orderSn":"T1","goods":[{"barCode":"A","num":"1"}]}';
  const s = alg2String(q, raw, 'SECRET');
  assertEquals(s, 'SECRETmchIdC1000001nonceStr123456timestamp1718096016' + raw + 'SECRET');
  assertEquals(await signAlg2(q, raw, 'SECRET'), await sha256Upper(s));
  assertEquals((await signAlg2(q, raw, 'SECRET')).length, 64);
  assert(/^[0-9A-F]{64}$/.test(await signAlg2({ ...q, sign: 'ignored' }, raw, 'SECRET')));
  assertEquals(await signAlg2({ ...q, sign: 'ignored' }, raw, 'SECRET'), await signAlg2(q, raw, 'SECRET'));
});
Deno.test('Webhook HMAC — hex any case + base64 accepted, wrong rejected', async () => {
  const raw = '{"method":"deliveryOrder","orderId":"DO1","state":"1014"}';
  const s = await hmacSign('sec', 'key', raw);
  assert(await hmacOk(s.hex, 'sec', 'key', raw));
  assert(await hmacOk(s.hex.toUpperCase(), 'sec', 'key', raw));
  assert(await hmacOk(s.b64, 'sec', 'key', raw));
  assert(!(await hmacOk(s.hex, 'sec', 'key', raw + ' ')));
  assert(!(await hmacOk('', 'sec', 'key', raw)));
});
Deno.test('status never regresses; cancel/return allowed', () => {
  assertEquals(nextStatus('shipped', 'packed'), null);
  assertEquals(nextStatus('packed', 'shipped'), 'shipped');
  assertEquals(nextStatus('created', 'cancelled'), 'cancelled');
  assertEquals(nextStatus('cancelled', 'shipped'), null);
  assertEquals(nextStatus('delivered', 'returned'), 'returned');
});
Deno.test('validation, amounts, keys', () => {
  assertEquals(validateConsignee({ name: 'A', phone: '0123456789', address: 'x', city: 'Shah Alam', state: 'Selangor', postcode: '40000' }), []);
  assertEquals(validateConsignee({ name: '', phone: '12', address: 'x', city: 'c', state: 'Bangkok', postcode: '4000' }), ['name', 'postcode', 'state', 'phone']);
  assertEquals(validateConsignee({ name: 'A', phone: '0123456789', address: 'x', city: 'KL', state: 'W.P. Kuala Lumpur', postcode: '50000' }), []);
  assertEquals(toMinor(12.345), '1235');
  assertEquals(toMinor('10', 1), '10');
  assertEquals(orderSnFor('DO-0001', 0), 'DO-0001');
  assertEquals(orderSnFor('DO-0001', 2), 'DO-0001-R3');
  assertEquals(dedupeKey({ method: 'deliveryOrder', orderId: 'DO1', state: '1014', opTime: 5 }), 'wh:deliveryOrder:DO1:1014:5');
  assertEquals(feeFromDetail({ orderFee: [{ shippingOriginalFee: 1000, shippingPlatformDiscount: 200, shippingBuyerPaid: 300 }] }), 5);
});

Deno.test('pack size: pcs <-> FFM units, no rounding', () => {
  assertEquals(pcsToUnits(864, 24), { ok: true, units: 36 });
  assertEquals(pcsToUnits(50, 24).ok, false);
  assertEquals(pcsToUnits(7, 1), { ok: true, units: 7 });
  assertEquals(unitsToPcs(36, 24), 864);
  assertEquals(ppuOf(0), 1); assertEquals(ppuOf('24'), 24); assertEquals(ppuOf(1.5), 1);
});
Deno.test('barcode validation + EAN-13 checksum (KeraVive real codes)', () => {
  assert(barcodeOk('9555277201519')); assert(barcodeOk('AB12')); assert(!barcodeOk('')); assert(!barcodeOk('95-55')); assert(!barcodeOk('9555 277'));
  assert(ean13Ok('9555277201519')); assert(ean13Ok('9555277201526')); assert(!ean13Ok('9555277201510')); assert(ean13Ok('12345'));
});
Deno.test('base URL normalisation (mobile auto-capital)', () => {
  assertEquals(normBaseUrl(' Https://Open.Flashfulfillment.My/ '), 'https://open.flashfulfillment.my');
  assertEquals(normBaseUrl('Https://open.Flashfulfillment.My'), 'https://open.flashfulfillment.my');
  assertEquals(normBaseUrl('https://open.flashfulfillment.my'), 'https://open.flashfulfillment.my');
  assertEquals(normUrlHost('Https://Track.Example.My/T/{pno}'), 'https://track.example.my/T/{pno}');
  assertEquals(normBaseUrl(''), '');
});


const FH = '9555277201526', BRZKY = '9555277201519', COMBO2 = 'KV-COMBO-A-2X', COMBO3 = 'KV-COMBO-B-3X';
const COMBOS = comboMapFromRows([
  { parent_barcode: COMBO2, component_barcode: FH, qty: 2 },
  { parent_barcode: COMBO3, component_barcode: FH, qty: 3 },
]);

Deno.test('list status maps in-outbound / signed / wait_approval; in-progress is not sold', () => {
  assertEquals(listStatusOf('in_outbound'), 'picked');
  assertEquals(listStatusOf('signed'), 'delivered');
  assertEquals(listStatusOf('wait_approval'), 'created');
  assertEquals(listStatusOf('shipped'), 'shipped');
  assertEquals(listStatusOf(''), null);
});

Deno.test('combo expansion: 2X=2, 3X=3, single=1; other barcode ignored', () => {
  const goods = [
    { barCode: COMBO2, num: 3 },
    { barCode: COMBO3, num: 1 },
    { barCode: FH, num: 2 },
    { barCode: BRZKY, num: 10 },
  ];
  const all = expandGoodsToBottles(goods, COMBOS);
  assertEquals(all[FH], 3 * 2 + 1 * 3 + 2);
  assertEquals(all[BRZKY], 10);
  const only = expandGoodsToBottles(goods, COMBOS, [FH]);
  assertEquals(only[FH], 11);
  assertEquals(only[BRZKY], undefined);
});

Deno.test('sold count is idempotent on order_sn and ignores cancelled / in-progress', () => {
  const ships = [
    { order_sn: 'A', status: 'shipped', shipped_at: '2026-11-20', goods: [{ barCode: FH, num: 5 }] },
    { order_sn: 'A', status: 'shipped', shipped_at: '2026-11-20', goods: [{ barCode: FH, num: 5 }] }, // dup
    { order_sn: 'B', status: 'cancelled', goods: [{ barCode: FH, num: 3 }] },
    { order_sn: 'C', status: 'picked', goods: [{ barCode: COMBO2, num: 4 }] }, // outbound in progress
    { order_sn: 'D', status: 'delivered', goods: [{ barCode: COMBO2, num: 2 }] },
    { order_sn: 'E', status: 'returned', goods: [{ barCode: FH, num: 1 }] },
    { order_sn: 'F', status: 'shipped', goods: [{ barCode: BRZKY, num: 9 }] },
  ];
  const r = bottlesSoldFromShipments(ships, COMBOS, [FH]);
  // A: 5, D: 4, E: -1, F ignored, B/C ignored, A dup ignored → 8
  assertEquals(r.sold, 8);
  assertEquals(r.returned, 1);
  const r2 = bottlesSoldFromShipments(ships, COMBOS, [FH]);
  assertEquals(r2.sold, r.sold);
});

Deno.test('extractGoods reads mixed API shapes', () => {
  assertEquals(extractGoods({ goodsList: [{ barCode: FH, number: '2', name: 'Moist' }] })[0].num, 2);
  assertEquals(extractGoods({ goods: [{ barcode: FH, qty: 3 }] })[0].num, 3);
});

Deno.test('oversell bottles needed from listed singles + combos', () => {
  const listed = [
    { barcode: FH, tiktok_listed_qty: 10 },
    { barcode: COMBO2, tiktok_listed_qty: 4 },
    { barcode: COMBO3, tiktok_listed_qty: 1 },
    { barcode: BRZKY, tiktok_listed_qty: 50 },
  ];
  assertEquals(bottlesListedNeeded(listed, COMBOS, FH), 10 + 4 * 2 + 1 * 3);
});

Deno.test('pace: on track / watch / at risk / overdue / achieved', () => {
  assertEquals(paceKey({ sold: 1080, qty: 1080, today: '2026-11-24', due: '2026-11-28' }), 'ach');
  assertEquals(paceKey({ sold: 100, qty: 1080, today: '2026-11-29', due: '2026-11-28' }), 'overdue');
  // 800 sold in 10 days → 80/day, 4 days left → project 1120 >= 1080 → on
  assertEquals(paceKey({ sold: 800, qty: 1080, today: '2026-11-24', due: '2026-11-28', inbound: '2026-11-14' }), 'on');
  // 80 sold in 10 days → 8/day × 4 = 32, project 112 / 1080 ≈ 10% → risk
  assertEquals(paceKey({ sold: 80, qty: 1080, today: '2026-11-24', due: '2026-11-28', inbound: '2026-11-14' }), 'risk');
});
