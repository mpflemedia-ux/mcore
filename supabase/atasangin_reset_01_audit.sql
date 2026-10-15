-- atasangin_reset_01_audit.sql  (READ ONLY - safe to run, changes nothing)
-- Tenant: (select id from public.tenants where name ilike 'Atas Angin%' limit 1)
-- Tables (transactional, all rows for this tenant):
--   bookings, bank_statement_lines, payment_allocations, payments, credit_notes, invoice_items, delivery_orders, invoices, quotation_items, quotations, pos_transaction_items, pos_transactions, pos_sessions, petty_cash_expenses, petty_cash_floats, expense_claims, cash_advances, payment_voucher_batch_lines, payment_voucher_batches, payment_vouchers, supplier_payments, supplier_bill_items, supplier_bills, goods_received_items, goods_received_notes, purchase_order_items, purchase_orders, stock_movements, depreciation_runs, journal_lines, journal_entries, doc_counters
-- KEPT (never touched): tenants, user_profiles, employees, customers, suppliers,
--   products (incl. stock_qty), chart_of_accounts, default_account_mappings,
--   booking_services, booking_service_staff, fixed_assets, branches, settings,
--   payroll_records, service_requests, projects, crm, notifications, audit_logs.

-- 0) Tenant check: must return exactly ONE row (Atas Angin My Sdn. Bhd.)
select id, name, created_at from public.tenants where name ilike 'Atas Angin%';

-- 1) Row counts per table
select 'bookings' as tbl, count(*) as n from public.bookings where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1)
union all
select 'bank_statement_lines' as tbl, count(*) as n from public.bank_statement_lines where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1)
union all
select 'payment_allocations' as tbl, count(*) as n from public.payment_allocations where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1)
union all
select 'payments' as tbl, count(*) as n from public.payments where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1)
union all
select 'credit_notes' as tbl, count(*) as n from public.credit_notes where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1)
union all
select 'invoice_items' as tbl, count(*) as n from public.invoice_items where invoice_id in (select id from public.invoices where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1))
union all
select 'delivery_orders' as tbl, count(*) as n from public.delivery_orders where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1)
union all
select 'invoices' as tbl, count(*) as n from public.invoices where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1)
union all
select 'quotation_items' as tbl, count(*) as n from public.quotation_items where quotation_id in (select id from public.quotations where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1))
union all
select 'quotations' as tbl, count(*) as n from public.quotations where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1)
union all
select 'pos_transaction_items' as tbl, count(*) as n from public.pos_transaction_items where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1)
union all
select 'pos_transactions' as tbl, count(*) as n from public.pos_transactions where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1)
union all
select 'pos_sessions' as tbl, count(*) as n from public.pos_sessions where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1)
union all
select 'petty_cash_expenses' as tbl, count(*) as n from public.petty_cash_expenses where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1)
union all
select 'petty_cash_floats' as tbl, count(*) as n from public.petty_cash_floats where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1)
union all
select 'expense_claims' as tbl, count(*) as n from public.expense_claims where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1)
union all
select 'cash_advances' as tbl, count(*) as n from public.cash_advances where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1)
union all
select 'payment_voucher_batch_lines' as tbl, count(*) as n from public.payment_voucher_batch_lines where batch_id in (select id from public.payment_voucher_batches where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1))
union all
select 'payment_voucher_batches' as tbl, count(*) as n from public.payment_voucher_batches where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1)
union all
select 'payment_vouchers' as tbl, count(*) as n from public.payment_vouchers where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1)
union all
select 'supplier_payments' as tbl, count(*) as n from public.supplier_payments where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1)
union all
select 'supplier_bill_items' as tbl, count(*) as n from public.supplier_bill_items where bill_id in (select id from public.supplier_bills where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1))
union all
select 'supplier_bills' as tbl, count(*) as n from public.supplier_bills where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1)
union all
select 'goods_received_items' as tbl, count(*) as n from public.goods_received_items where grn_id in (select id from public.goods_received_notes where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1))
union all
select 'goods_received_notes' as tbl, count(*) as n from public.goods_received_notes where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1)
union all
select 'purchase_order_items' as tbl, count(*) as n from public.purchase_order_items where po_id in (select id from public.purchase_orders where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1))
union all
select 'purchase_orders' as tbl, count(*) as n from public.purchase_orders where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1)
union all
select 'stock_movements' as tbl, count(*) as n from public.stock_movements where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1)
union all
select 'depreciation_runs' as tbl, count(*) as n from public.depreciation_runs where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1)
union all
select 'journal_lines' as tbl, count(*) as n from public.journal_lines where entry_id in (select id from public.journal_entries where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1))
union all
select 'journal_entries' as tbl, count(*) as n from public.journal_entries where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1)
union all
select 'doc_counters' as tbl, count(*) as n from public.doc_counters where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1);

