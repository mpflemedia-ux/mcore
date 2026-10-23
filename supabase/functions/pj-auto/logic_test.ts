// deno test supabase/functions/pj-auto/logic_test.ts  (pure, no network)
import { assertEquals } from 'jsr:@std/assert@1';
import { digestText, myt, nextDue, nextStart, secretOk, userForEmp } from './logic.ts';

Deno.test('myt: UTC -> Malaysia wall clock', () => {
  assertEquals(myt(new Date('2026-10-22T16:30:00Z')), { day: '2026-10-23', hm: '00:30' });
  assertEquals(myt(new Date('2026-10-23T01:05:00Z')).hm, '09:05');
});
Deno.test('nextDue: daily / weekly / weekdays / monthly, missed periods skipped', () => {
  assertEquals(nextDue('2026-10-23', 'daily', '2026-10-23'), '2026-10-24');
  assertEquals(nextDue('2026-10-20', 'daily', '2026-10-23'), '2026-10-23'); /* 3 missed days -> today, not back-filled */
  assertEquals(nextDue('2026-10-23', 'weekdays', '2026-10-23'), '2026-10-26'); /* Fri -> Mon */
  assertEquals(nextDue('2026-10-23', 'weekly', '2026-10-23'), '2026-10-30');
  assertEquals(nextDue('2026-01-31', 'monthly', '2026-01-31'), '2026-02-28');
  assertEquals(nextDue('2026-01-31', 'monthly', '2026-03-01'), '2026-03-31'); /* anchor day 31 kept after a short month */
  assertEquals(nextDue('2026-12-15', 'monthly', '2026-12-15'), '2027-01-15');
  assertEquals(nextDue('2026-10-23', 'yearly', '2026-10-23'), null);
  assertEquals(nextDue('', 'daily', '2026-10-23'), null);
});
Deno.test('nextStart keeps the start -> due gap', () => {
  assertEquals(nextStart('2026-10-20', '2026-10-23', '2026-10-30'), '2026-10-27');
  assertEquals(nextStart(null, '2026-10-23', '2026-10-30'), null);
  assertEquals(nextStart('2026-10-25', '2026-10-23', '2026-10-30'), '2026-10-30'); /* bad data: start after due */
});
Deno.test('digestText: counts, overdue first, max 5 lines', () => {
  const t = (n: number, d: string) => ({ title: 'Task ' + n, due_date: d });
  const r = digestText('bm', [t(1, '2026-10-23'), t(2, '2026-10-23')], [t(3, '2026-10-21'), t(4, '2026-10-19'), t(5, '2026-10-20'), t(6, '2026-10-22')]);
  assertEquals(r.title, 'Task hari ini: 2 · Lewat: 4');
  assertEquals(r.body.split('\n')[0], '• Task 4 (lewat, due 19/10)');
  assertEquals(r.body.split('\n').length, 6);
  assertEquals(r.body.split('\n')[5], '+1 lagi');
  assertEquals(digestText('en', [{ title: 'A', due_date: '2026-10-23', due_time: '14:30:00' }], []).body, '• A (14:30)');
});
Deno.test('userForEmp: email first, then full name', () => {
  const users = [{ id: 'u1', email: 'a@x.my', full_name: 'Mike Paul' }, { id: 'u2', email: 'b@x.my', full_name: 'Siti' }];
  assertEquals(userForEmp({ email: 'B@X.MY', name: 'Mike Paul' }, users)?.id, 'u2');
  assertEquals(userForEmp({ email: '', name: 'mike paul ' }, users)?.id, 'u1');
  assertEquals(userForEmp({ email: 'z@x.my', name: 'Nobody' }, users), null);
});
Deno.test('secretOk: tolerant compare, empty env never passes', () => {
  assertEquals(secretOk('"abc"\n', 'abc'), true);
  assertEquals(secretOk('abc', ''), false);
  assertEquals(secretOk('abd', 'abc'), false);
});
