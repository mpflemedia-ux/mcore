// deno test supabase/functions/push-send/secret_test.ts  (pure)
import { assert } from 'jsr:@std/assert@1';
import { secretOk } from './handler.ts';
Deno.test('secretOk: tolerates whitespace/newline/quotes, still rejects wrong or empty', () => {
  assert(secretOk('abc', 'abc')); assert(secretOk('abc\n', 'abc')); assert(secretOk(' abc ', '"abc"\n')); assert(secretOk("'abc'", 'abc'));
  assert(!secretOk('abd', 'abc')); assert(!secretOk('', '')); assert(!secretOk(null, 'abc')); assert(!secretOk('abc', ''));
});
