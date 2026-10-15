-- atasangin_reset_01_audit.sql  (READ ONLY. Plain SQL, cannot fail on missing tables)
-- Run each query separately (highlight + Run) in Supabase SQL Editor.

-- Q0) Tenant check: must be exactly ONE row
select id, name, created_at from public.tenants where name ilike 'Atas Angin%';

-- Q1) AUTOMATIC row counts for EVERY public table that has tenant_id (Atas Angin only, non-zero only)
with t as (select id from public.tenants where name ilike 'Atas Angin%' order by created_at limit 1)
select x.table_name,
  (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I where tenant_id = %L', x.table_name, (select id from t)), false, true, '')))[1]::text::int as n
from (select distinct k.table_name from information_schema.columns k
      join information_schema.tables it on it.table_schema=k.table_schema and it.table_name=k.table_name and it.table_type='BASE TABLE'
      where k.table_schema='public' and k.column_name='tenant_id') x
order by n desc, x.table_name;

-- Q2) Reset candidate list: which exist, filter column used, and row count
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
select ord, tbl, filter_col,
  case when filt is null then null else (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I where %s', tbl, filt), false, true, '')))[1]::text::int end as n
from f order by ord;

-- Q3) Journal detail (what dashboard Revenue reads)
with t as (select id from public.tenants where name ilike 'Atas Angin%' order by created_at limit 1)
select je.ref_no, je.description, je.created_at, to_jsonb(je)->>'entry_date' as entry_date, to_jsonb(je)->>'source_table' as source_table, to_jsonb(je)->>'created_by' as created_by,
  (select sum(jl.debit_amt) from public.journal_lines jl where jl.entry_id = je.id) as debit,
  (select sum(jl.credit_amt) from public.journal_lines jl where jl.entry_id = je.id) as credit
from public.journal_entries je where je.tenant_id = (select id from t) order by je.ref_no;

-- Q4) GENERATOR: copy the output cell and run it to see every row (json) per existing candidate table
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
select string_agg(format('select %L as tbl, to_jsonb(x) as row from public.%I x where %s', tbl, tbl, filt), E'\nunion all\n' order by ord) || ';'
from f where filt is not null;
