select t.code, t.name as tenant, e.id, e.name, e.deleted_at, e.bank_account_no
from public.employees e
join public.tenants t on t.id = e.tenant_id
where e.name ilike '%aziz%haime%'
order by t.code, e.deleted_at nulls first;

select t.code, pr.month, pr.year, pr.net_pay, e.name, e.deleted_at
from public.payroll_records pr
join public.employees e on e.id = pr.employee_id
join public.tenants t on t.id = pr.tenant_id
where e.name ilike '%aziz%haime%'
order by pr.year, pr.month;