-- 2) Journal detail (what dashboard Revenue reads)
select je.ref_no, je.entry_date, je.description, je.source_table, je.created_at, je.created_by,
  sum(jl.debit_amt) as debit, sum(jl.credit_amt) as credit
from public.journal_entries je left join public.journal_lines jl on jl.entry_id = je.id
where je.tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1)
group by je.id order by je.ref_no;

select je.ref_no, coa.code, coa.name_en, jl.debit_amt, jl.credit_amt
from public.journal_lines jl join public.journal_entries je on je.id = jl.entry_id
left join public.chart_of_accounts coa on coa.id = jl.account_id
where je.tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1) order by je.ref_no, jl.line_no;

-- 3) Every row per table (full row as json, newest first)
select 'bookings' as tbl, x.created_at, to_jsonb(x)->>'created_by' as created_by, coalesce(to_jsonb(x)->>'total', to_jsonb(x)->>'amount', to_jsonb(x)->>'total_amount') as amount, to_jsonb(x) as row from public.bookings x where x.tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1) order by x.created_at desc;
select 'bank_statement_lines' as tbl, x.created_at, to_jsonb(x)->>'created_by' as created_by, coalesce(to_jsonb(x)->>'total', to_jsonb(x)->>'amount', to_jsonb(x)->>'total_amount') as amount, to_jsonb(x) as row from public.bank_statement_lines x where x.tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1) order by x.created_at desc;
select 'payment_allocations' as tbl, x.created_at, to_jsonb(x)->>'created_by' as created_by, coalesce(to_jsonb(x)->>'total', to_jsonb(x)->>'amount', to_jsonb(x)->>'total_amount') as amount, to_jsonb(x) as row from public.payment_allocations x where x.tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1) order by x.created_at desc;
select 'payments' as tbl, x.created_at, to_jsonb(x)->>'created_by' as created_by, coalesce(to_jsonb(x)->>'total', to_jsonb(x)->>'amount', to_jsonb(x)->>'total_amount') as amount, to_jsonb(x) as row from public.payments x where x.tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1) order by x.created_at desc;
select 'credit_notes' as tbl, x.created_at, to_jsonb(x)->>'created_by' as created_by, coalesce(to_jsonb(x)->>'total', to_jsonb(x)->>'amount', to_jsonb(x)->>'total_amount') as amount, to_jsonb(x) as row from public.credit_notes x where x.tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1) order by x.created_at desc;
select 'invoice_items' as tbl, x.created_at, to_jsonb(x)->>'created_by' as created_by, coalesce(to_jsonb(x)->>'total', to_jsonb(x)->>'amount', to_jsonb(x)->>'total_amount') as amount, to_jsonb(x) as row from public.invoice_items x where invoice_id in (select id from public.invoices where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1)) order by x.created_at desc;
select 'delivery_orders' as tbl, x.created_at, to_jsonb(x)->>'created_by' as created_by, coalesce(to_jsonb(x)->>'total', to_jsonb(x)->>'amount', to_jsonb(x)->>'total_amount') as amount, to_jsonb(x) as row from public.delivery_orders x where x.tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1) order by x.created_at desc;
select 'invoices' as tbl, x.created_at, to_jsonb(x)->>'created_by' as created_by, coalesce(to_jsonb(x)->>'total', to_jsonb(x)->>'amount', to_jsonb(x)->>'total_amount') as amount, to_jsonb(x) as row from public.invoices x where x.tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1) order by x.created_at desc;
select 'quotation_items' as tbl, x.created_at, to_jsonb(x)->>'created_by' as created_by, coalesce(to_jsonb(x)->>'total', to_jsonb(x)->>'amount', to_jsonb(x)->>'total_amount') as amount, to_jsonb(x) as row from public.quotation_items x where quotation_id in (select id from public.quotations where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1)) order by x.created_at desc;
select 'quotations' as tbl, x.created_at, to_jsonb(x)->>'created_by' as created_by, coalesce(to_jsonb(x)->>'total', to_jsonb(x)->>'amount', to_jsonb(x)->>'total_amount') as amount, to_jsonb(x) as row from public.quotations x where x.tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1) order by x.created_at desc;
select 'pos_transaction_items' as tbl, x.created_at, to_jsonb(x)->>'created_by' as created_by, coalesce(to_jsonb(x)->>'total', to_jsonb(x)->>'amount', to_jsonb(x)->>'total_amount') as amount, to_jsonb(x) as row from public.pos_transaction_items x where x.tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1) order by x.created_at desc;
select 'pos_transactions' as tbl, x.created_at, to_jsonb(x)->>'created_by' as created_by, coalesce(to_jsonb(x)->>'total', to_jsonb(x)->>'amount', to_jsonb(x)->>'total_amount') as amount, to_jsonb(x) as row from public.pos_transactions x where x.tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1) order by x.created_at desc;
select 'pos_sessions' as tbl, x.created_at, to_jsonb(x)->>'created_by' as created_by, coalesce(to_jsonb(x)->>'total', to_jsonb(x)->>'amount', to_jsonb(x)->>'total_amount') as amount, to_jsonb(x) as row from public.pos_sessions x where x.tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1) order by x.created_at desc;
select 'petty_cash_expenses' as tbl, x.created_at, to_jsonb(x)->>'created_by' as created_by, coalesce(to_jsonb(x)->>'total', to_jsonb(x)->>'amount', to_jsonb(x)->>'total_amount') as amount, to_jsonb(x) as row from public.petty_cash_expenses x where x.tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1) order by x.created_at desc;
select 'petty_cash_floats' as tbl, x.created_at, to_jsonb(x)->>'created_by' as created_by, coalesce(to_jsonb(x)->>'total', to_jsonb(x)->>'amount', to_jsonb(x)->>'total_amount') as amount, to_jsonb(x) as row from public.petty_cash_floats x where x.tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1) order by x.created_at desc;
select 'expense_claims' as tbl, x.created_at, to_jsonb(x)->>'created_by' as created_by, coalesce(to_jsonb(x)->>'total', to_jsonb(x)->>'amount', to_jsonb(x)->>'total_amount') as amount, to_jsonb(x) as row from public.expense_claims x where x.tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1) order by x.created_at desc;
select 'cash_advances' as tbl, x.created_at, to_jsonb(x)->>'created_by' as created_by, coalesce(to_jsonb(x)->>'total', to_jsonb(x)->>'amount', to_jsonb(x)->>'total_amount') as amount, to_jsonb(x) as row from public.cash_advances x where x.tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1) order by x.created_at desc;
select 'payment_voucher_batch_lines' as tbl, x.created_at, to_jsonb(x)->>'created_by' as created_by, coalesce(to_jsonb(x)->>'total', to_jsonb(x)->>'amount', to_jsonb(x)->>'total_amount') as amount, to_jsonb(x) as row from public.payment_voucher_batch_lines x where batch_id in (select id from public.payment_voucher_batches where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1)) order by x.created_at desc;
select 'payment_voucher_batches' as tbl, x.created_at, to_jsonb(x)->>'created_by' as created_by, coalesce(to_jsonb(x)->>'total', to_jsonb(x)->>'amount', to_jsonb(x)->>'total_amount') as amount, to_jsonb(x) as row from public.payment_voucher_batches x where x.tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1) order by x.created_at desc;
select 'payment_vouchers' as tbl, x.created_at, to_jsonb(x)->>'created_by' as created_by, coalesce(to_jsonb(x)->>'total', to_jsonb(x)->>'amount', to_jsonb(x)->>'total_amount') as amount, to_jsonb(x) as row from public.payment_vouchers x where x.tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1) order by x.created_at desc;
select 'supplier_payments' as tbl, x.created_at, to_jsonb(x)->>'created_by' as created_by, coalesce(to_jsonb(x)->>'total', to_jsonb(x)->>'amount', to_jsonb(x)->>'total_amount') as amount, to_jsonb(x) as row from public.supplier_payments x where x.tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1) order by x.created_at desc;
select 'supplier_bill_items' as tbl, x.created_at, to_jsonb(x)->>'created_by' as created_by, coalesce(to_jsonb(x)->>'total', to_jsonb(x)->>'amount', to_jsonb(x)->>'total_amount') as amount, to_jsonb(x) as row from public.supplier_bill_items x where bill_id in (select id from public.supplier_bills where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1)) order by x.created_at desc;
select 'supplier_bills' as tbl, x.created_at, to_jsonb(x)->>'created_by' as created_by, coalesce(to_jsonb(x)->>'total', to_jsonb(x)->>'amount', to_jsonb(x)->>'total_amount') as amount, to_jsonb(x) as row from public.supplier_bills x where x.tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1) order by x.created_at desc;
select 'goods_received_items' as tbl, x.created_at, to_jsonb(x)->>'created_by' as created_by, coalesce(to_jsonb(x)->>'total', to_jsonb(x)->>'amount', to_jsonb(x)->>'total_amount') as amount, to_jsonb(x) as row from public.goods_received_items x where grn_id in (select id from public.goods_received_notes where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1)) order by x.created_at desc;
select 'goods_received_notes' as tbl, x.created_at, to_jsonb(x)->>'created_by' as created_by, coalesce(to_jsonb(x)->>'total', to_jsonb(x)->>'amount', to_jsonb(x)->>'total_amount') as amount, to_jsonb(x) as row from public.goods_received_notes x where x.tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1) order by x.created_at desc;
select 'purchase_order_items' as tbl, x.created_at, to_jsonb(x)->>'created_by' as created_by, coalesce(to_jsonb(x)->>'total', to_jsonb(x)->>'amount', to_jsonb(x)->>'total_amount') as amount, to_jsonb(x) as row from public.purchase_order_items x where po_id in (select id from public.purchase_orders where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1)) order by x.created_at desc;
select 'purchase_orders' as tbl, x.created_at, to_jsonb(x)->>'created_by' as created_by, coalesce(to_jsonb(x)->>'total', to_jsonb(x)->>'amount', to_jsonb(x)->>'total_amount') as amount, to_jsonb(x) as row from public.purchase_orders x where x.tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1) order by x.created_at desc;
select 'stock_movements' as tbl, x.created_at, to_jsonb(x)->>'created_by' as created_by, coalesce(to_jsonb(x)->>'total', to_jsonb(x)->>'amount', to_jsonb(x)->>'total_amount') as amount, to_jsonb(x) as row from public.stock_movements x where x.tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1) order by x.created_at desc;
select 'depreciation_runs' as tbl, x.created_at, to_jsonb(x)->>'created_by' as created_by, coalesce(to_jsonb(x)->>'total', to_jsonb(x)->>'amount', to_jsonb(x)->>'total_amount') as amount, to_jsonb(x) as row from public.depreciation_runs x where x.tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1) order by x.created_at desc;
select 'journal_lines' as tbl, x.created_at, to_jsonb(x)->>'created_by' as created_by, coalesce(to_jsonb(x)->>'total', to_jsonb(x)->>'amount', to_jsonb(x)->>'total_amount') as amount, to_jsonb(x) as row from public.journal_lines x where entry_id in (select id from public.journal_entries where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1)) order by x.created_at desc;
select 'journal_entries' as tbl, x.created_at, to_jsonb(x)->>'created_by' as created_by, coalesce(to_jsonb(x)->>'total', to_jsonb(x)->>'amount', to_jsonb(x)->>'total_amount') as amount, to_jsonb(x) as row from public.journal_entries x where x.tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1) order by x.created_at desc;
select 'doc_counters' as tbl, x.created_at, to_jsonb(x)->>'created_by' as created_by, coalesce(to_jsonb(x)->>'total', to_jsonb(x)->>'amount', to_jsonb(x)->>'total_amount') as amount, to_jsonb(x) as row from public.doc_counters x where x.tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1) order by x.created_at desc;
