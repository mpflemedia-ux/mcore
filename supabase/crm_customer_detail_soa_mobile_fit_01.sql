-- ============================================================================
-- Roadmap: Customer detail + SOA mobile layout fit
-- WRITE ONLY — run in Supabase SQL Editor after deploy. Never auto-executed.
-- ============================================================================

reset role;

update public.dev_roadmap_items set stage = 'completed', module = 'crm',
  description = 'Customers → detail (mobile): Statement(SOA)+Edit no longer overlap metric cards (crm-detail-actions full-width wrap). SOA invoices/payment tables: width max-content + nowrap money/method/notes so RM amounts stay one line and bank_transfer reads as Bank Transfer; horizontal scroll inside #soa-doc only (no page scroll). Scoped CSS @media max-width 640px. No schema/business-logic change.'
where title = 'Customer detail mobile layout fit';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Customer detail mobile layout fit',
  'Customers → detail (mobile): Statement(SOA)+Edit no longer overlap metric cards (crm-detail-actions full-width wrap). SOA invoices/payment tables: width max-content + nowrap money/method/notes so RM amounts stay one line and bank_transfer reads as Bank Transfer; horizontal scroll inside #soa-doc only (no page scroll). Scoped CSS @media max-width 640px. No schema/business-logic change.',
  'crm', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Customer detail mobile layout fit');
