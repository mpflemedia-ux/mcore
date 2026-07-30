-- ============================================================================
-- Migration: Fixed Assets Register + Depreciation Schedule
-- NOTE: Supabase Edge Functions/migrations do NOT auto-deploy from GitHub —
-- run this manually in Supabase Dashboard -> SQL Editor.
--
-- next_ref_no('FA'): NOT added here. The app already falls back to a
-- tenant-scoped sequential generator (_genFallbackRefNo) whenever next_ref_no()
-- returns null for a doc_type it doesn't recognize (same pattern already used
-- for CUST/DO/GRN/BILL), so no RPC change is required for the 'FA' doc_type.
-- ============================================================================

-- ---------- fixed_assets ----------
create table fixed_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  asset_no text not null,
  name text not null,
  category text,
  purchase_date date not null,
  cost numeric not null check (cost > 0),
  residual_value numeric not null default 0,
  useful_life_years numeric not null check (useful_life_years > 0),
  accumulated_depreciation numeric not null default 0,
  status text not null default 'active' check (status in ('active','disposed')),
  disposal_date date,
  disposal_proceeds numeric,
  created_at timestamptz default now(),
  deleted_at timestamptz
);

alter table fixed_assets enable row level security;

create policy "fixed_assets_select_own_tenant" on fixed_assets
  for select using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));
create policy "fixed_assets_insert_own_tenant" on fixed_assets
  for insert with check (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));
create policy "fixed_assets_update_own_tenant" on fixed_assets
  for update using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()))
  with check (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));
create policy "fixed_assets_delete_own_tenant" on fixed_assets
  for delete using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));

-- ---------- depreciation_runs ----------
-- Append-only log of each posted monthly depreciation run per asset. The
-- unique(tenant_id, asset_id, period) constraint is the hard backstop against
-- double-posting; the app also checks existing rows before running so it
-- skips already-processed assets instead of hitting the constraint.
create table depreciation_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  asset_id uuid not null references fixed_assets(id),
  period date not null,
  amount numeric not null,
  journal_entry_id uuid references journal_entries(id),
  created_at timestamptz default now(),
  unique(tenant_id, asset_id, period)
);

alter table depreciation_runs enable row level security;

create policy "depreciation_runs_select_own_tenant" on depreciation_runs
  for select using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));
create policy "depreciation_runs_insert_own_tenant" on depreciation_runs
  for insert with check (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));
create policy "depreciation_runs_update_own_tenant" on depreciation_runs
  for update using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()))
  with check (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));
create policy "depreciation_runs_delete_own_tenant" on depreciation_runs
  for delete using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));
