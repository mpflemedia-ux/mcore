-- ============================================================================
-- DEMO TENANT — PART 2a: INTROSPECTION (read-only, does not change anything)
-- Run in Supabase SQL Editor, then use the result pane's "Download CSV"
-- button and send that file back.
-- ============================================================================
select table_name, ordinal_position, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and (
    table_name in (
      'tenants','user_profiles','plans',
      'customers','customer_contacts',
      'quotations','quotation_items','invoices','invoice_items','payments','payment_allocations',
      'pos_sessions','pos_transactions','pos_transaction_items',
      'products','product_categories','warehouses','stock_movements',
      'delivery_orders','work_orders',
      'employees','payroll_records',
      'fiscal_years','chart_of_accounts','journal_entries','journal_lines',
      'bank_accounts','fixed_assets','depreciation_schedule',
      'expense_claims','expense_claim_items',
      'doc_counters',
      'payment_voucher_batches','payment_voucher_batch_lines'
    )
    or table_name like 'sales_plan%'
  )
order by table_name, ordinal_position;
