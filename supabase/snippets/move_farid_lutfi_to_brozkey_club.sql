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
    raise exception 'Tenant tidak dijumpai. empire=% club=% codes=%', empire, club, (select string_agg(code || '=' || name, ' | ') from public.tenants where upper(code) in ('BROZKY99','THEBRO41'));
  end if;

  select array_agg(id) into ids
  from public.employees
  where tenant_id = empire
    and deleted_at is null
    and (
      name ilike '%farid%'
      or name ilike '%lutfi%'
      or name ilike '%lufti%'
    );

  if ids is null or cardinality(ids) <> 2 then
    raise exception 'Patut jumpa 2 staff, jumpa %. empire staff=%',
      coalesce(cardinality(ids), 0),
      (select string_agg(name, ' | ') from public.employees where tenant_id = empire and deleted_at is null);
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

select t.name as tenant, e.name
from public.employees e
join public.tenants t on t.id = e.tenant_id
where e.deleted_at is null
  and (e.name ilike '%farid%razzaq%' or e.name ilike '%lutfi%salim%' or e.name ilike '%lufti%salim%')
order by t.name, e.name;
