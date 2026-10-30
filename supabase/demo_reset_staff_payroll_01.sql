-- demo_reset_staff_payroll_01.sql
-- Reset Demo keeps the demo.staff ↔ Siti link + Siti OT/commission on her payslip.
-- WRITE ONLY — Mike runs in Supabase SQL Editor. Do not execute from agents.
--
-- Verified wipe (repo: demo_reset_sd_batches_01.sql = latest reset_demo_tenant()):
--   * DELETE phase hard-deletes ot_claims, attendance, sales_commissions, payroll_records, employees (DEMO only).
--   * reseed_demo_data() (demo_tenant_15) re-inserts Siti with email siti.noraini@majutrading.my
--     → demo.staff@mpflemedia.my no longer resolves to an employee (_hrResolveSelfEmployee).
--   * reseed_demo_data() inserts payroll_records for CURRENT month with fixed net (Siti 2472) and
--     NO commission/ot_amount, although it seeds Siti's commission rows (payout = current month).
--   * reseed_demo_ot_data() (demo_ot_roadmap_seed_02_sync) deletes ALL ot_claims, re-adds 4 examples
--     (Siti: 1 rest-day Saturday claim) and never touches payroll_records.
--
-- This file:
--   1) NEW public.reseed_demo_staff_payroll() — runs LAST in reset:
--      Siti email = demo.staff@mpflemedia.my, staff_code EMP001; up to 5 past weekdays of the current
--      month (Tue/Thu first) → attendance 09:00-19:00 + approved 2h OT claims (ids …0461-n / …0462-n);
--      then recomputes every DEMO payroll_records row of the current month with the app formula
--      (_otNetFromRow): basic + allowances + commission + OT − EPF/SOCSO/EIS/PCB/zakat − advance/deductions;
--      fully-paid slips stay fully paid; approved OT claims linked via payroll_record_id.
--   2) CREATE OR REPLACE public.reset_demo_tenant() = demo_reset_sd_batches_01 version
--      + guarded wipe of project child tables (FK without cascade) + call to (1).
--   3) Roadmap row 'Demo seed: Siti OT + commission persist' → completed.
-- Idempotent, DEMO tenant only (code=DEMO, is_demo=true). No schema change. Does NOT reset anything by itself.

reset role;

create or replace function public.reseed_demo_staff_payroll()
returns jsonb
language plpgsql
security definer
as $fn$
declare
  c_emp constant uuid := '00000000-0000-0000-0301-000000000001';  -- Siti Noraini binti Kamal
  c_email constant text := 'demo.staff@mpflemedia.my';
  v_tid uuid; v_owner uuid; v_basic numeric; v_set record;
  v_daily numeric; v_hourly numeric; v_amt numeric; v_ot_h numeric;
  v_pm int := extract(month from CURRENT_DATE)::int;
  v_py int := extract(year from CURRENT_DATE)::int;
  v_m0 date := date_trunc('month', CURRENT_DATE)::date;
  v_m1 date := (date_trunc('month', CURRENT_DATE) + interval '1 month')::date;
  v_dates date[]; i int := 0; v_d date;
  v_pr record; v_comm numeric; v_ot numeric; v_net numeric; v_fullpaid boolean;
  v_slips int := 0; v_siti_net numeric; v_siti_comm numeric; v_siti_ot numeric;
