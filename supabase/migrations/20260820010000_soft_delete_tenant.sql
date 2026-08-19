-- Soft-delete tenant accounts (platform_admin only).
-- Soft-delete only: sets tenants.deleted_at + is_active=false.
-- Does NOT hard-delete tenants, auth.users, invoices, journals, or profiles.

alter table public.tenants
  add column if not exists deleted_at timestamptz;

create index if not exists tenants_deleted_at_idx
  on public.tenants (deleted_at)
  where deleted_at is null;

-- Expand audit action check for soft_delete_tenant
alter table public.platform_admin_audit
  drop constraint if exists platform_admin_audit_action_check;
alter table public.platform_admin_audit
  add constraint platform_admin_audit_action_check
  check (action in (
    'suspend_tenant',
    'reactivate_tenant',
    'set_tenant_plan',
    'create_announcement',
    'record_tenant_payment',
    'soft_delete_tenant'
  ));

create or replace function public.soft_delete_tenant(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  caller_role text;
  caller_email text;
  caller_tenant_id uuid;
  tenant_name text;
  tenant_code text;
  already_deleted timestamptz;
begin
  select role, tenant_id into caller_role, caller_tenant_id
  from public.user_profiles where id = auth.uid();

  if coalesce(lower(caller_role), '') <> 'platform_admin' then
    raise exception 'Only platform_admin can soft-delete a tenant' using errcode = '42501';
  end if;

  -- Block deleting the caller's own home tenant
  if caller_tenant_id is not null and caller_tenant_id = p_tenant_id then
    raise exception 'Cannot soft-delete your own home tenant' using errcode = 'P0001';
  end if;

  select name, code, deleted_at
    into tenant_name, tenant_code, already_deleted
  from public.tenants where id = p_tenant_id;

  if tenant_name is null then
    raise exception 'Tenant not found' using errcode = 'P0002';
  end if;

  if already_deleted is not null then
    raise exception 'Tenant already soft-deleted' using errcode = 'P0001';
  end if;

  -- Extra guard for known platform home codes/names (case-insensitive)
  if upper(coalesce(tenant_code, '')) in ('MPWORK24', 'MPWORK')
     or lower(coalesce(tenant_name, '')) in ('mp workspace', 'mpworkspace') then
    raise exception 'Cannot soft-delete platform home tenant' using errcode = 'P0001';
  end if;

  update public.tenants
     set deleted_at = now(),
         is_active = false
   where id = p_tenant_id
     and deleted_at is null;

  select email into caller_email from auth.users where id = auth.uid();

  insert into public.platform_admin_audit (
    actor_user_id, actor_email, action, target_tenant_id, target_tenant_name, details
  ) values (
    auth.uid(),
    caller_email,
    'soft_delete_tenant',
    p_tenant_id,
    tenant_name,
    jsonb_build_object('code', tenant_code, 'name', tenant_name)
  );
end;
$$;

grant execute on function public.soft_delete_tenant(uuid) to authenticated;
