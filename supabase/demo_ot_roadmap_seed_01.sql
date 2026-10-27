reset role;

-- ============================================================================
-- DEMO TENANT — OT automation roadmap example data (Phase 3-6)
--
-- Adds a NEW, self-contained public.reseed_demo_ot_data() function that seeds
-- worked examples of the OT roadmap features (shipped in supabase/hr_ot_*.sql
-- and supabase/attendance_public_holidays_tenant_write_01.sql) onto the DEMO
-- tenant (Maju Trading Sdn Bhd, code='DEMO'), then wires reset_demo_tenant()
-- to call it automatically after the existing reseed_demo_data() — so one
-- click on "Reset Demo Data" in the app always leaves these examples ready,
-- same as every other demo feature.
--
-- Deliberately NOT folded into reseed_demo_data() itself (1000+ lines) — a
-- separate function keeps this change small and avoids touching that proven
-- function's body at all. It is fully self-cleaning (wipes its own prior
-- output at the top) so re-running it, or running a full Reset Demo, always
-- restores the same pristine example state even if the demo owner/staff
-- account edited/approved/rejected these rows while exploring the feature.
--
-- What gets seeded on the DEMO tenant (Maju Trading Sdn Bhd, Shah Alam,
-- Selangor — 4 existing employees from Part 3c, all well under the RM4,000
-- OT wage threshold):
--   Phase 3 — one tenant-specific public holiday: Sultan Selangor's Birthday
--     (11 Dec), on top of the Malaysia federal defaults — shows "Additional
--     public holidays" actually differs per tenant.
--   Phase 4 — a tenant_ot_settings row with ot_eligible_wage_threshold
--     deliberately set to RM3,500 (not the RM4,000 hardcoded default) so the
--     Tetapan Gaji & OT page visibly proves it reads the DB, not just a JS
--     fallback. Nurhidayah (on probation) gets employees.ot_eligible=false
--     as a worked example of the per-employee override.
--   Phase 5-6 — demo.staff@mpflemedia.my is appointed as an OT delegate
--     (tenants.config.ot_delegates) and 4 ot_claims covering every state the
--     OT Approvals page needs to demonstrate: one pending (normal-day OT),
--     one pending, one approved by the Owner with hours trimmed (partial
--     approval), one approved by the Delegate for a DIFFERENT employee
--     (proving delegate approval works), and one rejected by the Owner with
--     a note.
--   Phase 7 is deliberately left for the demo user to trigger live: the
--     approved claims above are unpaid (payroll_record_id IS NULL) — running
--     Payroll Run for the current period is what shows ot_amount flow onto
--     a payslip, which is a more convincing demo than a pre-baked number.
--
-- Write-only, idempotent, run once in Supabase SQL Editor. Run AFTER
-- demo_tenant_01_bootstrap.sql, demo_tenant_03c_hr_commission_projects_
-- planner_salesplan.sql, and hr_ot_claims_01.sql (needs tenant_ot_settings/
-- ot_claims/public_holidays and employees.ot_eligible to already exist).
-- ============================================================================

create or replace function public.reseed_demo_ot_data()
returns jsonb
language plpgsql
security definer
as $fn$
declare
  v_tenant_id uuid;
  v_owner_id uuid;
  v_staff_id uuid;
  v_emp_siti uuid := '00000000-0000-0000-0301-000000000001';
  v_emp_firdaus uuid := '00000000-0000-0000-0301-000000000002';
  v_emp_nurhidayah uuid := '00000000-0000-0000-0301-000000000003';
  v_emp_azman uuid := '00000000-0000-0000-0301-000000000004';
