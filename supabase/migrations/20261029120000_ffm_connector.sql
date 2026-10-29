-- Flash Fulfillment (FFM) Malaysia connector — tables + RLS.
-- WRITE-ONLY: run in Supabase SQL Editor. Idempotent / rerun-safe.
-- Run order: 1) this file  2) 20261029120100_ffm_cron.sql  3) 20261029120200_devroadmap_ffm_connector_completed.sql
-- Keys: ffm_account_secrets is service_role ONLY (tenant_payment_config pattern). Clients never SELECT secrets.
-- Clients only READ the ffm_* tables below; every write goes through edge functions ffm-api / ffm-webhook / ffm-cron (service role).
-- FFM stock lives in ffm_stock and NEVER touches products.stock_qty.

-- ---------- 1) accounts (safe columns only; one tenant can have many, e.g. Brzky + Funded) ----------
create table if not exists public.ffm_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  label text not null,
  base_url text not null default 'https://open.flashfulfillment.my',
  api_prefix text not null default '',
  sign_mode text not null default 'json',
  mch_id_masked text,
  has_api_key boolean not null default false,
  has_webhook_secret boolean not null default false,
  warehouse_id text,
  store_code text,
  order_source_platform text not null default 'Line',
  amount_multiplier integer not null default 100,
  pay_mode text not null default '2',
  accept_language text not null default 'en',
  source_from text,
  auto_approve boolean not null default false,
  low_stock_enabled boolean not null default true,
  is_funded boolean not null default false,
  sales_plan_id uuid,
  fee_source text not null default 'shipping',
  tracking_url_template text,
  is_active boolean not null default true,
  last_sync_at timestamptz,
  last_error text,
  last_error_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.ffm_accounts add column if not exists api_prefix text not null default '';
alter table public.ffm_accounts add column if not exists sign_mode text not null default 'json';
alter table public.ffm_accounts add column if not exists fee_source text not null default 'shipping';
alter table public.ffm_accounts add column if not exists source_from text;
alter table public.ffm_accounts add column if not exists tracking_url_template text;
create unique index if not exists ffm_accounts_label_uidx on public.ffm_accounts (tenant_id, lower(label)) where deleted_at is null;
create index if not exists ffm_accounts_tenant_idx on public.ffm_accounts (tenant_id) where deleted_at is null;

-- ---------- 2) secrets (service_role only — tenant_payment_config pattern) ----------
create table if not exists public.ffm_account_secrets (
  account_id uuid primary key references public.ffm_accounts(id),
  tenant_id uuid not null references public.tenants(id),
  mch_id text,
  api_key text,
  webhook_app_key text,
  webhook_app_secret text,
  webhook_app_code text,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
create index if not exists ffm_account_secrets_mch_idx on public.ffm_account_secrets (mch_id);
alter table public.ffm_account_secrets enable row level security;
revoke all on table public.ffm_account_secrets from public;
revoke all on table public.ffm_account_secrets from anon;
revoke all on table public.ffm_account_secrets from authenticated;
grant all on table public.ffm_account_secrets to service_role;

-- ---------- 3) product links (barcode sync per account) ----------
create table if not exists public.ffm_product_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  account_id uuid not null references public.ffm_accounts(id),
  product_id uuid not null,
  barcode text not null,
  synced_ok boolean not null default false,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists ffm_product_links_uidx on public.ffm_product_links (account_id, product_id);
create index if not exists ffm_product_links_tenant_idx on public.ffm_product_links (tenant_id, account_id);

-- ---------- 4) FFM stock (SEPARATE from products.stock_qty) ----------
create table if not exists public.ffm_stock (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  account_id uuid not null references public.ffm_accounts(id),
  product_id uuid,
  barcode text not null,
  available_qty numeric not null default 0,
  inventory_qty numeric not null default 0,
  total_qty numeric not null default 0,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists ffm_stock_uidx on public.ffm_stock (account_id, barcode);
create index if not exists ffm_stock_tenant_idx on public.ffm_stock (tenant_id, product_id);

-- ---------- 5) shipments (DO -> FFM delivery bill) ----------
create table if not exists public.ffm_shipments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  account_id uuid not null references public.ffm_accounts(id),
  delivery_order_id uuid not null,
  invoice_id uuid,
  order_sn text not null,
  ffm_order_id text,
  pno text,
  recent_pno text,
  state integer,
  state_text text,
  status text not null default 'sending',
  consignee jsonb,
  goods jsonb,
  total_amount numeric not null default 0,
  fee_amount numeric,
  fee_raw jsonb,
  last_error text,
  last_polled_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  returned_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists ffm_shipments_ordersn_uidx on public.ffm_shipments (account_id, order_sn);
-- one live FFM shipment per DO (failed / cancelled can be re-sent)
create unique index if not exists ffm_shipments_do_live_uidx on public.ffm_shipments (delivery_order_id)
  where deleted_at is null and status not in ('failed', 'cancelled');
create index if not exists ffm_shipments_tenant_idx on public.ffm_shipments (tenant_id, status) where deleted_at is null;
create index if not exists ffm_shipments_ffm_idx on public.ffm_shipments (ffm_order_id);

-- ---------- 6) ASN (PO -> FFM arrival notice) ----------
create table if not exists public.ffm_asn (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  account_id uuid not null references public.ffm_accounts(id),
  purchase_order_id uuid not null,
  order_sn text not null,
  ffm_order_id text,
  status integer,
  status_text text,
  goods jsonb,
  received_goods jsonb,
  last_error text,
  received_at timestamptz,
  last_polled_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists ffm_asn_ordersn_uidx on public.ffm_asn (account_id, order_sn);
create index if not exists ffm_asn_po_idx on public.ffm_asn (tenant_id, purchase_order_id) where deleted_at is null;

-- ---------- 7) returns (deliveryRollbackOrder webhook) ----------
create table if not exists public.ffm_returns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  account_id uuid not null references public.ffm_accounts(id),
  shipment_id uuid,
  ffm_return_id text not null,
  order_sn text,
  state integer,
  state_text text,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists ffm_returns_uidx on public.ffm_returns (account_id, ffm_return_id);

-- ---------- 8) event log + idempotency (webhook dedupe, alert dedupe) ----------
create table if not exists public.ffm_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  account_id uuid,
  source text not null default 'webhook',
  method text,
  dedupe_key text not null,
  verified boolean,
  payload jsonb,
  error text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists ffm_events_dedupe_uidx on public.ffm_events (dedupe_key);
create index if not exists ffm_events_tenant_idx on public.ffm_events (tenant_id, created_at desc);

-- ---------- 9) daily reconciliation (M-Core stock_qty vs FFM) ----------
create table if not exists public.ffm_recon_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  run_date date not null,
  product_count integer not null default 0,
  diff_count integer not null default 0,
  rows jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists ffm_recon_runs_uidx on public.ffm_recon_runs (tenant_id, run_date);

-- ---------- 10) RLS: tenant members READ; no client writes (edge functions use service role) ----------
do $$
declare t text;
begin
  foreach t in array array['ffm_accounts','ffm_product_links','ffm_stock','ffm_shipments','ffm_asn','ffm_returns','ffm_events','ffm_recon_runs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate on table public.%I from authenticated', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
    execute format('drop policy if exists %I on public.%I', t || '_tenant_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (tenant_id = public.get_my_tenant_id() or public.is_platform_admin())', t || '_tenant_read', t);
  end loop;
end $$;
