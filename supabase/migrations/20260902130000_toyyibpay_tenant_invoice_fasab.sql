-- ============================================================================
-- Migration: ToyyibPay Fasa B — tenant invoice online payment (BYO gateway)
-- NOTE: Supabase Edge Functions/migrations do NOT auto-deploy from GitHub —
-- run this manually in Supabase Dashboard -> SQL Editor. Safe to re-run.
-- ============================================================================

-- ---------- 1) payment_transactions.invoice_id ----------
-- purpose='invoice' rows (this migration's feature) carry invoice_id;
-- purpose='subscription' rows (Fasa A) leave it null. plan_id/period_months
-- already nullable from the Fasa A migration, so this table now serves
-- both purposes without a purpose-specific table split.
alter table public.payment_transactions add column if not exists invoice_id uuid references public.invoices(id);
create index if not exists payment_transactions_invoice_idx on public.payment_transactions(invoice_id);

-- ---------- 2) tenant_payment_config ----------
-- Already exists live per Mike (empty) — CREATE TABLE IF NOT EXISTS below
-- is a no-op documentation stub, not a live change. The ADD COLUMN IF NOT
-- EXISTS lines are a defensive safety net in case the live table is
-- missing any of these columns; they never touch a column that already
-- exists. Schema INFERRED by symmetry with platform_payment_config (same
-- shape + tenant_id) since this session has no way to inspect the live
-- table directly — Mike should confirm actual column names match before
-- relying on this if anything below errors.
create table if not exists public.tenant_payment_config (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  provider text not null default 'toyyibpay',
  secret_key text not null,
  category_code text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.tenant_payment_config add column if not exists tenant_id uuid references public.tenants(id);
alter table public.tenant_payment_config add column if not exists provider text not null default 'toyyibpay';
alter table public.tenant_payment_config add column if not exists secret_key text;
alter table public.tenant_payment_config add column if not exists category_code text;
alter table public.tenant_payment_config add column if not exists is_active boolean not null default true;

create unique index if not exists tenant_payment_config_tenant_provider_uidx on public.tenant_payment_config(tenant_id, provider);

alter table public.tenant_payment_config enable row level security;
revoke all on table public.tenant_payment_config from public;
revoke all on table public.tenant_payment_config from anon;
revoke all on table public.tenant_payment_config from authenticated;
grant all on table public.tenant_payment_config to service_role;
-- No RLS policies on purpose: secret_key must never be readable by anon/
-- authenticated, same as platform_payment_config. Only the
-- toyyibpay-tenant-invoice-create-bill / toyyibpay-tenant-invoice-webhook
-- edge functions (service role) ever read this table. Tenants configure
-- their own credentials the same way Mike set up platform_payment_config
-- — directly in Supabase, not through an app UI (no such UI exists yet).

-- ---------- 3) has_active_toyyibpay_config_for_invoice ----------
-- Lets the PUBLIC invoice page (anon, no login — same context as
-- get_public_invoice below) decide whether to show "Bayar Online" WITHOUT
-- ever exposing secret_key/category_code, or even the invoice's raw
-- tenant_id, to the client. Mirrors get_public_invoice's own token
-- validation exactly (20260804120000_phase2_pin_public_inv.sql) — never
-- raises for a bad/missing token, just returns false, so a bad token
-- silently hides the button instead of breaking the invoice page.
create or replace function public.has_active_toyyibpay_config_for_invoice(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
begin
  if p_token is null or length(trim(p_token)) < 8 then
    return false;
  end if;
  select tenant_id into v_tenant_id from public.invoices where public_token = trim(p_token) and deleted_at is null limit 1;
  if v_tenant_id is null then
    return false;
  end if;
  return exists (
    select 1 from public.tenant_payment_config
    where tenant_id = v_tenant_id and provider = 'toyyibpay' and is_active = true
  );
end;
$$;

grant execute on function public.has_active_toyyibpay_config_for_invoice(text) to anon, authenticated;
