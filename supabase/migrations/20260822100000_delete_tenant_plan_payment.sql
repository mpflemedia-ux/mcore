-- platform_admin can delete a SaaS plan payment row (test / mistake cleanup)
-- and recompute tenants.plan_expires_at from remaining coverage.

create or replace function public.delete_tenant_plan_payment(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  caller_role text;
  caller_email text;
  v_tenant_id uuid;
  v_amount numeric;
  v_name text;
  v_new_expiry date;
begin
  select role into caller_role from public.user_profiles where id = auth.uid();
  if coalesce(lower(caller_role), '') <> 'platform_admin' then
    raise exception 'Only platform_admin can delete a tenant plan payment' using errcode = '42501';
  end if;

  select tpp.tenant_id, tpp.amount, t.name
    into v_tenant_id, v_amount, v_name
  from public.tenant_plan_payments tpp
  left join public.tenants t on t.id = tpp.tenant_id
  where tpp.id = p_payment_id;

  if v_tenant_id is null then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;

  delete from public.tenant_plan_payments where id = p_payment_id;

  -- Recompute expiry from remaining payments (max period_end); null if none
  select max(period_end)::date into v_new_expiry
  from public.tenant_plan_payments
  where tenant_id = v_tenant_id;

  update public.tenants
  set plan_expires_at = case when v_new_expiry is null then null else v_new_expiry::timestamptz end,
      updated_at = now()
  where id = v_tenant_id;

  select email into caller_email from auth.users where id = auth.uid();
  insert into public.platform_admin_audit (actor_user_id, actor_email, action, target_tenant_id, target_tenant_name, details)
  values (
    auth.uid(), caller_email, 'delete_tenant_plan_payment', v_tenant_id, v_name,
    jsonb_build_object('payment_id', p_payment_id, 'amount', v_amount)
  );
exception
  when undefined_table then
    -- platform_admin_audit may miss action check constraint on older DBs
    null;
end;
$$;

grant execute on function public.delete_tenant_plan_payment(uuid) to authenticated;

-- Expand audit action check if present (best-effort)
do $$
begin
  alter table public.platform_admin_audit drop constraint if exists platform_admin_audit_action_check;
exception when others then null;
end $$;
