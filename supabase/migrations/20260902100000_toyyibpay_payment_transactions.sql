-- ============================================================================
-- Migration: ToyyibPay Fasa A — payment_transactions
-- NOTE: Supabase Edge Functions/migrations do NOT auto-deploy from GitHub —
-- run this manually in Supabase Dashboard -> SQL Editor.
--
-- platform_payment_config is NOT created here — it already exists live
-- (1 row: provider='toyyibpay', secret_key, category_code, is_active=true),
-- set up directly by Mike outside this repo's migration history. The
-- IF NOT EXISTS below is a documentation/new-environment safety net only —
-- it is a no-op against the already-live table.
-- ============================================================================

create table if not exists public.platform_payment_config (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique,
  secret_key text not null,
  category_code text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.platform_payment_config enable row level security;
revoke all on table public.platform_payment_config from public;
revoke all on table public.platform_payment_config from anon;
revoke all on table public.platform_payment_config from authenticated;
grant all on table public.platform_payment_config to service_role;
-- No RLS policies on purpose: secret_key must never be readable by anon/
-- authenticated. Only the toyyibpay-create-bill/toyyibpay-webhook edge
-- functions (service role) ever read this table.

-- ---------- payment_transactions ----------
-- One row per online payment attempt (ToyyibPay bill). tenant_id is the
-- PAYING tenant (Fasa A = tenant paying Phion for their own M-Core
-- subscription) — this IS real tenant data per CLAUDE.md's tenant_id/RLS
-- rule, unlike platform_integrations/platform_payment_config which hold
-- Phion's own platform-level marketing/payment-gateway credentials.
create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  purpose text not null default 'subscription',
  plan_id uuid references public.plans(id),
  period_months int,
  provider text not null default 'toyyibpay',
  external_reference_no text not null unique,
  bill_code text,
  amount numeric not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  paid_at timestamptz,
  raw_callback jsonb,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists payment_transactions_tenant_status_idx on public.payment_transactions(tenant_id, status);
create index if not exists payment_transactions_bill_code_idx on public.payment_transactions(bill_code);

alter table public.payment_transactions enable row level security;

-- Tenant can see their own payment history. All WRITES (insert on bill
-- creation, update on webhook confirmation) happen exclusively via the
-- toyyibpay-create-bill / toyyibpay-webhook edge functions using the
-- service role key, which bypasses RLS entirely — no insert/update/delete
-- policy is granted to authenticated/anon on purpose.
create policy "payment_transactions_select_own_tenant" on public.payment_transactions
  for select using (tenant_id = (select tenant_id from public.user_profiles where id = auth.uid()));
