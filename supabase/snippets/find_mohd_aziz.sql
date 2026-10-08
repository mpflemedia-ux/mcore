select t.code, t.name as tenant, e.id, e.name, e.deleted_at, e.bank_name, e.bank_account_no
from public.employees e
join public.tenants t on t.id = e.tenant_id
where e.bank_account_no like '%4973014044%'
   or e.name ilike '%aziz%'
   or replace(lower(e.name), ' ', '') like '%mohdaziz%'
order by t.code, e.name;

select t.code, pr.month, pr.year, pr.net_pay, pr.employee_id, e.name
from public.payroll_records pr
left join public.employees e on e.id = pr.employee_id
join public.tenants t on t.id = pr.tenant_id
where upper(t.code) = 'BROZKY99'
  and pr.year = 2026
  and pr.month = 9
order by e.name nulls last;
