-- Tenant integrity: live-only tenant_id, unique live name, soft-delete guard, health RPC.
-- WRITE ONLY. Run in Supabase SQL Editor. Rerun-safe.

-- 1) Unique live tenant name (deleted rows ignored)
do $$
declare n int;
begin
  select count(*) into n from (
    select lower(name) from public.tenants
    where deleted_at is null and name is not null and name <> ''
    group by lower(name) having count(*) > 1
  ) d;
  if n > 0 then
    raise exception 'Live tenants with duplicate names exist (%). Rename them before unique index.', n;
  end if;
  execute 'create unique index if not exists tenants_live_name_uq on public.tenants (lower(name)) where deleted_at is null and name is not null and name <> ''''';
end $$;

-- 2) Reject tenant_id that points at a deleted tenant
create or replace function public.assert_live_tenant()
returns trigger language plpgsql as $$
declare d timestamptz;
begin
  if new.tenant_id is null then return new; end if;
  select deleted_at into d from public.tenants where id = new.tenant_id;
  if d is not null then
    raise exception 'tenant_id points at a deleted tenant' using errcode = 'P0001';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['service_contracts','service_requests','employees','invoices','payment_vouchers','customers','service_public_links','service_public_requests']
  loop
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='tenant_id') then
      execute format('drop trigger if exists trg_live_tenant on public.%I', t);
      execute format('create trigger trg_live_tenant before insert or update of tenant_id on public.%I for each row execute function public.assert_live_tenant()', t);
    end if;
  end loop;
end $$;

-- 3) soft_delete_tenant refuses if live children exist
create or replace function public.soft_delete_tenant(p_tenant_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  caller_role text; caller_email text; caller_tenant_id uuid;
  tenant_name text; tenant_code text; already_deleted timestamptz;
  live_n int := 0; chk text;
begin
  select role, tenant_id into caller_role, caller_tenant_id from public.user_profiles where id = auth.uid();
  if coalesce(lower(caller_role), '') <> 'platform_admin' then
    raise exception 'Only platform_admin can soft-delete a tenant' using errcode = '42501';
  end if;
  if caller_tenant_id is not null and caller_tenant_id = p_tenant_id then
    raise exception 'Cannot soft-delete your own home tenant' using errcode = 'P0001';
  end if;
  select name, code, deleted_at into tenant_name, tenant_code, already_deleted from public.tenants where id = p_tenant_id;
  if tenant_name is null then raise exception 'Tenant not found' using errcode = 'P0002'; end if;
  if already_deleted is not null then raise exception 'Tenant already soft-deleted' using errcode = 'P0001'; end if;
  if upper(coalesce(tenant_code, '')) in ('MPWORK24', 'MPWORK')
     or lower(coalesce(tenant_name, '')) in ('mp workspace', 'mpworkspace') then
    raise exception 'Cannot soft-delete platform home tenant' using errcode = 'P0001';
  end if;

  foreach chk in array array['service_contracts','service_requests','employees','invoices','payment_vouchers','customers']
  loop
    if exists (select 1 from information_schema.columns c1
               join information_schema.columns c2 on c2.table_name=c1.table_name and c2.column_name='deleted_at'
               where c1.table_schema='public' and c1.table_name=chk and c1.column_name='tenant_id') then
      execute format('select count(*) from public.%I where tenant_id = $1 and deleted_at is null', chk) into live_n using p_tenant_id;
      if live_n > 0 then
        raise exception 'Cannot soft-delete: % live % row(s). Move or finish them first.', live_n, chk using errcode = 'P0001';
      end if;
    end if;
  end loop;

  update public.tenants set deleted_at = now(), is_active = false where id = p_tenant_id and deleted_at is null;
  select email into caller_email from auth.users where id = auth.uid();
  insert into public.platform_admin_audit (actor_user_id, actor_email, action, target_tenant_id, target_tenant_name, details)
  values (auth.uid(), caller_email, 'soft_delete_tenant', p_tenant_id, tenant_name, jsonb_build_object('code', tenant_code, 'name', tenant_name));
end $$;
grant execute on function public.soft_delete_tenant(uuid) to authenticated;

-- 4) Health check RPC (platform_admin only)
create or replace function public.tenant_health_check()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  caller_role text; orphans int := 0; dupes int := 0; free_bad int := 0; r jsonb;
begin
  select role into caller_role from public.user_profiles where id = auth.uid();
  if coalesce(lower(caller_role), '') <> 'platform_admin' then
    raise exception 'Only platform_admin' using errcode = '42501';
  end if;
  select count(*) into orphans from public.service_contracts c
    join public.tenants t on t.id = c.tenant_id
    where c.deleted_at is null and t.deleted_at is not null;
  select count(*) into dupes from (
    select lower(name) from public.tenants where deleted_at is null and name is not null and name <> ''
    group by lower(name) having count(*) > 1
  ) d;
  select count(*) into free_bad from public.service_contracts
    where deleted_at is null and invoice_ref ilike 'FREE%' and payment_status <> 'paid';
  r := jsonb_build_object('orphans', orphans, 'dupes', dupes, 'free_bad', free_bad,
    'tenant_ok', dupes = 0, 'contract_ok', free_bad = 0, 'free_ok', free_bad = 0);
  return r;
end $$;
grant execute on function public.tenant_health_check() to authenticated;

-- 5) Audit action: keep every existing value, add manual_sql
do $$
declare vals text;
begin
  select string_agg(quote_literal(action), ', ' order by action) into vals
  from (select distinct action from public.platform_admin_audit where action is not null) a;
  if vals is null then
    vals := '''manual_sql''';
  elsif position('''manual_sql''' in vals) = 0 then
    vals := vals || ', ''manual_sql''';
  end if;
  execute 'alter table public.platform_admin_audit drop constraint if exists platform_admin_audit_action_check';
  execute 'alter table public.platform_admin_audit add constraint platform_admin_audit_action_check check (action in (' || vals || '))';
end $$;

-- 6) Mark roadmap item completed (insert if missing)
insert into public.dev_roadmap_items (title, module, stage)
select 'Tenant integrity controls', 'admin', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Tenant integrity controls');
update public.dev_roadmap_items set stage = 'completed' where title = 'Tenant integrity controls';
