-- ============================================================================
-- Migration: allow record_tenant_payment() to be called by the
-- toyyibpay-webhook edge function (service role), not just an
-- authenticated platform_admin from the Admin UI.
--
-- WHY: record_tenant_payment() (from 20260819010000_record_payment_clears_
-- trial.sql, reproduced here verbatim except for the one check below) only
-- checked `caller_role = 'platform_admin'` via auth.uid() — that's read
-- from the caller's JWT 'sub' claim. The toyyibpay-webhook function is an
-- unauthenticated ToyyibPay callback with NO Supabase user JWT; it can only
-- call this RPC using the service_role key, whose JWT carries no 'sub', so
-- auth.uid() is NULL and the old check always raised "Only platform_admin
-- can record a tenant payment" — silently breaking every online payment.
-- Fix: also allow the call when auth.role() = 'service_role' (Supabase's
-- own convention for "this request used the service_role key", read from
-- the JWT's 'role' claim, not the Postgres session role). The existing
-- platform_admin path (Admin UI recording a manual bank-transfer payment)
-- is untouched — same check, just OR'd with the service-role case.
--
-- SECOND blocker found reading the function body: it also inserts into
-- platform_admin_audit(actor_user_id ...), and that column is `not null`
-- (20260817220000_platform_admin_tenant_status.sql). A service-role call
-- has auth.uid() = NULL, so that insert would violate the NOT NULL
-- constraint and roll back the whole function — including the tenant
-- plan/expiry update — even after the role-check fix above. Made nullable
-- below; the Admin Audit Log UI already reads actor_email (not
-- actor_user_id) so this doesn't affect that screen. caller_email falls
-- back to a readable system label when there's no auth.uid() to look up.
--
-- NOTE: Supabase Edge Functions/migrations do NOT auto-deploy from GitHub —
-- run this manually in Supabase Dashboard -> SQL Editor.
-- ============================================================================

alter table public.platform_admin_audit alter column actor_user_id drop not null;

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
  if coalesce(lower(caller_role), '') <> 'platform_admin' and auth.role() <> 'service_role' then
    raise exception 'Only platform_admin can record a tenant payment' using errcode = '42501';
  end if;

  select email into caller_email from auth.users where id = auth.uid();
  if caller_email is null and auth.role() = 'service_role' then
    caller_email := 'system (service_role — automated payment webhook)';
  end if;
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
  -- is_trial IS touched: a tenant who has just had a real payment recorded
  -- is, by definition, no longer on trial.
  update public.tenants set plan_id = p_plan_id, plan_expires_at = new_expiry, is_trial = false where id = p_tenant_id;

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
grant execute on function public.record_tenant_payment(uuid, uuid, numeric, date, text, int, date) to service_role;
