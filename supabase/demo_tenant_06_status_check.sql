-- ============================================================================
-- DEMO TENANT — status check (read-only, changes nothing)
-- Confirms: (1) whether reset_demo_tenant() function exists yet, and
-- (2) current row counts for the demo tenant's operational data.
-- ============================================================================
reset role;

select 'reset_demo_tenant() function exists' as check_item,
  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'reset_demo_tenant')::text as result
union all
select 'customers', (select count(*)::text from customers where tenant_id = (select id from tenants where code='DEMO'))
union all
select 'invoices', (select count(*)::text from invoices where tenant_id = (select id from tenants where code='DEMO'))
union all
select 'employees', (select count(*)::text from employees where tenant_id = (select id from tenants where code='DEMO'))
union all
select 'sales_plans', (select count(*)::text from sales_plans where tenant_id = (select id from tenants where code='DEMO'));
