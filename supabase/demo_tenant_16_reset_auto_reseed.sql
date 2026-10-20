-- ============================================================================
-- DEMO TENANT — PART 16: reset_demo_tenant() v2 — auto-reseed + new tables
--
-- Two changes from Part 4:
-- 1. Deletes the 4 tables Part 15 added (bookings, booking_services,
--    shifts, shift_swaps) in dependency-safe order, so a reset fully
--    clears them too.
-- 2. Calls public.reseed_demo_data() (Part 15) at the end, right after the
--    delete phase. The in-app "Reset Demo Data" button now does a true
--    one-click wipe + repopulate with fresh, CURRENT_DATE-relative demo
--    data — no more "run demo_tenant_05_reseed_all.sql afterwards" step.
--
-- Run demo_tenant_15_reseed_relative.sql BEFORE this file (it creates the
-- public.reseed_demo_data() function this one calls).
-- ============================================================================

reset role;

create or replace function public.reset_demo_tenant()
returns jsonb
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid;
  v_reseed jsonb;
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

  -- ---------- REPOPULATE phase (NEW: one-click wipe + reseed) ----------
  v_reseed := public.reseed_demo_data();

  return jsonb_build_object('success', true, 'tenant_id', v_tenant_id, 'reset_at', now(), 'reseed', v_reseed);
end;
$$;

grant execute on function public.reset_demo_tenant() to authenticated;
