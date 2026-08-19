-- Registration -> Onboarding -> Payment -> Expiry: bidirectional tenant/admin
-- reflection. Wires up tenants.is_trial/trial_ends_at/plan_expires_at
-- (already live, zero code references before this migration), adds
-- incremental onboarding-step tracking, and a manual payment-recording
-- flow (no payment gateway — bank transfer + admin confirms, same
-- relationship-driven model invoice payments already use).
--
-- Soft-warning-only, same as the rest of the Plan module: this migration
-- adds visibility and manual record-keeping only, never blocking logic.

-- ---------- CORRECTION vs. the task brief given for this migration ----------
-- The brief for this task stated platform_admin_audit.details is jsonb and
-- that a text/jsonb type-mismatch bug in it "already broke set_tenant_plan
-- and create_announcement earlier today, both now fixed" — checked against
-- origin/main before writing anything here (per the brief's own "fetch the
-- current migrations, don't assume" instruction) and that's not what's
-- there: 20260818000000_plan_billing_module.sql defines `details text`,
-- and both functions insert plain strings into it — no bug, nothing was
-- "already fixed" today. What follows is a genuine, deliberate change:
-- converting `details` from text to jsonb NOW, wrapping its two existing
-- writers in to_jsonb() for consistency, so the richer structured payload
-- record_tenant_payment needs below (amount/period/old_expiry/new_expiry)
-- has a properly-typed column to land in.

alter table public.platform_admin_audit
  alter column details type jsonb using (case when details is null then null else to_jsonb(details) end);

create or replace function public.set_tenant_plan(p_tenant_id uuid, p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  caller_role text;
  caller_email text;
  tenant_name text;
  old_plan_code text;
  new_plan_code text;
begin
  select role into caller_role from public.user_profiles where id = auth.uid();
  if coalesce(lower(caller_role), '') <> 'platform_admin' then
    raise exception 'Only platform_admin can change a tenant plan' using errcode = '42501';
  end if;

  select email into caller_email from auth.users where id = auth.uid();
  select name into tenant_name from public.tenants where id = p_tenant_id;
  if tenant_name is null then
    raise exception 'Tenant not found' using errcode = 'P0002';
  end if;

  select p.code into new_plan_code from public.plans p where p.id = p_plan_id;
  if new_plan_code is null then
    raise exception 'Plan not found' using errcode = 'P0002';
  end if;

  select p.code into old_plan_code from public.tenants t join public.plans p on p.id = t.plan_id where t.id = p_tenant_id;

  update public.tenants set plan_id = p_plan_id where id = p_tenant_id;

  insert into public.platform_admin_audit (actor_user_id, actor_email, action, target_tenant_id, target_tenant_name, details)
  values (auth.uid(), caller_email, 'set_tenant_plan', p_tenant_id, tenant_name, to_jsonb(coalesce(old_plan_code, '(none)') || ' -> ' || new_plan_code));
end;
$$;

create or replace function public.create_announcement(p_message_en text, p_message_bm text, p_severity text default 'info')
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  caller_role text;
  caller_email text;
  new_id uuid;
begin
  select role into caller_role from public.user_profiles where id = auth.uid();
  if coalesce(lower(caller_role), '') <> 'platform_admin' then
    raise exception 'Only platform_admin can broadcast an announcement' using errcode = '42501';
  end if;
  if coalesce(trim(p_message_en), '') = '' or coalesce(trim(p_message_bm), '') = '' then
    raise exception 'Both message_en and message_bm are required' using errcode = '22023';
  end if;
  if p_severity not in ('info', 'warning') then
    raise exception 'severity must be info or warning' using errcode = '22023';
  end if;

  select email into caller_email from auth.users where id = auth.uid();

  insert into public.platform_announcements (message_en, message_bm, severity, created_by)
  values (p_message_en, p_message_bm, p_severity, auth.uid())
  returning id into new_id;

  insert into public.platform_admin_audit (actor_user_id, actor_email, action, target_tenant_id, target_tenant_name, details)
  values (auth.uid(), caller_email, 'create_announcement', null, null, to_jsonb(left(p_message_en, 200)));

  return new_id;
end;
$$;

alter table public.platform_admin_audit drop constraint if exists platform_admin_audit_action_check;
alter table public.platform_admin_audit add constraint platform_admin_audit_action_check
  check (action in ('suspend_tenant', 'reactivate_tenant', 'set_tenant_plan', 'create_announcement', 'record_tenant_payment'));

-- ---------- 1) tenants.onboarding_step ----------
-- Persisted incrementally through the wizard (0-5), not just the final
-- onboarding_completed boolean — lets All Clients show real progress
-- ("Step 3/5") instead of only Pending/Done.
alter table public.tenants add column if not exists onboarding_step int not null default 0;

-- ---------- 2) tenant_plan_payments ----------
-- Permanent payment history record — same role for plan payments that the
-- existing `payments` table already plays for invoice payments.
create table if not exists public.tenant_plan_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  amount numeric(10,2) not null,
  payment_date date not null,
  payment_method text not null,
  period_months int not null check (period_months > 0),
  period_start date not null,
  period_end date not null,
  recorded_by uuid null references auth.users(id),
  notes text null,
  created_at timestamptz not null default now()
);

