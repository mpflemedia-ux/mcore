-- atasangin_reset_02_reset.sql  (DESTRUCTIVE - HARD DELETE, test data only)
-- Run atasangin_reset_01_audit.sql FIRST and confirm tenant + rows.
-- Idempotent: running twice just deletes 0 rows. All-or-nothing (begin/commit).
-- ============================================================
-- WIPED for Atas Angin only, in FK order (children before headers):
-- Tenant: (select id from public.tenants where name ilike 'Atas Angin%' limit 1)
-- Tables (transactional, all rows for this tenant):
--   bookings, bank_statement_lines, payment_allocations, payments, credit_notes, invoice_items, delivery_orders, invoices, quotation_items, quotations, pos_transaction_items, pos_transactions, pos_sessions, petty_cash_expenses, petty_cash_floats, expense_claims, cash_advances, payment_voucher_batch_lines, payment_voucher_batches, payment_vouchers, supplier_payments, supplier_bill_items, supplier_bills, goods_received_items, goods_received_notes, purchase_order_items, purchase_orders, stock_movements, depreciation_runs, journal_lines, journal_entries, doc_counters
-- KEPT (never touched): tenants, user_profiles, employees, customers, suppliers,
--   products (incl. stock_qty), chart_of_accounts, default_account_mappings,
--   booking_services, booking_service_staff, fixed_assets, branches, settings,
--   payroll_records, service_requests, projects, crm, notifications, audit_logs.

-- !! bookings: ALL bookings for this tenant are deleted (incl. real public bookings).
-- !!   If Atas Angin has real customer bookings, delete the bookings line below first.
-- doc_counters rows for the tenant are deleted so next_ref_no() restarts (JNL-0001, INV-0001...).
-- products.stock_qty is NOT recalculated (see note at bottom).
-- ============================================================

begin;

delete from public.bookings where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1);
delete from public.bank_statement_lines where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1);
delete from public.payment_allocations where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1);
delete from public.payments where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1);
delete from public.credit_notes where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1);
delete from public.invoice_items where invoice_id in (select id from public.invoices where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1));
delete from public.delivery_orders where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1);
delete from public.invoices where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1);
delete from public.quotation_items where quotation_id in (select id from public.quotations where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1));
delete from public.quotations where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1);
delete from public.pos_transaction_items where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1);
delete from public.pos_transactions where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1);
delete from public.pos_sessions where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1);
delete from public.petty_cash_expenses where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1);
delete from public.petty_cash_floats where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1);
delete from public.expense_claims where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1);
delete from public.cash_advances where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1);
delete from public.payment_voucher_batch_lines where batch_id in (select id from public.payment_voucher_batches where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1));
delete from public.payment_voucher_batches where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1);
delete from public.payment_vouchers where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1);
delete from public.supplier_payments where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1);
delete from public.supplier_bill_items where bill_id in (select id from public.supplier_bills where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1));
delete from public.supplier_bills where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1);
delete from public.goods_received_items where grn_id in (select id from public.goods_received_notes where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1));
delete from public.goods_received_notes where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1);
delete from public.purchase_order_items where po_id in (select id from public.purchase_orders where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1));
delete from public.purchase_orders where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1);
delete from public.stock_movements where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1);
delete from public.depreciation_runs where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1);
delete from public.journal_lines where entry_id in (select id from public.journal_entries where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1));
delete from public.journal_entries where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1);
delete from public.doc_counters where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1);

commit;

-- Verify: every n must be 0
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

-- Stock check (review manually; NOT changed by this script):
select code, name_en, stock_qty from public.products where tenant_id = (select id from public.tenants where name ilike 'Atas Angin%' limit 1) and deleted_at is null order by code;
