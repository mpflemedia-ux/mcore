// deno test supabase/functions/sd-agent/core_test.ts  (pure, no network)
// Mirrors app/sd-data.js's SD.TR / SD.setStatus / SD.pausedSec -- this is the one place that
// behaviour is re-asserted outside the browser, since sd-agent walks the same status machine
// server-side (walkStatus in handler.ts) without a human clicking through the UI one hop at a time.
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { canMove, cleanSecret, pathAllowed, pathTo, pausedSec, refPrefix, safeName, secretOk, statusPatch } from './core.ts';

Deno.test('canMove: only the exact SD.TR adjacency list, no illegal jumps', () => {
  assert(canMove('submitted', 'triaged')); assert(canMove('in_progress', 'delivered')); assert(canMove('in_progress', 'waiting_client'));
  assert(!canMove('submitted', 'delivered'), 'no single-hop jump past the machine');
  assert(!canMove('waiting_client', 'delivered'), 'waiting_client must resume to in_progress first');
  assert(!canMove('delivered', 'in_progress'), 'delivered only moves to closed or revision');
});

Deno.test('pathTo: BFS hop sequence for ask_client\'s multi-hop walk, excludes the start state', () => {
  assertEquals(pathTo('submitted', 'waiting_client'), ['triaged', 'in_progress', 'waiting_client']);
  assertEquals(pathTo('triaged', 'waiting_client'), ['in_progress', 'waiting_client']);
  assertEquals(pathTo('in_progress', 'in_progress'), []);
  assertEquals(pathTo('delivered', 'waiting_client'), ['revision', 'in_progress', 'waiting_client'], 'reachable via the revision loop-back, just not directly');
  assertEquals(pathTo('closed', 'in_progress'), null, 'closed is terminal -- no outbound edges at all');
  assertEquals(pathTo('out_of_scope', 'in_progress'), null, 'out_of_scope is terminal too');
});

Deno.test('pausedSec: accumulated seconds + live elapsed while currently paused', () => {
  const now = new Date('2026-10-22T10:00:00Z');
  assertEquals(pausedSec({ sla_paused_seconds: 100 }, now), 100, 'not currently paused -> base only');
  assertEquals(pausedSec({ sla_paused_seconds: 100, paused_at: '2026-10-22T09:00:00Z' }, now), 3700, 'base + 1h live');
  assertEquals(pausedSec({ paused_at: '2026-10-22T10:00:30Z' }, now), 0, 'paused_at in the future (clock skew) floors at 0, never negative');
});

Deno.test('statusPatch: mirrors SD.setStatus\'s three branches exactly, status/updated_at excluded', () => {
  const now = '2026-10-22T10:00:00Z';
  assertEquals(statusPatch('triaged', 'in_progress', {}, now), {}, 'plain hop -> no extra columns');
  const resumed = statusPatch('waiting_client', 'in_progress', { sla_paused_seconds: 50, paused_at: '2026-10-22T09:00:00Z' }, now);
  assertEquals(resumed, { sla_paused_seconds: 3650, paused_at: null }, 'leaving waiting_client banks the paused time and clears paused_at');
  assertEquals(statusPatch('in_progress', 'waiting_client', {}, now), { paused_at: now });
  assertEquals(statusPatch('in_progress', 'delivered', {}, now), { delivered_at: now });
  assertEquals(statusPatch('delivered', 'closed', {}, now), { closed_at: now });
  assertEquals(statusPatch('waiting_client', 'in_progress', { paused_at: null }, now), {}, 'no paused_at set -> nothing to bank');
});

Deno.test('refPrefix: SR-<TENANTCODE>-<YYYYMM>- (uppercased, old-format refs untouched elsewhere)', () => {
  assertEquals(refPrefix('atas', '202611'), 'SR-ATAS-202611-');
  assertEquals(refPrefix('Atas1', '202611'), 'SR-ATAS1-202611-');
});

Deno.test('secretOk / cleanSecret: tolerates whitespace/newline/quotes, checks both primary and next (rotation window)', () => {
  assertEquals(cleanSecret(' "abc"\n'), 'abc');
  assert(secretOk('abc', 'abc', 'xyz')); assert(secretOk('xyz', 'abc', 'xyz'), 'next secret accepted during rotation');
  assert(secretOk(' "abc"\n', 'abc', '')); assert(!secretOk('abd', 'abc', 'xyz')); assert(!secretOk('', 'abc', 'xyz')); assert(!secretOk('abc', '', ''));
});

Deno.test('pathAllowed: agent confined to its own tenant\'s service-requests/<id>/ or _letterhead/ folder', () => {
  assert(pathAllowed('ten1/service-requests/req1/draft.pdf', 'ten1', 'req1'));
  assert(pathAllowed('ten1/_letterhead/123-letterhead.pdf', 'ten1'));
  assert(!pathAllowed('ten1/service-requests/req1/draft.pdf', 'ten1', 'req2'), 'wrong request id');
  assert(!pathAllowed('ten2/service-requests/req1/draft.pdf', 'ten1', 'req1'), 'wrong tenant');
  assert(!pathAllowed('ten1/service-requests/req1/draft.pdf', 'ten1'), 'no requestId supplied -> deny service-requests paths');
});

Deno.test('safeName: strips path separators and unsafe characters, keeps the tail', () => {
  assertEquals(safeName('../../etc/passwd'), '.._.._etc_passwd');
  assertEquals(safeName(''), 'file');
  assert(safeName('a'.repeat(200) + '.pdf').length <= 80);
});
