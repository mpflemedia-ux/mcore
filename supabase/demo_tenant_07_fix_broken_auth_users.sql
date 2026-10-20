-- ============================================================================
-- DEMO TENANT — fix: force-delete the 2 broken auth users
-- Run this in Supabase SQL Editor. The raw INSERT into auth.users from Part 1
-- produced rows that are malformed enough that even the Dashboard's own
-- "Delete user" fails ("Database error loading user") - so this deletes them
-- directly via SQL instead, in dependency order (children first).
--
-- Wrapped as a SECURITY DEFINER function (not a plain anonymous DO block):
-- the SQL Editor's session role does not have direct SELECT/DELETE on
-- auth.users (confirmed by the "permission denied for table users" error on
-- the first attempt), the same reason Mike's own register_tenant() etc. are
-- all SECURITY DEFINER functions rather than plain blocks.
--
-- Also wipes ALL Part 2/3a/3b/3c operational data first (same delete order
-- as reset_demo_tenant()), because several of those rows reference the
-- owner/staff user_profiles id (leave_requests.approved_by,
-- pos_sessions.cashier_id, expense_claims.claimed_by/approved_by, etc.) and
-- block the user_profiles delete with a foreign key violation otherwise.
-- You'll need to re-run demo_tenant_05_reseed_all.sql afterwards anyway.
--
-- AFTER running this: go to Supabase Dashboard -> Authentication -> Users ->
-- "Add User" and create BOTH accounts fresh there (NOT via SQL this time):
--   demo.owner@mpflemedia.my / password: mcore123 / tick "Auto Confirm User"
--   demo.staff@mpflemedia.my / password: mcore123 / tick "Auto Confirm User"
-- Then copy both new User UIDs and send them back - a follow-up SQL file will
-- re-link user_profiles + the Planner entries to the new UIDs, and you'll
-- re-run demo_tenant_05_reseed_all.sql to repopulate everything.
-- ============================================================================

-- session role sometimes gets stuck on 'authenticated' instead of 'postgres'
-- in this SQL Editor (seen earlier - RESET ROLE fixed it), which blocks
-- CREATE on schema public. Reset it first so this runs in one shot.
reset role;

create or replace function public._fix_demo_auth_cleanup()
returns jsonb
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid;
  v_owner_id uuid;
  v_staff_id uuid;
begin
  select id into v_tenant_id from tenants where code = 'DEMO';
  select id into v_owner_id from auth.users where email = 'demo.owner@mpflemedia.my';
  select id into v_staff_id from auth.users where email = 'demo.staff@mpflemedia.my';

  -- ---------- wipe all operational data first (same order as reset_demo_tenant()) ----------
  if v_tenant_id is not null then
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
  end if;

  -- ---------- user_profiles.id references auth.users(id) ----------
  if v_owner_id is not null then
    delete from user_profiles where id = v_owner_id;
  end if;
  if v_staff_id is not null then
    delete from user_profiles where id = v_staff_id;
  end if;

  -- ---------- auth internals, children first ----------
  -- Sessions/refresh_tokens deletes are best-effort (wrapped individually)
  -- since neither account ever completed a successful login.
  if v_owner_id is not null then
    delete from auth.identities where user_id = v_owner_id;
    begin delete from auth.sessions where user_id = v_owner_id; exception when others then null; end;
    begin delete from auth.refresh_tokens where user_id = v_owner_id::text; exception when others then null; end;
    delete from auth.users where id = v_owner_id;
  end if;

  if v_staff_id is not null then
    delete from auth.identities where user_id = v_staff_id;
    begin delete from auth.sessions where user_id = v_staff_id; exception when others then null; end;
    begin delete from auth.refresh_tokens where user_id = v_staff_id::text; exception when others then null; end;
    delete from auth.users where id = v_staff_id;
  end if;

  return jsonb_build_object(
    'owner_deleted', v_owner_id is not null,
    'staff_deleted', v_staff_id is not null,
    'tenant_wiped', v_tenant_id is not null
  );
end;
$$;

grant execute on function public._fix_demo_auth_cleanup() to authenticated;

select public._fix_demo_auth_cleanup();

-- sanity check: should return 0 rows
select email, id from auth.users where email in ('demo.owner@mpflemedia.my', 'demo.staff@mpflemedia.my');

-- one-off function, no longer needed once the cleanup above has run
drop function if exists public._fix_demo_auth_cleanup();
