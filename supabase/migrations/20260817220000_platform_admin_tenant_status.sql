-- Platform-admin tenant suspend/reactivate + audit trail.
--
-- tenants.is_active already exists (boolean) — this migration does NOT add
-- or rename any tenant column. It only adds the audit table and the two
-- RPCs the app calls to flip is_active, both of which re-check the caller's
-- role server-side rather than trusting RLS alone for a destructive action.

create table if not exists public.platform_admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id),
  actor_email text,
  action text not null check (action in ('suspend_tenant', 'reactivate_tenant')),
  target_tenant_id uuid not null references public.tenants(id) on delete cascade,
  target_tenant_name text,
  created_at timestamptz not null default now()
);
create index if not exists platform_admin_audit_created_idx on public.platform_admin_audit(created_at desc);

alter table public.platform_admin_audit enable row level security;

-- Read-only from the client, and only for platform_admin — every write
-- happens exclusively through the two SECURITY DEFINER functions below
-- (which bypass RLS for their own INSERT as the function owner), so there
-- is deliberately no INSERT/UPDATE/DELETE policy for the authenticated
-- role at all. That keeps the trail append-only and tamper-proof even for
-- a platform_admin using the API directly.
drop policy if exists platform_admin_audit_select on public.platform_admin_audit;
create policy platform_admin_audit_select on public.platform_admin_audit for select to authenticated
  using (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.role = 'platform_admin'
    )
  );

create or replace function public.suspend_tenant(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  caller_role text;
  caller_email text;
  tenant_name text;
begin
  select role into caller_role from public.user_profiles where id = auth.uid();
  -- coalesce(...,'') deliberately, not the bare column — see
  -- 20260809010000_period_lock_trigger.sql's own comment on this exact
  -- pattern: a NULL caller_role makes `NULL <> 'platform_admin'` evaluate
  -- to SQL NULL, and plpgsql's IF treats a NULL condition as FALSE, so the
  -- exception would be silently skipped and execution would fall straight
  -- through to the UPDATE — a real privilege-escalation bug, not just style.
  if coalesce(lower(caller_role), '') <> 'platform_admin' then
    raise exception 'Only platform_admin can suspend a tenant' using errcode = '42501';
  end if;

  select email into caller_email from auth.users where id = auth.uid();
  select name into tenant_name from public.tenants where id = p_tenant_id;
  if tenant_name is null then
    raise exception 'Tenant not found' using errcode = 'P0002';
  end if;

  update public.tenants set is_active = false where id = p_tenant_id;

  insert into public.platform_admin_audit (actor_user_id, actor_email, action, target_tenant_id, target_tenant_name)
  values (auth.uid(), caller_email, 'suspend_tenant', p_tenant_id, tenant_name);
end;
$$;

create or replace function public.reactivate_tenant(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  caller_role text;
  caller_email text;
  tenant_name text;
begin
  select role into caller_role from public.user_profiles where id = auth.uid();
  if coalesce(lower(caller_role), '') <> 'platform_admin' then
    raise exception 'Only platform_admin can reactivate a tenant' using errcode = '42501';
  end if;

  select email into caller_email from auth.users where id = auth.uid();
  select name into tenant_name from public.tenants where id = p_tenant_id;
  if tenant_name is null then
    raise exception 'Tenant not found' using errcode = 'P0002';
  end if;

  update public.tenants set is_active = true where id = p_tenant_id;

  insert into public.platform_admin_audit (actor_user_id, actor_email, action, target_tenant_id, target_tenant_name)
  values (auth.uid(), caller_email, 'reactivate_tenant', p_tenant_id, tenant_name);
end;
$$;

grant execute on function public.suspend_tenant(uuid) to authenticated;
grant execute on function public.reactivate_tenant(uuid) to authenticated;
