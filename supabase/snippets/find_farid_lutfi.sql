select t.code, t.name as tenant, e.name as staff, e.deleted_at
from public.employees e
join public.tenants t on t.id = e.tenant_id
where upper(t.code) in ('BROZKY99', 'THEBRO41')
  and (
    e.name ilike '%farid%'
    or e.name ilike '%lutfi%'
    or e.name ilike '%lufti%'
    or e.name ilike '%wahiyud%'
    or e.name ilike '%salim%'
  )
order by t.code, e.name;
