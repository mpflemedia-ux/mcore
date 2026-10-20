-- ============================================================================
-- DEMO TENANT — relink new auth users (created via Dashboard) to the tenant
-- Run AFTER creating demo.owner@mpflemedia.my / demo.staff@mpflemedia.my
-- fresh via Supabase Dashboard -> Authentication -> Add User.
--
-- All of demo_tenant_05_reseed_all.sql looks up the owner/staff by EMAIL
-- (expense_claims, platform_activities) or by ROLE within user_profiles
-- (pos_sessions.cashier_id) - never by a hardcoded id. So the only thing
-- needed here is creating fresh user_profiles rows for the 2 new auth user
-- ids; everything else will pick them up automatically on reseed.
--
-- SECURITY DEFINER function (not a plain block) + RESET ROLE first, same
-- reasons as the earlier fix files (SQL Editor session permissions).
-- ============================================================================

reset role;

create or replace function public._relink_demo_users()
returns jsonb
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid;
  v_branch_id uuid;
  v_owner_id uuid;
  v_staff_id uuid;
begin
  select id into v_tenant_id from tenants where code = 'DEMO';
  if v_tenant_id is null then
    raise exception 'tenant code DEMO not found';
  end if;
  select id into v_branch_id from branches where tenant_id = v_tenant_id and is_hq = true;

  select id into v_owner_id from auth.users where email = 'demo.owner@mpflemedia.my';
  select id into v_staff_id from auth.users where email = 'demo.staff@mpflemedia.my';
  if v_owner_id is null then raise exception 'demo.owner@mpflemedia.my not found in auth.users'; end if;
  if v_staff_id is null then raise exception 'demo.staff@mpflemedia.my not found in auth.users'; end if;

  if not exists (select 1 from user_profiles where id = v_owner_id) then
    insert into user_profiles (id, tenant_id, branch_id, full_name, role)
    values (v_owner_id, v_tenant_id, v_branch_id, 'Demo Owner', 'owner');
  end if;

  if not exists (select 1 from user_profiles where id = v_staff_id) then
    insert into user_profiles (id, tenant_id, branch_id, full_name, role)
    values (v_staff_id, v_tenant_id, v_branch_id, 'Demo Staff', 'staff');
  end if;

  return jsonb_build_object('owner_id', v_owner_id, 'staff_id', v_staff_id, 'tenant_id', v_tenant_id);
end;
$$;

grant execute on function public._relink_demo_users() to authenticated;

select public._relink_demo_users();

-- sanity check
select up.id, up.role, up.full_name, u.email
from user_profiles up
join auth.users u on u.id = up.id
where up.tenant_id = (select id from tenants where code = 'DEMO');

drop function if exists public._relink_demo_users();
