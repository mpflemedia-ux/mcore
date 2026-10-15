-- atasangin_reset_02_reset.sql  (GENERATOR. Running this deletes NOTHING by itself.)
-- STEP A: run this query. It outputs ONE text cell = the delete script,
--         built only from tables that really exist, children (parent fk) before headers.
-- STEP B: copy that cell into a new SQL Editor tab and run it (begin..commit, idempotent).
--
-- WIPED (if they exist): bookings, bank_statement_lines, payment_allocations, payments, credit_notes,
--   invoice_items, delivery_order_items, delivery_orders, invoices, quotation_items, quotations,
--   pos_transaction_items, pos_transactions, pos_sessions, petty_cash_expenses, petty_cash_floats,
--   expense_claims, cash_advances, payment_voucher_batch_lines, payment_voucher_batches, payment_vouchers,
--   supplier_payments, supplier_bill_items, supplier_bills, goods_received_items, goods_received_notes,
--   purchase_order_items, purchase_orders, stock_movements, depreciation_runs, journal_lines,
--   journal_entries, doc_counters (so next number restarts at 0001).
-- KEPT: tenants, user_profiles, employees, customers, suppliers, products (stock_qty not recalculated),
--   chart_of_accounts, default_account_mappings, booking_services, booking_service_staff, fixed_assets,
--   branches, settings, payroll, service desk, projects, CRM, notifications, audit_logs.
-- !! The bookings line deletes ALL Atas Angin bookings. If any are real, delete that line in STEP B.

with t as (select id from public.tenants where name ilike 'Atas Angin%' order by created_at limit 1),
c as (select * from (values
 (1,'bookings','tenant_id',null,null),
 (2,'bank_statement_lines','tenant_id',null,null),
 (3,'payment_allocations','tenant_id',null,null),
 (4,'payments','tenant_id',null,null),
 (5,'credit_notes','tenant_id',null,null),
 (6,'invoice_items','invoice_id','invoices',null),
 (7,'delivery_order_items','delivery_order_id','delivery_orders',null),
 (8,'delivery_orders','tenant_id',null,null),
 (9,'invoices','tenant_id',null,null),
 (10,'quotation_items','quotation_id','quotations',null),
 (11,'quotations','tenant_id',null,null),
 (12,'pos_transaction_items','transaction_id','pos_transactions',null),
 (13,'pos_transactions','tenant_id',null,null),
 (14,'pos_sessions','tenant_id',null,null),
 (15,'petty_cash_expenses','float_id','petty_cash_floats',null),
 (16,'petty_cash_floats','tenant_id',null,null),
 (17,'expense_claims','tenant_id',null,null),
 (18,'cash_advances','tenant_id',null,null),
 (19,'payment_voucher_batch_lines','batch_id','payment_voucher_batches',null),
 (20,'payment_voucher_batches','tenant_id',null,null),
 (21,'payment_vouchers','tenant_id',null,null),
 (22,'supplier_payments','tenant_id',null,null),
 (23,'supplier_bill_items','bill_id','supplier_bills',null),
 (24,'supplier_bills','tenant_id',null,null),
 (25,'goods_received_items','grn_id','goods_received_notes',null),
 (26,'goods_received_notes','tenant_id',null,null),
 (27,'purchase_order_items','po_id','purchase_orders',null),
 (28,'purchase_orders','tenant_id',null,null),
 (29,'stock_movements','tenant_id',null,null),
 (30,'depreciation_runs','tenant_id',null,null),
 (31,'journal_lines','entry_id','journal_entries',null),
 (32,'journal_entries','tenant_id',null,null),
 (33,'doc_counters','tenant_id',null,null)
) as c(ord, tbl, parent_fk, parent_tbl, x)),
ex as (
  select c.ord, c.tbl, c.parent_tbl,
    exists(select 1 from information_schema.columns k where k.table_schema='public' and k.table_name=c.tbl and k.column_name='tenant_id') as has_tenant,
    exists(select 1 from information_schema.columns k where k.table_schema='public' and k.table_name=c.tbl and k.column_name=c.parent_fk) as has_parent_fk,
    exists(select 1 from information_schema.columns k where k.table_schema='public' and k.table_name=c.parent_tbl and k.column_name='tenant_id') as parent_ok,
    c.parent_fk
  from c join information_schema.tables it on it.table_schema='public' and it.table_name=c.tbl and it.table_type='BASE TABLE'
),
f as (
  select ord, tbl, case
    when has_tenant then format('tenant_id = %L', (select id from t))
    when has_parent_fk and parent_ok then format('%I in (select id from public.%I where tenant_id = %L)', parent_fk, parent_tbl, (select id from t))
  end as filt,
  case when has_tenant then 'tenant_id' when has_parent_fk and parent_ok then parent_fk||' -> '||parent_tbl else 'NO FILTER (skipped)' end as filter_col
  from ex
)
select E'-- Atas Angin reset (generated)\nbegin;\n'
  || string_agg(
       case when tbl='bookings' then E'-- !! remove next line if real customer bookings exist\n' else '' end
       || format('delete from public.%I where %s;', tbl, filt), E'\n' order by ord)
  || E'\ncommit;\n\n-- verify (all n must be 0)\n'
  || string_agg(format('select %L as tbl, count(*) as n from public.%I where %s', tbl, tbl, filt), E'\nunion all\n' order by ord)
  || ';' as script
from f where filt is not null;
