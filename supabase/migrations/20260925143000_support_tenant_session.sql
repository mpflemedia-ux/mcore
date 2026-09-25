-- Platform admin support session: enter/exit a tenant workspace.
-- Role stays platform_admin. Profile tenant_id moves so existing RLS works.
-- Home tenant stored in user_profiles.permissions.support_home_tenant_id.

alter table public.platform_admin_audit
  drop constraint if exists platform_admin_audit_action_check;

alter table public.platform_admin_audit
  add constraint platform_admin_audit_action_check
  check (action in (
    'suspend_tenant', 'reactivate_tenant', 'set_tenant_plan',
    'create_announcement', 'soft_delete_tenant', 'record_payment',
    'delete_tenant_plan_payment', 'enter_support_tenant', 'exit_support_tenant'
  ));

create or replace function public.enter_support_tenant(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  caller_email text;
  home_id uuid;
  t public.tenants%rowtype;
  perms jsonb;
begin
  select role, permissions into caller_role, perms
    from public.user_profiles where id = auth.uid();
  if coalesce(lower(caller_role), '') <> 'platform_admin' then
    raise exception 'Only platform_admin can enter a tenant workspace' using errcode = '42501';
  end if;
  select * into t from public.tenants where id = p_tenant_id and deleted_at is null;
  if t.id is null then
    select * into t from public.tenants where id = p_tenant_id;
  end if;
  if t.id is null then
    raise exception 'Tenant not found' using errcode = 'P0002';
  end if;

  home_id := nullif(perms->>'support_home_tenant_id', '')::uuid;
  if home_id is null then
    select tenant_id into home_id from public.user_profiles where id = auth.uid();
  end if;
  perms := coalesce(perms, '{}'::jsonb)
    || jsonb_build_object(
      'support_home_tenant_id', home_id,
      'support_active_tenant_id', p_tenant_id
    );

  update public.user_profiles
     set tenant_id = p_tenant_id, permissions = perms
   where id = auth.uid();

  select email into caller_email from auth.users where id = auth.uid();
  insert into public.platform_admin_audit (
    actor_user_id, actor_email, action, target_tenant_id, target_tenant_name
  ) values (
    auth.uid(), caller_email, 'enter_support_tenant', t.id, t.name
  );

  return jsonb_build_object(
    'id', t.id, 'code', t.code, 'name', t.name,
    'plan', t.plan, 'plan_id', t.plan_id,
    'home_tenant_id', home_id
  );
end;
$$;

create or replace function public.exit_support_tenant()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  caller_email text;
  home_id uuid;
  active_id uuid;
  t public.tenants%rowtype;
  perms jsonb;
begin
  select role, permissions, tenant_id into caller_role, perms, active_id
    from public.user_profiles where id = auth.uid();
  if coalesce(lower(caller_role), '') <> 'platform_admin' then
    raise exception 'Only platform_admin can exit support session' using errcode = '42501';
  end if;
  home_id := nullif(perms->>'support_home_tenant_id', '')::uuid;
  if home_id is null then
    home_id := active_id;
  end if;
  select * into t from public.tenants where id = home_id;

  perms := coalesce(perms, '{}'::jsonb)
    - 'support_active_tenant_id'
    - 'support_home_tenant_id';

  update public.user_profiles
     set tenant_id = home_id, permissions = perms
   where id = auth.uid();

  select email into caller_email from auth.users where id = auth.uid();
  insert into public.platform_admin_audit (
    actor_user_id, actor_email, action, target_tenant_id, target_tenant_name
  ) values (
    auth.uid(), caller_email, 'exit_support_tenant', coalesce(active_id, home_id), coalesce(t.name, 'home')
  );

  return jsonb_build_object(
    'id', t.id, 'code', t.code, 'name', t.name,
    'plan', t.plan, 'plan_id', t.plan_id
  );
end;
$$;

grant execute on function public.enter_support_tenant(uuid) to authenticated;
grant execute on function public.exit_support_tenant() to authenticated;
