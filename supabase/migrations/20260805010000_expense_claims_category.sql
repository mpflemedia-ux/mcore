-- Adds a category to expense_claims, referencing an account_type='expense'
-- row in chart_of_accounts directly (not free-text) so expense claim
-- auto-posting can route straight to the correct GL account instead of
-- always falling back to one "General Expense" bucket.
--
-- Named generically (category_id, not e.g. posting_account_id) since this
-- field is planned for reuse by the upcoming Cash Advance/Panjar tracking
-- feature (linking expense_claims.category_id to an advance record, filtered
-- by expense-type accounts) — not auto-posting specific.
--
-- Nullable: old claims saved before this column existed have no category,
-- and the form does not require one. Auto-posting code must fall back to
-- the tenant's "general_expense" default_account_mappings entry when this
-- is null, never throw for its absence.

alter table expense_claims
  add column if not exists category_id uuid references chart_of_accounts(id);

create index if not exists expense_claims_category_idx on expense_claims(category_id);
