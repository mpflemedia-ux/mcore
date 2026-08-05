-- Default Account Mappings — foundation for auto-posting double-entry
-- journal entries from day-to-day transactions (invoice payment, POS
-- checkout, expense claims, supplier bill payment, payroll, payment
-- vouchers) without asking the user to pick a GL account on every single
-- transaction (that per-transaction picker pattern already exists for
-- Fixed Assets depreciation — fine for a rare monthly action, too much
-- friction for something that happens many times a day).
--
-- Each tenant configures this ONCE (Settings -> Accounting -> Default
-- Accounts), mapping a fixed set of mapping_key values to their own
-- chart_of_accounts rows. Auto-posting code looks up the account by
-- mapping_key at post time — if a mapping is missing, posting is skipped
-- with a clear message rather than guessing or posting to null.

create table if not exists default_account_mappings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  mapping_key text not null,
  account_id uuid not null references chart_of_accounts(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(tenant_id, mapping_key)
);

create index if not exists default_account_mappings_tenant_idx on default_account_mappings(tenant_id);

alter table default_account_mappings enable row level security;

-- Matches the tenant-isolation pattern already proven working elsewhere
-- (payment_vouchers, payment_voucher_batches) — direct subquery against
-- user_profiles, not a get_tenant_id() helper (confirmed not to exist
-- anywhere in this codebase).
drop policy if exists default_account_mappings_tenant on default_account_mappings;
create policy default_account_mappings_tenant on default_account_mappings
  for all using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()))
  with check (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));
