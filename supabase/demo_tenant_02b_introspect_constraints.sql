-- ============================================================================
-- DEMO TENANT — PART 2b: INTROSPECTION (read-only, does not change anything)
-- Run in Supabase SQL Editor, then use the result pane's "Download CSV"
-- button and send that file back.
-- ============================================================================
select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where contype = 'c'
  and connamespace = 'public'::regnamespace
  and conrelid::regclass::text in (
    'tenants','customers','quotations','invoices','payments',
    'pos_sessions','pos_transactions','products','stock_movements',
    'delivery_orders','work_orders','employees','payroll_records',
    'fiscal_years','chart_of_accounts','journal_entries',
    'expense_claims','doc_counters'
  )
order by table_name;