begin
  select id into v_tenant_id from tenants where code = 'DEMO' and is_demo = true and deleted_at is null;
  if v_tenant_id is null then
    raise exception 'Demo tenant (code=DEMO, is_demo=true) not found — run demo_tenant_01_bootstrap.sql first';
  end if;

  select id into v_owner_id from user_profiles where tenant_id = v_tenant_id and role = 'owner' limit 1;
  select id into v_staff_id from user_profiles where tenant_id = v_tenant_id and role = 'staff' limit 1;
  if v_owner_id is null or v_staff_id is null then
    raise exception 'DEMO tenant missing owner/staff user_profiles — run demo_tenant_01_bootstrap.sql first';
  end if;

  -- ---------- self-clean (so re-running, or a Reset Demo click, always restores this
  -- exact example state even if the demo account edited/approved/rejected these rows) ----------
  delete from ot_claims where tenant_id = v_tenant_id;
  delete from public_holidays where tenant_id = v_tenant_id; -- tenant-specific only; global (tenant_id IS NULL) untouched

  -- ---------- Phase 3: tenant-specific public holiday ----------
  insert into public_holidays (tenant_id, holiday_date, title_en, title_bm)
  values (v_tenant_id, make_date(extract(year from CURRENT_DATE)::int, 12, 11),
    'Sultan of Selangor''s Birthday', 'Hari Keputeraan Sultan Selangor');

  -- ---------- Phase 4: Tetapan Gaji & OT — threshold deliberately non-default (RM3,500,
  -- not the RM4,000 JS fallback) so the settings page visibly proves it reads the DB ----------
  insert into tenant_ot_settings (tenant_id, ot_eligible_wage_threshold)
  values (v_tenant_id, 3500)
  on conflict (tenant_id) do update set ot_eligible_wage_threshold = excluded.ot_eligible_wage_threshold;

  -- Per-employee override worked example: Nurhidayah is on probation — business rule is OT
  -- is not auto-approved during probation, despite her wage otherwise qualifying.
  update employees set ot_eligible = false where id = v_emp_nurhidayah and tenant_id = v_tenant_id;
  update employees set ot_eligible = null where tenant_id = v_tenant_id and id not in (v_emp_nurhidayah); -- Auto (wage-threshold) for the rest

  -- ---------- Phase 5-6: OT delegate + ot_claims demonstrating every approval-queue state ----------
  update tenants set config = coalesce(config, '{}'::jsonb) || jsonb_build_object('ot_delegates', jsonb_build_array(v_staff_id::text))
  where id = v_tenant_id;

  insert into ot_claims (id, tenant_id, employee_id, claim_date, day_type, hours_worked, ot_hours,
    hourly_rate, daily_rate, amount, status, approved_hours, approved_amount, approved_by, approved_at, note)
  values
    -- Pending: Siti worked 2h past normal hours on a normal working day — awaiting approval.
    (gen_random_uuid(), v_tenant_id, v_emp_siti, (CURRENT_DATE - 3), 'normal', 10, 2, 13.46, 107.69, 40.38, 'pending', null, null, null, null, null),
    -- Approved by OWNER, PARTIAL: Firdaus claimed a 5h rest-day shift; owner trimmed to 4h.
    (gen_random_uuid(), v_tenant_id, v_emp_firdaus, (CURRENT_DATE - 6), 'restday', 5, 5, 12.02, 96.15, 96.15, 'approved', 4, 76.92, v_owner_id, (CURRENT_DATE - 5)::timestamptz, null),
    -- Rejected by OWNER with a note: Azman worked late without prior authorization.
    (gen_random_uuid(), v_tenant_id, v_emp_azman, (CURRENT_DATE - 2), 'normal', 9.5, 1.5, 9.62, 76.92, 21.63, 'rejected', null, null, v_owner_id, (CURRENT_DATE - 1)::timestamptz, 'Tiada arahan kerja lebih masa daripada penyelia — sila dapatkan kelulusan dahulu sebelum OT.'),
    -- Approved by the DELEGATE (demo.staff) for a DIFFERENT employee — proves delegate approval works end-to-end.
    (gen_random_uuid(), v_tenant_id, v_emp_siti, (CURRENT_DATE - 10), 'normal', 11, 3, 13.46, 107.69, 60.58, 'approved', 3, 60.58, v_staff_id, (CURRENT_DATE - 9)::timestamptz, null);

  return jsonb_build_object(
    'success', true, 'tenant_id', v_tenant_id,
    'public_holidays_added', 1, 'ot_claims_added', 4, 'ot_delegate', v_staff_id
  );
