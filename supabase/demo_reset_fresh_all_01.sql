-- ============================================================================
-- DEMO RESET — fresh demo for ALL features (DEMO tenant only)
--
-- Extends public.reset_demo_tenant() so wipe also hard-deletes DEMO-tenant rows that
-- reseed does not recreate and that re-attach to fixed seed UUIDs:
--   notifications, payment_claims,
--   doc_shares, doc_views, doc_responses, doc_attachments, doc_notes, doc_public_links
-- Same hard-DELETE style as sibling tables in this function (no deleted_at filter).
-- Does NOT change reseed_demo_data() / fixed UUIDs. Does NOT touch wa_templates / auth.
--
-- WRITE ONLY — run in Supabase SQL Editor. Never auto-executed by the app.
-- Safe: resolves tenant via code='DEMO' AND is_demo=true; refuses otherwise.
-- After this runs: Support → Reset Demo → INV badges / For-you / public links are fresh.
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

  return jsonb_build_object('success', true, 'tenant_id', v_tenant_id, 'reset_at', now(), 'reseed', v_reseed);
end;
$$;

grant execute on function public.reset_demo_tenant() to authenticated;


-- Roadmap (write-only; Admin → System Development)
update public.dev_roadmap_items set stage = 'completed', module = 'platform',
  description = 'Reset Demo (DEMO tenant) returns fresh demo for ALL features: wipe also clears notifications, payment_claims, doc_shares, doc_views, doc_responses, doc_attachments, doc_notes, doc_public_links so WA badges/History, For-you slips, public links and attach logs do not survive wipe+reseed; confirm modal + success toast EN/BM list those clears; hard DELETE matches existing reset_demo_tenant style. No reseed UUID churn. SQL: supabase/demo_reset_fresh_all_01.sql.'
where title = 'Reset Demo returns fresh demo for all features';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Reset Demo returns fresh demo for all features',
  'Reset Demo (DEMO tenant) returns fresh demo for ALL features: wipe also clears notifications, payment_claims, doc_shares, doc_views, doc_responses, doc_attachments, doc_notes, doc_public_links so WA badges/History, For-you slips, public links and attach logs do not survive wipe+reseed; confirm modal + success toast EN/BM list those clears; hard DELETE matches existing reset_demo_tenant style. No reseed UUID churn. SQL: supabase/demo_reset_fresh_all_01.sql.',
  'platform', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Reset Demo returns fresh demo for all features');
