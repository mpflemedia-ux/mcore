select t.name as tenant, e.staff_code, e.name, pr.month, pr.year,
       pr.basic_salary, pr.allowance_1, pr.allowance_2, pr.allowance_3,
       pr.epf_employee, pr.socso_employee, pr.eis_employee, pr.net_pay, pr.payment_note
from public.payroll_records pr
join public.employees e on e.id = pr.employee_id
join public.tenants t on t.id = pr.tenant_id
where e.name ilike '%nurafidah%'
  and pr.year = 2026
  and pr.month in (9, 10)
order by t.name, pr.month;