begin
  select id into v_tid from tenants where code = 'DEMO' and is_demo = true and deleted_at is null;
  if v_tid is null then
    raise exception 'Demo tenant (code=DEMO, is_demo=true) not found';
  end if;
  if not exists (select 1 from employees where id = c_emp and tenant_id = v_tid) then
    return jsonb_build_object('success', false, 'reason', 'siti_missing');
  end if;
  select id into v_owner from user_profiles where tenant_id = v_tid and role = 'owner' limit 1;

  -- 1) demo.staff login ↔ Siti (self-employee lookup matches APP.user.email to employees.email) + Staff ID
  update employees set email = null
   where tenant_id = v_tid and id <> c_emp and lower(trim(coalesce(email, ''))) = c_email;
  update employees set email = c_email, staff_code = 'EMP001'
   where id = c_emp and tenant_id = v_tid;

  -- 2) Siti OT: up to 5 past weekdays in the current month (Tue/Thu first, newest first)
  select array_agg(d order by d) into v_dates from (
    select gs::date as d
    from generate_series(v_m0, CURRENT_DATE - 1, interval '1 day') gs
    where extract(isodow from gs) < 6
      and not exists (select 1 from ot_claims c where c.tenant_id = v_tid and c.employee_id = c_emp
                        and c.claim_date = gs::date and c.id::text not like '00000000-0000-0000-0462-%')
    order by (extract(isodow from gs) in (2, 4)) desc, gs desc
    limit 5
  ) x;

  delete from ot_claims where tenant_id = v_tid and id::text like '00000000-0000-0000-0462-%';
  delete from attendance where tenant_id = v_tid and id::text like '00000000-0000-0000-0461-%';

  select coalesce(s.ot_divisor, 26) as divisor, coalesce(s.normal_hours_day, 8) as nh,
         coalesce(s.ot_multiplier_normal, 1.5) as mult
    into v_set from (select 1) x left join tenant_ot_settings s on s.tenant_id = v_tid;
  select coalesce(basic_salary, 0) into v_basic from employees where id = c_emp;
  v_daily  := v_basic / v_set.divisor;
  v_hourly := v_daily / v_set.nh;
  v_ot_h   := 10 - v_set.nh;                       -- 09:00-19:00 = 10h worked
  v_amt    := round(v_ot_h * v_hourly * v_set.mult, 2);

  if v_dates is not null then
    foreach v_d in array v_dates loop
      i := i + 1;
      delete from attendance where tenant_id = v_tid and employee_id = c_emp and date = v_d;
      insert into attendance (id, tenant_id, employee_id, date, status, clock_in, clock_out, notes)
      values (('00000000-0000-0000-0461-' || lpad(i::text, 12, '0'))::uuid, v_tid, c_emp, v_d, 'present',
              time '09:00', time '19:00', 'Demo: OT 2h');

      insert into ot_claims (id, tenant_id, employee_id, claim_date, day_type, hours_worked, ot_hours, hourly_rate,
                             daily_rate, amount, status, approved_hours, approved_amount, approved_by, approved_at, note)
      values (('00000000-0000-0000-0462-' || lpad(i::text, 12, '0'))::uuid, v_tid, c_emp, v_d, 'normal', 10, v_ot_h,
              round(v_hourly, 2), round(v_daily, 2), v_amt, 'approved', v_ot_h, v_amt, v_owner, now(),
              'Demo: stok masuk / customer visit selepas waktu kerja')
      on conflict (tenant_id, employee_id, claim_date) do update set
        day_type = excluded.day_type, hours_worked = excluded.hours_worked, ot_hours = excluded.ot_hours,
        hourly_rate = excluded.hourly_rate, daily_rate = excluded.daily_rate, amount = excluded.amount,
        status = 'approved', approved_hours = excluded.approved_hours, approved_amount = excluded.approved_amount,
        approved_by = excluded.approved_by, approved_at = excluded.approved_at, note = excluded.note,
        payroll_record_id = null, deleted_at = null;
    end loop;
  end if;

  -- 3) Commission rule safety net (reseed_demo_data() already seeds rule 0306-1 + Siti's
  --    commission rows with payout = current month; this only re-adds the rule if missing)
  insert into sales_commission_rules (id, tenant_id, sales_person_id, channel, rate_percent)
  select '00000000-0000-0000-0306-000000000001'::uuid, v_tid, c_emp, 'retail', 3.00
  where not exists (select 1 from sales_commission_rules r where r.id = '00000000-0000-0000-0306-000000000001'::uuid)
    and not exists (select 1 from sales_commission_rules r where r.tenant_id = v_tid and r.sales_person_id = c_emp
                      and r.channel = 'retail' and r.product_id is null and r.deleted_at is null);

  -- 4) Final recompute: every DEMO payslip of the current month (same as Run Payroll + OT resync)
  for v_pr in select * from payroll_records where tenant_id = v_tid and month = v_pm and year = v_py loop
    select coalesce(sum(commission_amount), 0) into v_comm from sales_commissions
     where tenant_id = v_tid and sales_person_id = v_pr.employee_id and payout_month = v_pm and payout_year = v_py
       and status = 'confirmed' and deleted_at is null;

    select coalesce(sum(coalesce(approved_amount, amount)), 0) into v_ot from ot_claims
     where tenant_id = v_tid and employee_id = v_pr.employee_id and status = 'approved' and deleted_at is null
       and claim_date >= v_m0 and claim_date < v_m1
       and (payroll_record_id is null or payroll_record_id = v_pr.id);

    v_net := round(
        coalesce(v_pr.basic_salary, 0)
      + coalesce((to_jsonb(v_pr)->>'allowance_1')::numeric, 0) + coalesce((to_jsonb(v_pr)->>'allowance_2')::numeric, 0)
      + coalesce((to_jsonb(v_pr)->>'allowance_3')::numeric, 0)
      + v_comm + v_ot
      - coalesce(v_pr.epf_employee, 0) - coalesce(v_pr.socso_employee, 0) - coalesce(v_pr.eis_employee, 0)
      - coalesce(v_pr.pcb, 0) - coalesce((to_jsonb(v_pr)->>'zakat')::numeric, 0)
      - coalesce((to_jsonb(v_pr)->>'advance')::numeric, 0)
      - coalesce((to_jsonb(v_pr)->>'deduction_1')::numeric, 0) - coalesce((to_jsonb(v_pr)->>'deduction_2')::numeric, 0), 2);

    v_fullpaid := coalesce(v_pr.amount_paid, 0) >= coalesce(v_pr.net_pay, 0) - 0.005
                  and coalesce(v_pr.balance_outstanding, 0) <= 0.005;

    update payroll_records set
      commission = v_comm,
      ot_amount = v_ot,
      net_pay = v_net,
      amount_paid = case when v_fullpaid then v_net else amount_paid end,
      balance_outstanding = case when v_fullpaid then 0 else greatest(0, round(v_net - coalesce(amount_paid, 0), 2)) end
    where id = v_pr.id;

    update ot_claims set payroll_record_id = v_pr.id
     where tenant_id = v_tid and employee_id = v_pr.employee_id and status = 'approved' and deleted_at is null
       and claim_date >= v_m0 and claim_date < v_m1 and payroll_record_id is null;

    v_slips := v_slips + 1;
    if v_pr.employee_id = c_emp then v_siti_net := v_net; v_siti_comm := v_comm; v_siti_ot := v_ot; end if;
  end loop;

  return jsonb_build_object('success', true, 'month', v_pm, 'year', v_py, 'siti_ot_claims_added', i,
    'slips_recomputed', v_slips, 'siti_commission', v_siti_comm, 'siti_ot', v_siti_ot, 'siti_net', v_siti_net);