end;
$fn$;

grant execute on function public.reseed_demo_ot_data() to authenticated;

-- ---------- wire into the existing one-click Reset Demo Data flow ----------
create or replace function public.reset_demo_tenant()
returns jsonb
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid;
  v_reseed jsonb;
  v_reseed_ot jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  select id into v_tenant_id from tenants where code = 'DEMO' and is_demo = true and deleted_at is null;
  if v_tenant_id is null then
    raise exception 'Demo tenant (code=DEMO, is_demo=true) not found - refusing to reset';
  end if;

  -- ---------- DELETE phase (children before parents) ----------
  delete from bookings where tenant_id = v_tenant_id;
  delete from booking_services where tenant_id = v_tenant_id;
  delete from shifts where tenant_id = v_tenant_id;
  delete from shift_swaps where tenant_id = v_tenant_id;

  -- activity leftovers (DEMO only; hard delete matches sibling tables in this wipe)
  -- reseed does not recreate these — empty For-you / no WA history = fresh demo
  delete from notifications where tenant_id = v_tenant_id;
  delete from payment_claims where tenant_id = v_tenant_id;

  -- WA / public-link / attach leftovers (children of doc_public_links first; no FK from invoices)
  delete from doc_views where tenant_id = v_tenant_id;
  delete from doc_responses where tenant_id = v_tenant_id;
  delete from doc_shares where tenant_id = v_tenant_id;
  delete from doc_attachments where tenant_id = v_tenant_id;
  delete from doc_notes where tenant_id = v_tenant_id;
  delete from doc_public_links where tenant_id = v_tenant_id;

  -- OT roadmap leftovers — ot_claims also cascades from the employees delete below, but
  -- reseed_demo_ot_data() self-cleans anyway; explicit here only for the DELETE phase's
  -- own readability/ordering convention (children before parents).
  delete from ot_claims where tenant_id = v_tenant_id;

  delete from pos_transaction_items where tenant_id = v_tenant_id;
  delete from payment_allocations where tenant_id = v_tenant_id;
  delete from invoice_items where tenant_id = v_tenant_id;
  delete from quotation_items where tenant_id = v_tenant_id;
  delete from stock_movements where tenant_id = v_tenant_id;
  delete from customer_contacts where tenant_id = v_tenant_id;
  delete from goods_received_items where grn_id in (select id from goods_received_notes where tenant_id = v_tenant_id);
  delete from supplier_payments where tenant_id = v_tenant_id;
  delete from bom_items where tenant_id = v_tenant_id;
  delete from depreciation_schedule where tenant_id = v_tenant_id;
  delete from journal_lines where tenant_id = v_tenant_id;
  delete from expense_claim_items where tenant_id = v_tenant_id;
  delete from payment_voucher_batch_lines where tenant_id = v_tenant_id;
  delete from sales_commissions where tenant_id = v_tenant_id;
  delete from sales_commission_rules where tenant_id = v_tenant_id;
  delete from sales_achievements where tenant_id = v_tenant_id;
  delete from project_tasks where tenant_id = v_tenant_id;
  delete from platform_activities where tenant_id = v_tenant_id;
  delete from sales_plan_milestones where tenant_id = v_tenant_id;
  delete from sales_plan_weeks where tenant_id = v_tenant_id;
  delete from attendance where tenant_id = v_tenant_id;
  delete from leave_requests where tenant_id = v_tenant_id;
  delete from delivery_orders where tenant_id = v_tenant_id;
  delete from job_applicants where tenant_id = v_tenant_id;
  delete from payroll_records where tenant_id = v_tenant_id;

  delete from pos_transactions where tenant_id = v_tenant_id;
  delete from payments where tenant_id = v_tenant_id;
  delete from invoices where tenant_id = v_tenant_id;
  delete from supplier_bills where tenant_id = v_tenant_id;
  delete from goods_received_notes where tenant_id = v_tenant_id;
  delete from purchase_order_items where po_id in (select id from purchase_orders where tenant_id = v_tenant_id);
  delete from fixed_assets where tenant_id = v_tenant_id;
  delete from journal_entries where tenant_id = v_tenant_id;
  delete from expense_claims where tenant_id = v_tenant_id;
  delete from payment_voucher_batches where tenant_id = v_tenant_id;
  delete from sales_plan_periods where tenant_id = v_tenant_id;
  delete from work_orders where tenant_id = v_tenant_id;

  delete from pos_sessions where tenant_id = v_tenant_id;
  delete from quotations where tenant_id = v_tenant_id;
  delete from purchase_orders where tenant_id = v_tenant_id;
  delete from sales_plans where tenant_id = v_tenant_id;
  delete from bank_accounts where tenant_id = v_tenant_id;
  delete from projects where tenant_id = v_tenant_id;

  delete from customers where tenant_id = v_tenant_id;
  delete from suppliers where tenant_id = v_tenant_id;
  delete from employees where tenant_id = v_tenant_id;

  delete from products where tenant_id = v_tenant_id;
  delete from product_categories where tenant_id = v_tenant_id;
  delete from warehouses where tenant_id = v_tenant_id;

  delete from doc_counters where tenant_id = v_tenant_id;

  -- ---------- REPOPULATE phase (one-click wipe + reseed) ----------
  v_reseed := public.reseed_demo_data();
  v_reseed_ot := public.reseed_demo_ot_data();

  return jsonb_build_object('success', true, 'tenant_id', v_tenant_id, 'reset_at', now(), 'reseed', v_reseed, 'reseed_ot', v_reseed_ot);
