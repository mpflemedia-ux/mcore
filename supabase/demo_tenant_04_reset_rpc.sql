-- ============================================================================
-- DEMO TENANT — PART 4: reset_demo_tenant() RPC
-- Run ONCE in Supabase SQL Editor to create/update the function (this file
-- is a CREATE OR REPLACE FUNCTION - it does not touch any data by itself).
--
-- What it does when called (via the "Reset Demo Data" button in the PA
-- banner, or manually via `select reset_demo_tenant();`):
--   1. Authorization: caller must be isPlatformAdmin() via public.is_platform_admin().
--   2. Safety: only ever targets the tenant where code='DEMO' AND
--      is_demo=true - refuses to run if that tenant doesn't exist or isn't
--      flagged as demo. Never takes a tenant_id parameter from the caller,
--      so there is no way to point this at a real tenant by mistake.
--   3. Deletes every row of OPERATIONAL seed data (Parts 2/3a/3b/3c) for
--      that tenant, in dependency-safe order (children before parents).
--   4. Does NOT touch: the tenant row itself, its 2 login accounts, branch,
--      fiscal year, or Chart of Accounts (Part 1) - those stay intact.
--
-- After calling this, the demo tenant is back to its Part-1-only state
-- (empty of operational data). Re-run demo_tenant_05_reseed_all.sql to
-- repopulate everything from Parts 2/3a/3b/3c in one paste.
-- ============================================================================

create or replace function public.reset_demo_tenant()
returns jsonb
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  select id into v_tenant_id from tenants where code = 'DEMO' and is_demo = true and deleted_at is null;
  if v_tenant_id is null then
    raise exception 'Demo tenant (code=DEMO, is_demo=true) not found - refusing to reset';
  end if;

  -- ---------- DELETE phase (children before parents) ----------
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
  delete from project_tasks where tenant_id = v_tenant_id; -- re-run no-op guard (projects deleted after)
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

  return jsonb_build_object('success', true, 'tenant_id', v_tenant_id, 'reset_at', now());
end;
$$;

grant execute on function public.reset_demo_tenant() to authenticated;
