do $$
declare
  empire uuid;
  club uuid;
  ids uuid[];
  rec record;
begin
  select id into club
  from public.tenants
  where upper(code) = 'THEBRO41'
  limit 1;

  select id into empire
  from public.tenants
  where upper(code) = 'BROZKY99'
  limit 1;

  if empire is null or club is null then
    raise exception 'Tenant tidak dijumpai. empire=% club=%', empire, club;
  end if;

  select array_agg(id) into ids
  from public.employees
  where tenant_id = empire
    and deleted_at is null
    and name ilike '%dayang%mahani%';

  if ids is null or cardinality(ids) <> 1 then
    raise exception 'Patut jumpa 1 staff Dayang Mahani, jumpa %. empire=% club=%',
      coalesce(cardinality(ids), 0),
      (select string_agg(name, ' | ') from public.employees where tenant_id = empire and deleted_at is null and name ilike '%dayang%'),
      (select string_agg(name || coalesce(' deleted=' || deleted_at::text, ''), ' | ') from public.employees where tenant_id = club and name ilike '%dayang%');
  end if;

  update public.employees
  set tenant_id = club
  where id = any(ids);

  for rec in
    select c.table_name
    from information_schema.columns c
    join information_schema.columns t
      on t.table_schema = c.table_schema and t.table_name = c.table_name and t.column_name = 'tenant_id'
    where c.table_schema = 'public'
      and c.column_name = 'employee_id'
      and c.table_name <> 'employees'
  loop
    execute format(
      'update public.%I set tenant_id = $1 where employee_id = any($2) and tenant_id = $3',
      rec.table_name
    ) using club, ids, empire;
  end loop;
end $$;

select t.code, t.name as tenant, e.name, e.deleted_at
from public.employees e
join public.tenants t on t.id = e.tenant_id
where e.name ilike '%dayang%mahani%'
order by t.code, e.deleted_at nulls first;
