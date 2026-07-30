-- ============================================================================
-- Migration: Depreciation Run Log (Fixed Assets Register already exists)
-- NOTE: Supabase Edge Functions/migrations do NOT auto-deploy from GitHub —
-- run this manually in Supabase Dashboard -> SQL Editor.
--
-- fixed_assets: NOT created here. The table already exists in production
-- from the original project schema, with different column names than first
-- assumed (purchase_price instead of cost, accumulated_dep instead of
-- accumulated_depreciation, disposal_value instead of disposal_proceeds,
-- plus coa_id/depreciation_method/depreciation_rate/nbv/disposal_gain_loss/
-- location/serial_no/notes that this app phase does not populate). The app
-- code has been updated to read/write the real column names and leaves the
-- extra columns untouched (null/default) rather than risk altering a
-- production table's structure.
--
-- next_ref_no('FA'): NOT added here either. The app already falls back to a
-- tenant-scoped sequential generator (_genFallbackRefNo) whenever next_ref_no()
-- returns null for a doc_type it doesn't recognize (same pattern already used
-- for CUST/DO/GRN/BILL), so no RPC change is required for the 'FA' doc_type.
-- ============================================================================

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
