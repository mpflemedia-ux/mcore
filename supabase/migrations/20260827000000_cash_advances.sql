-- ============================================================================
-- Migration: Cash Advance / Panjar
-- NOTE: Supabase Edge Functions/migrations do NOT auto-deploy from GitHub —
-- run this manually in Supabase Dashboard -> SQL Editor.
-- ============================================================================

create table cash_advances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  employee_id uuid not null references employees(id),
  amount numeric not null check (amount > 0),
  reason text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_by uuid references user_profiles(id),
  approved_by uuid references user_profiles(id),
  request_date date not null default current_date,
  disbursed_at timestamptz,
  outstanding_amount numeric not null default 0,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index on cash_advances(tenant_id, employee_id, status);

alter table cash_advances enable row level security;

create policy "cash_advances_select_own_tenant" on cash_advances
  for select using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));

create policy "cash_advances_insert_own_tenant" on cash_advances
  for insert with check (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));

create policy "cash_advances_update_own_tenant" on cash_advances
  for update using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()))
  with check (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));

create policy "cash_advances_delete_own_tenant" on cash_advances
  for delete using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));
