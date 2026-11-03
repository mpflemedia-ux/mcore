-- Sales Plan — Batch fee basis (% Principal vs % Revenue) + FFM revenue auto-pull.
-- Some financiers (e.g. FundedHere, per Brzky Empire's actual loan agreement) charge
-- fee = fee% x ACTUAL REVENUE, not fee% x principal. Existing batches are unaffected:
-- fee_basis defaults to 'principal', which keeps SP.batchCalc's old formula exactly.
--
-- Adds to sales_plan_batches:
--   fee_basis      text    default 'principal', check in ('principal','revenue')
--   ffm_account_id uuid    — which Funded FFM account (ffm_accounts) this batch's
--                            revenue-basis fee auto-pulls sales from (optional, manual entry still allowed)
--   actual_revenue numeric — actual revenue for the batch period, used when fee_basis = 'revenue'
--                            (auto-filled from ffm_shipments via UI "Auto-fill from FFM", or entered manually)
--
-- Idempotent — write-only, run in Supabase SQL Editor.

alter table sales_plan_batches
  add column if not exists fee_basis text not null default 'principal',
  add column if not exists ffm_account_id uuid,
  add column if not exists actual_revenue numeric;

alter table sales_plan_batches drop constraint if exists sales_plan_batches_fee_basis_check;
alter table sales_plan_batches add constraint sales_plan_batches_fee_basis_check
  check (fee_basis in ('principal','revenue'));

alter table sales_plan_batches drop constraint if exists sales_plan_batches_actual_revenue_check;
alter table sales_plan_batches add constraint sales_plan_batches_actual_revenue_check
  check (actual_revenue is null or actual_revenue >= 0);

alter table sales_plan_batches drop constraint if exists sales_plan_batches_ffm_account_fk;
alter table sales_plan_batches add constraint sales_plan_batches_ffm_account_fk
  foreign key (ffm_account_id) references ffm_accounts(id) on delete set null;

-- System Development roadmap
insert into dev_roadmap_items (id, title, description, module, stage, started_at, completed_at)
select gen_random_uuid(),
  'Sales Plan batch: Fee basis % Principal / % Revenue + FFM auto-pull',
  'Batch financing can now charge fee as % of actual revenue (not just % of principal) for revenue-share financiers like FundedHere. Revenue can auto-pull from the batch''s linked Funded FFM account shipments, or be entered manually. Existing principal-based batches are unaffected (fee_basis defaults to ''principal'').',
  'core', 'completed', now(), now()
where not exists (
  select 1 from dev_roadmap_items where title = 'Sales Plan batch: Fee basis % Principal / % Revenue + FFM auto-pull'
);
