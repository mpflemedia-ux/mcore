-- ============================================================================
-- Migration: Purchasing (Suppliers, Purchase Orders, GRN, Supplier Bills)
-- NOTE: Supabase Edge Functions/migrations do NOT auto-deploy from GitHub —
-- run this manually in Supabase Dashboard -> SQL Editor.
--
-- Scope note: supplier_bills/supplier_payments are pure tracking — this
-- migration does NOT touch Chart of Accounts / journal_entries.
-- ============================================================================

-- ---------- suppliers ----------
create table suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  name text not null,
  phone text, email text, address text,
  created_at timestamptz default now(), deleted_at timestamptz
);

alter table suppliers enable row level security;

create policy "suppliers_select_own_tenant" on suppliers
  for select using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));
create policy "suppliers_insert_own_tenant" on suppliers
  for insert with check (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));
create policy "suppliers_update_own_tenant" on suppliers
  for update using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()))
  with check (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));
create policy "suppliers_delete_own_tenant" on suppliers
  for delete using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));

-- ---------- purchase_orders ----------
create table purchase_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  po_no text not null,
  supplier_id uuid not null references suppliers(id),
  order_date date not null default current_date,
  expected_date date,
  status text not null default 'draft' check (status in ('draft','sent','partial','received','cancelled')),
  notes text, total numeric not null default 0,
  created_at timestamptz default now(), deleted_at timestamptz
);

alter table purchase_orders enable row level security;

create policy "purchase_orders_select_own_tenant" on purchase_orders
  for select using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));
create policy "purchase_orders_insert_own_tenant" on purchase_orders
  for insert with check (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));
create policy "purchase_orders_update_own_tenant" on purchase_orders
  for update using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()))
  with check (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));
create policy "purchase_orders_delete_own_tenant" on purchase_orders
  for delete using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));

-- ---------- purchase_order_items ----------
-- (no tenant_id column per spec — isolation enforced via the parent PO's
-- tenant_id through the po_id foreign key)
create table purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references purchase_orders(id),
  product_id uuid references products(id),
  description text, qty numeric not null, unit_cost numeric not null,
  line_total numeric not null, qty_received numeric not null default 0
);

alter table purchase_order_items enable row level security;

create policy "purchase_order_items_select_own_tenant" on purchase_order_items
  for select using (po_id in (select id from purchase_orders where tenant_id = (select tenant_id from user_profiles where id = auth.uid())));
create policy "purchase_order_items_insert_own_tenant" on purchase_order_items
  for insert with check (po_id in (select id from purchase_orders where tenant_id = (select tenant_id from user_profiles where id = auth.uid())));
create policy "purchase_order_items_update_own_tenant" on purchase_order_items
  for update using (po_id in (select id from purchase_orders where tenant_id = (select tenant_id from user_profiles where id = auth.uid())))
  with check (po_id in (select id from purchase_orders where tenant_id = (select tenant_id from user_profiles where id = auth.uid())));
create policy "purchase_order_items_delete_own_tenant" on purchase_order_items
  for delete using (po_id in (select id from purchase_orders where tenant_id = (select tenant_id from user_profiles where id = auth.uid())));

-- ---------- goods_received_notes ----------
create table goods_received_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  grn_no text not null,
  po_id uuid not null references purchase_orders(id),
  supplier_id uuid not null references suppliers(id),
  received_date date not null default current_date,
  notes text,
  created_at timestamptz default now(), deleted_at timestamptz
);

alter table goods_received_notes enable row level security;

create policy "goods_received_notes_select_own_tenant" on goods_received_notes
  for select using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));
create policy "goods_received_notes_insert_own_tenant" on goods_received_notes
  for insert with check (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));
create policy "goods_received_notes_update_own_tenant" on goods_received_notes
  for update using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()))
  with check (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));
create policy "goods_received_notes_delete_own_tenant" on goods_received_notes
  for delete using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));

-- ---------- goods_received_items ----------
-- (no tenant_id column per spec — isolation enforced via the parent GRN's
-- tenant_id through the grn_id foreign key)
create table goods_received_items (
  id uuid primary key default gen_random_uuid(),
  grn_id uuid not null references goods_received_notes(id),
  po_item_id uuid not null references purchase_order_items(id),
  product_id uuid references products(id),
  qty_received numeric not null, unit_cost numeric not null
);

alter table goods_received_items enable row level security;

create policy "goods_received_items_select_own_tenant" on goods_received_items
  for select using (grn_id in (select id from goods_received_notes where tenant_id = (select tenant_id from user_profiles where id = auth.uid())));
create policy "goods_received_items_insert_own_tenant" on goods_received_items
  for insert with check (grn_id in (select id from goods_received_notes where tenant_id = (select tenant_id from user_profiles where id = auth.uid())));
create policy "goods_received_items_update_own_tenant" on goods_received_items
  for update using (grn_id in (select id from goods_received_notes where tenant_id = (select tenant_id from user_profiles where id = auth.uid())))
  with check (grn_id in (select id from goods_received_notes where tenant_id = (select tenant_id from user_profiles where id = auth.uid())));
create policy "goods_received_items_delete_own_tenant" on goods_received_items
  for delete using (grn_id in (select id from goods_received_notes where tenant_id = (select tenant_id from user_profiles where id = auth.uid())));

-- ---------- supplier_bills ----------
create table supplier_bills (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  bill_no text not null,
  supplier_id uuid not null references suppliers(id),
  po_id uuid references purchase_orders(id),
  grn_id uuid references goods_received_notes(id),
  bill_date date not null default current_date,
  due_date date,
  total numeric not null default 0,
  paid_amt numeric not null default 0,
  status text not null default 'unpaid' check (status in ('unpaid','partial','paid')),
  created_at timestamptz default now(), deleted_at timestamptz
);

alter table supplier_bills enable row level security;

create policy "supplier_bills_select_own_tenant" on supplier_bills
  for select using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));
create policy "supplier_bills_insert_own_tenant" on supplier_bills
  for insert with check (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));
create policy "supplier_bills_update_own_tenant" on supplier_bills
  for update using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()))
  with check (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));
create policy "supplier_bills_delete_own_tenant" on supplier_bills
  for delete using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));

-- ---------- supplier_payments ----------
create table supplier_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  bill_id uuid not null references supplier_bills(id),
  payment_date date not null default current_date,
  amount numeric not null, method text,
  created_at timestamptz default now()
);

alter table supplier_payments enable row level security;

create policy "supplier_payments_select_own_tenant" on supplier_payments
  for select using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));
create policy "supplier_payments_insert_own_tenant" on supplier_payments
  for insert with check (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));
create policy "supplier_payments_update_own_tenant" on supplier_payments
  for update using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()))
  with check (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));
create policy "supplier_payments_delete_own_tenant" on supplier_payments
  for delete using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));
