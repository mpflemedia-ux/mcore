// deno test supabase/functions/_shared/ffm-logic_test.ts
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { normBaseUrl, normUrlHost, barcodeOk, ean13Ok, pcsToUnits, ppuOf, unitsToPcs, alg1String, alg2String, dedupeKey, feeFromDetail, hmacOk, hmacSign, nextStatus, orderSnFor, sha256Upper, signAlg1, signAlg2, toMinor, validateConsignee } from './ffm-logic.ts';

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
