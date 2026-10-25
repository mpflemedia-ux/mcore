-- ============================================================================
-- Roadmap: Customer detail metric cards mobile fit
-- WRITE ONLY — run in Supabase SQL Editor after deploy. Never auto-executed.
-- ============================================================================

reset role;

update public.dev_roadmap_items set stage = 'completed', module = 'crm',
  description = 'Customers → detail (mobile): metric cards stack icon→amount→label with nowrap amount (fix RM-on-digits overlap); Statement(SOA)+Edit equal flex 50/50; short mobile labels via new i18n keys (Collected/Due/Invoices/Last + BM Kutipan/Hutang/Invois/Terakhir); SOA Payment History method/notes ellipsis + tap expand (.soa-clip). Scoped .crm-detail-stats / #soa-doc. No schema change. SQL: supabase/crm_customer_detail_metric_mobile_fit_01.sql.'
where title = 'Customer detail metric cards mobile fit';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Customer detail metric cards mobile fit',
  'Customers → detail (mobile): metric cards stack icon→amount→label with nowrap amount (fix RM-on-digits overlap); Statement(SOA)+Edit equal flex 50/50; short mobile labels via new i18n keys (Collected/Due/Invoices/Last + BM Kutipan/Hutang/Invois/Terakhir); SOA Payment History method/notes ellipsis + tap expand (.soa-clip). Scoped .crm-detail-stats / #soa-doc. No schema change. SQL: supabase/crm_customer_detail_metric_mobile_fit_01.sql.',
  'crm', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Customer detail metric cards mobile fit');