create index if not exists tenant_plan_payments_tenant_idx on public.tenant_plan_payments (tenant_id, payment_date desc);

-- ---------- 3) RLS ----------
alter table public.tenant_plan_payments enable row level security;
drop policy if exists tenant_plan_payments_select on public.tenant_plan_payments;
create policy tenant_plan_payments_select on public.tenant_plan_payments for select to authenticated
  using (
    tenant_id = (select tenant_id from public.user_profiles where id = auth.uid())
    or exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'platform_admin')
  );
-- No INSERT/UPDATE/DELETE policy for the authenticated role — every write
-- happens exclusively through record_tenant_payment() below (SECURITY
-- DEFINER, role-checked), same append-only-via-RPC pattern as every other
-- write path this module has added.

-- ---------- 4) record_tenant_payment ----------
create or replace function public.record_tenant_payment(
  p_tenant_id uuid,
  p_plan_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_payment_method text,
  p_period_months int,
  p_period_end_override date default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  caller_role text;
  caller_email text;
  tenant_name text;
  old_expiry timestamptz;
  new_expiry timestamptz;
  period_base timestamptz;
begin
  select role into caller_role from public.user_profiles where id = auth.uid();
  if coalesce(lower(caller_role), '') <> 'platform_admin' then
    raise exception 'Only platform_admin can record a tenant payment' using errcode = '42501';
  end if;

  select email into caller_email from auth.users where id = auth.uid();
  select name, plan_expires_at into tenant_name, old_expiry from public.tenants where id = p_tenant_id;
  if tenant_name is null then
    raise exception 'Tenant not found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.plans where id = p_plan_id) then
    raise exception 'Plan not found' using errcode = 'P0002';
  end if;
  if p_period_months is null or p_period_months <= 0 then
    raise exception 'p_period_months must be a positive integer' using errcode = '22023';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'p_amount must be a non-negative number' using errcode = '22023';
  end if;

  -- Extends from whichever is later — current expiry or today — so a
  -- renewal recorded before the current period expires doesn't lose
  -- remaining paid time. Also used as this payment's period_start, so a
  -- tenant's tenant_plan_payments rows chain into contiguous coverage
  -- even when a payment is recorded a few days early or late.
  period_base := greatest(coalesce(old_expiry, now()), now());
  if p_period_end_override is not null then
    new_expiry := p_period_end_override::timestamptz;
  else
    new_expiry := period_base + (p_period_months::text || ' months')::interval;
  end if;

  insert into public.tenant_plan_payments
    (tenant_id, plan_id, amount, payment_date, payment_method, period_months, period_start, period_end, recorded_by)
  values
    (p_tenant_id, p_plan_id, p_amount, p_payment_date, p_payment_method, p_period_months, period_base::date, new_expiry::date, auth.uid());

  -- plan_id updated too — this payment may also be an upgrade. is_active is
  -- deliberately NOT touched: if the tenant was suspended, reactivation
  -- stays a separate, deliberate action (admin clicks Reactivate too if
  -- that's actually intended) rather than being silently coupled to payment.
  update public.tenants set plan_id = p_plan_id, plan_expires_at = new_expiry where id = p_tenant_id;

  insert into public.platform_admin_audit (actor_user_id, actor_email, action, target_tenant_id, target_tenant_name, details)
  values (
    auth.uid(), caller_email, 'record_tenant_payment', p_tenant_id, tenant_name,
    jsonb_build_object(
      'amount', p_amount,
      'period_months', p_period_months,
      'payment_method', p_payment_method,
      'old_expiry', old_expiry,
      'new_expiry', new_expiry
    )
  );
end;
$$;

grant execute on function public.record_tenant_payment(uuid, uuid, numeric, date, text, int, date) to authenticated;
