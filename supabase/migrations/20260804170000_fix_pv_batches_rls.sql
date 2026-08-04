-- Fix: RLS violation on INSERT into payment_voucher_batches /
-- payment_voucher_batch_lines ("new row violates row-level security policy").
--
-- Root cause: the app's INSERT payload for both tables already sets
-- tenant_id correctly (confirmed in app/index.html's _pvdSave()) and the
-- policy body in 20260804160000_pv_batches.sql is written correctly — but
-- `CREATE POLICY` has no "OR REPLACE" form in Postgres, and that migration
-- guards it with `EXCEPTION WHEN duplicate_object THEN NULL`. If a policy
-- with the same name (pvd_batches_tenant / pvd_lines_tenant) was already
-- created from an earlier draft of this SQL run manually in the Supabase
-- SQL Editor — or RLS was enabled but policy creation silently failed
-- partway through that transaction — the CREATE POLICY in that migration
-- is a silent no-op, leaving something other than the intended policy (or
-- no policy at all) actually in effect. `FOR ALL` + RLS enabled with zero
-- effective policies blocks every insert regardless of tenant_id.
--
-- This migration DROPs the policy first so CREATE POLICY is guaranteed to
-- (re)apply the correct definition, no matter what state it was left in.
--
-- NOTE re: the "guna get_tenant_id() helper" instruction — no such function
-- exists anywhere in supabase/migrations/, and the payment_vouchers table
-- (the "working" single-PV reference) uses the exact same
-- `tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())`
-- subquery this migration reapplies below, not a get_tenant_id() helper.
-- If get_tenant_id() exists live in Supabase (created directly via SQL
-- Editor, untracked here — same pattern as log_audit()), let me know and
-- I'll switch to it; this migration replicates the proven-working
-- payment_vouchers pattern instead of guessing at an unconfirmed helper.
--
-- Table structure is untouched — only the two policies are dropped/recreated.

DROP POLICY IF EXISTS pvd_batches_tenant ON payment_voucher_batches;
CREATE POLICY pvd_batches_tenant ON payment_voucher_batches
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS pvd_lines_tenant ON payment_voucher_batch_lines;
CREATE POLICY pvd_lines_tenant ON payment_voucher_batch_lines
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
