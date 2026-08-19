-- Fix: My Plan widget showed both "X days left in trial" AND "Renews on
-- [date]" at the same time after a real payment was recorded for a trial
-- tenant. record_tenant_payment() already updates plan_id and
-- plan_expires_at on payment, but never cleared is_trial — so a tenant who
-- has actually paid still read back as is_trial=true, and the widget (which
-- renders the trial line whenever is_trial=true, independently of whether
-- plan_expires_at is also set) showed both lines at once.
--
-- CREATE OR REPLACE is idempotent — safe to run even though this function
-- already exists from 20260819000000_tenant_lifecycle_reflection.sql; this
-- just redefines it. Reproduced here in full from that migration's current
-- state on origin/main (fetched and diffed before writing this, not
-- assumed) with exactly one change: the UPDATE now also sets is_trial =
-- false, since a tenant who has just paid is by definition no longer on
-- trial. Nothing else in the function body changed — same role-check, same
-- period_base/new_expiry calculation, same audit log insert.
--
-- Scope check: is_trial is set true only by register_tenant() (elsewhere,
-- untouched) and now set false only here, inside record_tenant_payment() —
-- no other code path touches it. A tenant who has never had a payment
-- recorded never runs this function, so is_trial=true is left exactly as
-- register_tenant() set it.

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
  -- is_trial IS touched now (the actual fix here): a tenant who has just
  -- had a real payment recorded is, by definition, no longer on trial —
  -- leaving it true made the My Plan widget show a trial countdown and a
  -- paid-plan expiry date at the same time.
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
