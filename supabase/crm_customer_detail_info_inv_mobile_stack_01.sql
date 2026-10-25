-- ============================================================================
-- Roadmap: Customer detail Info Invoices mobile stack
-- WRITE ONLY — run in Supabase SQL Editor after deploy. Never auto-executed.
-- ============================================================================

reset role;

update public.dev_roadmap_items set stage = 'completed', module = 'crm',
  description = 'Customers → detail (mobile ≤640px): Info+Invoices grid stacks single column (Info above Invoices) via .crm-detail-info-inv; remove forced min-width:700px page h-scroll. Invoices list shows card rows (.crm-detail-inv-card: ref + status badge + amount + date) on mobile; desktop table unchanged (.crm-detail-inv-table). Tap still openPage sales inv-detail + canAccess. Statement+Edit 50/50 and metric cards untouched. Scoped CSS only. No schema change. SQL: supabase/crm_customer_detail_info_inv_mobile_stack_01.sql.'
where title = 'Customer detail Info Invoices mobile stack';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Customer detail Info Invoices mobile stack',
  'Customers → detail (mobile ≤640px): Info+Invoices grid stacks single column (Info above Invoices) via .crm-detail-info-inv; remove forced min-width:700px page h-scroll. Invoices list shows card rows (.crm-detail-inv-card: ref + status badge + amount + date) on mobile; desktop table unchanged (.crm-detail-inv-table). Tap still openPage sales inv-detail + canAccess. Statement+Edit 50/50 and metric cards untouched. Scoped CSS only. No schema change. SQL: supabase/crm_customer_detail_info_inv_mobile_stack_01.sql.',
  'crm', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Customer detail Info Invoices mobile stack');
