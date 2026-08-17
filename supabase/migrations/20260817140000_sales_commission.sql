-- Sales Commission + Corporate Gamification.
--
-- Design notes (deviations from a naive reading, decided from tracing the
-- actual invoice/POS save code in app/index.html):
--
-- 1) invoices.update() on every edit DELETEs and re-INSERTs invoice_items
--    (see _invSave) — item ids are NOT stable across edits of the same
--    invoice. A per-item unique index on source_item_id alone cannot fully
--    prevent double-counting when a paid invoice is later re-saved (the
--    old items, and their commission rows, would become orphaned while a
--    fresh set gets inserted). The app-side capture function therefore
--    soft-deletes existing sales_commissions for (source_type='invoice',
--    source_id) before recomputing on every capture call for an invoice —
--    a "clear then reinsert" pattern already used elsewhere in this file
--    for the exact same class of problem (_invClearPaymentJournals,
--    _invClearPayments). The per-item unique index below is kept anyway as
--    a defensive second layer within a single capture call.
-- 2) pos_transaction_items are only ever inserted once (POS sales are not
--    editable after checkout — only refundable via a separate transaction),
--    so item ids ARE stable there and the unique index alone is sufficient
--    for that source_type.

-- ---------- 1) invoices / pos_transactions: sales person + channel ----------
alter table invoices add column if not exists sales_person_id uuid null references employees(id);
alter table invoices add column if not exists channel text null default 'retail' check (channel in ('retail','event','platform'));

alter table pos_transactions add column if not exists sales_person_id uuid null references employees(id);
alter table pos_transactions add column if not exists channel text null default 'retail' check (channel in ('retail','event','platform'));

-- ---------- 2) payroll_records: snapshotted commission ----------
alter table payroll_records add column if not exists commission numeric(14,2) not null default 0;

-- ---------- 3) sales_commission_rules ----------
create table if not exists sales_commission_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  sales_person_id uuid null references employees(id),
  channel text not null check (channel in ('retail','event','platform')),
  product_id uuid null references products(id),
  rate_percent numeric(5,2) not null check (rate_percent >= 0 and rate_percent <= 100),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz null
);

create unique index if not exists sales_commission_rules_scope_uidx
  on sales_commission_rules (
    tenant_id,
    coalesce(sales_person_id, '00000000-0000-0000-0000-000000000000'),
    channel,
    coalesce(product_id, '00000000-0000-0000-0000-000000000000')
  )
  where deleted_at is null;

create index if not exists sales_commission_rules_lookup_idx
  on sales_commission_rules (tenant_id, channel, product_id)
  where deleted_at is null;

alter table sales_commission_rules enable row level security;
drop policy if exists sales_commission_rules_tenant on sales_commission_rules;
create policy sales_commission_rules_tenant on sales_commission_rules
  for all using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()))
  with check (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));

-- ---------- 4) sales_commissions (ledger) ----------
create table if not exists sales_commissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  sales_person_id uuid not null references employees(id),
  source_type text not null check (source_type in ('invoice','pos')),
  source_id uuid not null,
  source_item_id uuid not null,
  product_id uuid null references products(id),
  channel text not null check (channel in ('retail','event','platform')),
  sale_amount numeric(14,2) not null,
  rate_applied numeric(5,2) not null,
  commission_amount numeric(14,2) not null,
  earned_month int not null,
  earned_year int not null,
  payout_month int not null,
  payout_year int not null,
  status text not null default 'confirmed',
  created_at timestamptz default now(),
  deleted_at timestamptz null
);

create unique index if not exists sales_commissions_source_item_uidx
  on sales_commissions (tenant_id, source_type, source_item_id)
  where deleted_at is null;

create index if not exists sales_commissions_payout_idx
  on sales_commissions (tenant_id, sales_person_id, payout_month, payout_year)
  where deleted_at is null;

alter table sales_commissions enable row level security;
drop policy if exists sales_commissions_tenant on sales_commissions;
create policy sales_commissions_tenant on sales_commissions
  for all using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()))
  with check (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));

-- ---------- 5) sales_achievements ----------
create table if not exists sales_achievements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  sales_person_id uuid not null references employees(id),
  badge_key text not null,
  period_month int not null,
  period_year int not null,
  unlocked_at timestamptz default now(),
  deleted_at timestamptz null
);

create unique index if not exists sales_achievements_badge_uidx
  on sales_achievements (tenant_id, sales_person_id, badge_key, period_month, period_year)
  where deleted_at is null;

alter table sales_achievements enable row level security;
drop policy if exists sales_achievements_tenant on sales_achievements;
create policy sales_achievements_tenant on sales_achievements
  for all using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()))
  with check (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));