end;
$$;

grant execute on function public.reset_demo_tenant() to authenticated;

-- ---------- run once now so the demo is populated immediately, without waiting for the
-- next "Reset Demo Data" click (reseed_demo_data() itself is untouched/not re-run here) ----------
select public.reseed_demo_ot_data();

-- Roadmap (write-only; Admin → System Development)
update public.dev_roadmap_items set stage = 'completed', module = 'platform',
  description = 'Reset Demo Data now also seeds worked examples of the OT automation roadmap (Phase 3-6) on the DEMO tenant: a tenant-specific public holiday, Tetapan Gaji & OT settings with a non-default threshold, demo.staff appointed as OT delegate, and 4 ot_claims covering pending/owner-approved-partial/rejected/delegate-approved states. Self-cleaning (reseed_demo_ot_data() wipes its own output first), wired into reset_demo_tenant() after the existing reseed_demo_data(). Payroll integration (Phase 7) is left for the demo user to trigger live via Run Payroll.'
where title = 'Demo: OT roadmap worked examples in Reset Demo Data';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Demo: OT roadmap worked examples in Reset Demo Data',
  'Reset Demo Data now also seeds worked examples of the OT automation roadmap (Phase 3-6) on the DEMO tenant: a tenant-specific public holiday, Tetapan Gaji & OT settings with a non-default threshold, demo.staff appointed as OT delegate, and 4 ot_claims covering pending/owner-approved-partial/rejected/delegate-approved states. Self-cleaning (reseed_demo_ot_data() wipes its own output first), wired into reset_demo_tenant() after the existing reseed_demo_data(). Payroll integration (Phase 7) is left for the demo user to trigger live via Run Payroll.',
  'platform', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Demo: OT roadmap worked examples in Reset Demo Data');
