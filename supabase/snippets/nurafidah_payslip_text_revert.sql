do $$
declare
  tn uuid;
  emp_id uuid;
begin
  select id into tn from public.tenants
  where name = 'Phion Sdn. Bhd.' and deleted_at is null
  order by created_at limit 1;
  select id into emp_id from public.employees
  where tenant_id = tn and deleted_at is null and staff_code = 'PHN-2026-006' limit 1;
  if emp_id is null then raise exception 'Staff tidak dijumpai'; end if;

  update public.payroll_records
  set basic_description = null,
      payment_note = 'Final salary & claims settlement. Resignation effective 4 October 2026. Period 29 Sep 2026 – 4 Oct 2026. Company round-up: EPF 105.00/124.00, SOCSO employer 16.65. Statutory on wages RM950 only.'
  where tenant_id = tn and employee_id = emp_id and month = 10 and year = 2026;
end $$;

select e.staff_code, pr.month, pr.basic_salary, pr.basic_description, pr.net_pay, pr.payment_note
from public.payroll_records pr
join public.employees e on e.id = pr.employee_id
where e.staff_code = 'PHN-2026-006' and pr.year = 2026 and pr.month = 10;
