-- Mirror each client tenant company profile into platform home (MP Workspace) customers CRM.
-- Match key in customers.notes: MCORE_TENANT:<tenant_uuid>

create or replace function public.sync_tenant_as_platform_customer(p_tenant_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  platform_id uuid;
  t record;
  marker text;
  existing_id uuid;
  new_id uuid;
  note_body text;
begin
  if p_tenant_id is null then
    return null;
  end if;

  select id into platform_id
  from public.tenants
  where deleted_at is null
    and (
      upper(coalesce(code,'')) in ('MPWORK24','MPWORK')
      or lower(trim(coalesce(name,''))) in ('mp workspace','mpworkspace')
    )
  order by created_at asc
  limit 1;

  if platform_id is null then
    return null;
  end if;

  -- Never mirror the platform home tenant into itself as a "client"
  if p_tenant_id = platform_id then
    return null;
  end if;

  select * into t from public.tenants where id = p_tenant_id;
  if t.id is null then
    return null;
  end if;
  if t.deleted_at is not null then
    -- Soft-hide mirrored customer if tenant soft-deleted
    marker := 'MCORE_TENANT:' || p_tenant_id::text;
    update public.customers
      set deleted_at = coalesce(deleted_at, now()), updated_at = now()
    where tenant_id = platform_id
      and deleted_at is null
      and notes like marker || '%';
    return null;
  end if;

  marker := 'MCORE_TENANT:' || p_tenant_id::text;
  note_body := marker
    || E'\nCode: ' || coalesce(t.code, '')
    || E'\nSSM: ' || coalesce(t.ssm_no, '')
    || E'\n(Auto-synced from tenant registration / company profile)';

  select id into existing_id
  from public.customers
  where tenant_id = platform_id
    and notes like marker || '%'
  order by created_at asc
  limit 1;

  if existing_id is not null then
    update public.customers set
      name = coalesce(nullif(trim(t.name), ''), name),
      email = coalesce(nullif(trim(t.email), ''), email),
      phone = coalesce(nullif(trim(t.phone), ''), phone),
      address_line1 = coalesce(nullif(trim(t.address), ''), address_line1),
      city = coalesce(nullif(trim(t.city), ''), city),
      state = coalesce(nullif(trim(t.state), ''), state),
      postcode = coalesce(nullif(trim(t.postcode), ''), postcode),
      notes = note_body,
      deleted_at = null,
      updated_at = now()
    where id = existing_id;
    return existing_id;
  end if;

  insert into public.customers (
    tenant_id, name, email, phone, address_line1, city, state, postcode, notes
  ) values (
    platform_id,
    coalesce(nullif(trim(t.name), ''), coalesce(t.code, 'Client')),
    nullif(trim(t.email), ''),
    nullif(trim(t.phone), ''),
    nullif(trim(t.address), ''),
    nullif(trim(t.city), ''),
    nullif(trim(t.state), ''),
    nullif(trim(t.postcode), ''),
    note_body
  )
  returning id into new_id;

  return new_id;
exception
  when undefined_column then
    -- Older customers schema without some columns — minimal insert
    begin
      select id into existing_id from public.customers
      where tenant_id = platform_id and notes like ('MCORE_TENANT:' || p_tenant_id::text || '%') limit 1;
      if existing_id is not null then
        update public.customers set name = coalesce(nullif(trim(t.name),''), name), notes = 'MCORE_TENANT:' || p_tenant_id::text, deleted_at = null where id = existing_id;
        return existing_id;
      end if;
      insert into public.customers (tenant_id, name, notes)
      values (platform_id, coalesce(nullif(trim(t.name),''), coalesce(t.code,'Client')), 'MCORE_TENANT:' || p_tenant_id::text)
      returning id into new_id;
      return new_id;
    exception when others then
      return null;
    end;
  when others then
    raise warning 'sync_tenant_as_platform_customer failed: %', sqlerrm;
    return null;
end;
$$;

grant execute on function public.sync_tenant_as_platform_customer(uuid) to authenticated;

-- Trigger: new tenant or profile field change
create or replace function public.trg_tenants_sync_platform_customer()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.sync_tenant_as_platform_customer(new.id);
  return new;
end;
$$;

drop trigger if exists trg_tenants_sync_platform_customer on public.tenants;
create trigger trg_tenants_sync_platform_customer
  after insert or update of name, code, email, phone, address, city, state, postcode, ssm_no, deleted_at
  on public.tenants
  for each row
  execute function public.trg_tenants_sync_platform_customer();

-- Also call from company profile RPC path (redundant with trigger if columns update, safe)
-- Backfill existing non-platform tenants
do $$
declare r record;
begin
  for r in
    select id from public.tenants
    where deleted_at is null
      and upper(coalesce(code,'')) not in ('MPWORK24','MPWORK')
      and lower(trim(coalesce(name,''))) not in ('mp workspace','mpworkspace')
  loop
    perform public.sync_tenant_as_platform_customer(r.id);
  end loop;
end $$;
