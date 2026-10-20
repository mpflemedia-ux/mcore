-- ============================================================================
-- DEMO TENANT — isolate why sales_plans insert produced 0 rows
-- ============================================================================
reset role;

select current_user, (select rolsuper from pg_roles where rolname = current_user) as is_superuser;

select relrowsecurity, relforcerowsecurity
from pg_class
where oid = 'public.sales_plans'::regclass;

select count(*) as row_count_right_now
from sales_plans
where tenant_id = (select id from tenants where code = 'DEMO');

-- try the insert directly, outside any function, see what actually happens
insert into sales_plans (id, tenant_id, name, start_date, end_date, pic_employee_id, pic_name)
select '00000000-0000-0000-0312-000000000001'::uuid, t.id, 'Pelan Jualan Q4 2026', '2026-10-01'::date, '2026-12-31'::date,
  '00000000-0000-0000-0301-000000000001'::uuid, 'Siti Noraini binti Kamal'
from tenants t
where t.code = 'DEMO'
  and not exists (select 1 from sales_plans sp where sp.id = '00000000-0000-0000-0312-000000000001'::uuid);

select count(*) as row_count_after_insert
from sales_plans
where tenant_id = (select id from tenants where code = 'DEMO');