end;
$fn$;

-- internal helper: only reset_demo_tenant() (security definer) calls it
revoke all on function public.reseed_demo_staff_payroll() from public, anon, authenticated;

create or replace function public.reset_demo_tenant()
returns jsonb
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid;
  v_reseed jsonb;
  v_reseed_ot jsonb;
  v_reseed_staff jsonb;
  v_tbl text;
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

  -- Salary Disbursement share leftovers (sd_approvals.batch_id → salary_disbursement_batches).
  -- Without this, status='shared' / pending_review / approved survives Reset → toolbar stays
  -- "Send Reminder" instead of returning to Share WhatsApp. Child first (FK). No reseed of shared batches.
  delete from sd_approvals where tenant_id = v_tenant_id;
  delete from salary_disbursement_batches where tenant_id = v_tenant_id;

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
  -- Projects child tables added after the original wipe list (FK → project_tasks / projects /
  -- employees WITHOUT on delete cascade). Guarded with to_regclass so a tenant DB that never
  -- ran pj_multi_01 / pj_auto_01 / projects_share_01 / projects_wa_share_01 still resets.
  foreach v_tbl in array array['project_task_assignees', 'project_task_checklist', 'project_task_comments',
                           'project_task_shares', 'project_share_messages', 'project_share_links'] loop
    if to_regclass('public.' || v_tbl) is not null then
      execute format('delete from public.%I where tenant_id = $1', v_tbl) using v_tenant_id;
    end if;
  end loop;
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
  -- LAST: demo.staff ↔ Siti link + Siti OT/commission + payroll recompute (needs the rows above)
  v_reseed_staff := public.reseed_demo_staff_payroll();

  return jsonb_build_object('success', true, 'tenant_id', v_tenant_id, 'reset_at', now(), 'reseed', v_reseed, 'reseed_ot', v_reseed_ot, 'reseed_staff', v_reseed_staff);
end;
$$;

grant execute on function public.reset_demo_tenant() to authenticated;

-- Roadmap (Admin → System Development)
update public.dev_roadmap_items
set stage = 'completed',
    module = 'hr_payroll',
    description = 'Reset Demo keeps demo staff testing data: new reseed_demo_staff_payroll() runs last in reset_demo_tenant() — Siti (EMP001) email = demo.staff@mpflemedia.my, up to 5 approved 2h OT claims + 09:00-19:00 attendance in the current month, then every DEMO payslip of the current month recomputed (commission from sales_commissions payout month + approved OT, net via _otNetFromRow formula, fully paid kept paid, claims linked). Also wipes project child tables (assignees/checklist/comments/shares/share links) so Reset no longer hits FK errors.'
where title = 'Demo seed: Siti OT + commission persist';

insert into public.dev_roadmap_items (title, description, module, stage)
select
  'Demo seed: Siti OT + commission persist',
  'Reset Demo keeps demo staff testing data: new reseed_demo_staff_payroll() runs last in reset_demo_tenant() — Siti (EMP001) email = demo.staff@mpflemedia.my, up to 5 approved 2h OT claims + 09:00-19:00 attendance in the current month, then every DEMO payslip of the current month recomputed (commission from sales_commissions payout month + approved OT, net via _otNetFromRow formula, fully paid kept paid, claims linked). Also wipes project child tables (assignees/checklist/comments/shares/share links) so Reset no longer hits FK errors.',
  'hr_payroll',
  'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Demo seed: Siti OT + commission persist');

-- Check (definitions only — nothing is reset by this file)
select p.proname, pg_get_function_result(p.oid) as returns
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('reset_demo_tenant', 'reseed_demo_staff_payroll')
order by 1;
