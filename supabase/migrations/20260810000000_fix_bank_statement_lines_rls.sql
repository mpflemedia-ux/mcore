-- Fixes bank_statement_lines (20260809000000_bank_statement_lines.sql) and
-- extends it to actually be usable as a recovery backup for Bank
-- Reconciliation, which today stores everything in localStorage only —
-- clearing browser cache or switching devices loses all import/category/
-- match/post progress with nothing to fall back on.
--
-- 1) RLS FIX
-- The original policy used `auth.jwt() ->> 'tenant_id'`, assuming
-- tenant_id is embedded in the JWT's custom claims. Nothing in this
-- codebase actually puts tenant_id there — every other tenant-scoped RLS
-- policy in supabase/migrations/ (see 20260804170000_fix_pv_batches_rls.sql,
-- 20260730000000_attendance_leave.sql, and others) instead resolves it via
-- `tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())`.
-- With the original policy, `auth.jwt() ->> 'tenant_id'` evaluates to NULL
-- for every real session, so `tenant_id::text = coalesce(NULL, '')` is
-- always false — the policy silently blocks every read AND write for
-- every tenant, making the table completely unusable even after being
-- created. This migration replaces it with the proven-working pattern.
--
-- 2) NEW COLUMNS for a faithful recovery
-- The original table only ever recorded the INITIAL import (status
-- defaulting to 'imported', matched_type/matched_id/matched_ref only). It
-- never captured _state ('confirmed'/'rejected' — app/index.html's
-- _recoSetState), _matchChecked (whether "Match with AI" has run for this
-- line — gates Post Unmatched), or journal_ref (the posted entry's ref_no,
-- shown on the "Posted" badge). Without these, recovering from this table
-- after a local wipe could not tell "rejected" apart from "never touched",
-- and would leave every recovered line looking un-matched even if Match
-- had already run — silently degrading the recovery instead of actually
-- restoring the working state.
alter table public.bank_statement_lines add column if not exists state text;
alter table public.bank_statement_lines add column if not exists match_checked boolean not null default false;
alter table public.bank_statement_lines add column if not exists journal_ref text;
alter table public.bank_statement_lines add column if not exists updated_at timestamptz default now();

-- app/index.html's _recoTryCloudRecover windows its recovery query by
-- `updated_at` (recency of sync activity) with a limit(500), so this
-- column being meaningful actually matters. `DEFAULT now()` on ADD COLUMN
-- back-fills every PRE-EXISTING row with the MIGRATION'S run time, not
-- that row's true last-touched time — if any rows already exist (the
-- original RLS policy blocked all reads/writes, so in practice this
-- table is very likely still empty, but this doesn't rely on that),
-- they'd all tie for "most recently updated" alongside genuinely fresh
-- syncs, which could crowd out real recent activity once a tenant's row
-- count exceeds 500. Backfilling from created_at (present since the
-- original 20260809000000 migration, and a real historical timestamp,
-- not a migration-time artifact) keeps the column meaningful for
-- whatever rows already exist.
update public.bank_statement_lines set updated_at = created_at where updated_at is null or updated_at > created_at;

drop policy if exists bank_statement_lines_tenant on public.bank_statement_lines;
create policy bank_statement_lines_tenant on public.bank_statement_lines
  for all using (tenant_id = (select tenant_id from public.user_profiles where id = auth.uid()))
  with check (tenant_id = (select tenant_id from public.user_profiles where id = auth.uid()));

-- No explicit GRANT here — unlike merge_tenant_config's GRANT EXECUTE
-- (20260809010000_period_lock_trigger.sql), that's specifically because
-- Postgres functions default to no-execute for anyone but the owner.
-- Ordinary tables don't need that: every other tenant-scoped table in this
-- repo (credit_notes, attendance_leave, pv_batches, ...) relies on
-- Supabase's default public-schema privileges for `authenticated` with no
-- table-level GRANT of its own, and this table follows the same pattern.
