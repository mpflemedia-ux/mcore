-- ============================================================================
-- Migration: Bill of Materials (BOM) + Work Order bom_snapshot
-- NOTE: Supabase Edge Functions/migrations do NOT auto-deploy from GitHub —
-- run this manually in Supabase Dashboard -> SQL Editor.
-- ============================================================================

-- ---------- bom_items ----------
create table bom_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  product_id uuid not null references products(id),
  component_id uuid not null references products(id),
  qty_per_unit numeric not null check (qty_per_unit > 0),
  created_at timestamptz default now(),
  deleted_at timestamptz
);

create index on bom_items(tenant_id, product_id) where deleted_at is null;

alter table bom_items enable row level security;

create policy "bom_items_select_own_tenant" on bom_items
  for select using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));
create policy "bom_items_insert_own_tenant" on bom_items
  for insert with check (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));
create policy "bom_items_update_own_tenant" on bom_items
  for update using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()))
  with check (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));
create policy "bom_items_delete_own_tenant" on bom_items
  for delete using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));

-- ---------- work_orders.bom_snapshot ----------
-- Snapshot of BOM (component_id + qty_needed) taken at WO creation time, so
-- that completing the WO later consumes the snapshot instead of re-querying
-- the (possibly since-changed) live BOM.
alter table work_orders add column bom_snapshot jsonb;

-- ---------- work_orders.stock_applied ----------
-- "Once ever" guard: whether stock has already been deducted/incremented for
-- this WO's completion. Prevents double-deduction if a user toggles status
-- completed -> pending -> completed repeatedly (checking only the immediate
-- previous status is not enough, since a genuine pending->completed
-- transition would otherwise re-run the stock movement every time).
alter table work_orders add column stock_applied boolean not null default false;
