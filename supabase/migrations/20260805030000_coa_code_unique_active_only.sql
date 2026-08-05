-- Bug: chart_of_accounts had a plain UNIQUE(tenant_id, code) constraint that
-- did not exclude soft-deleted rows (deleted_at is not null). Since this app
-- always soft-deletes (never hard-deletes, per project convention), a code
-- that was created and later deleted still occupies its slot in that
-- constraint forever — so re-adding the same code fails with "duplicate key
-- value violates unique constraint chart_of_accounts_tenant_id_code_key"
-- even though the Chart of Accounts list (which filters deleted_at is null)
-- shows no such account.
--
-- Fix: replace the plain constraint with a partial unique index scoped to
-- deleted_at is null, so a code becomes reusable again once its previous
-- row is soft-deleted — while still preventing two ACTIVE accounts in the
-- same tenant from sharing a code.

alter table chart_of_accounts drop constraint if exists chart_of_accounts_tenant_id_code_key;

create unique index if not exists chart_of_accounts_tenant_code_active_idx
  on chart_of_accounts(tenant_id, code) where deleted_at is null;
