alter table public.payroll_records
  add column if not exists basic_description text;

do $$
declare
  tn uuid;
  emp_id uuid;
  n int;
begin
  select id into tn from public.tenants
  where name = 'Phion Sdn. Bhd.' and deleted_at is null
  order by created_at limit 1;
  if tn is null then raise exception 'Tenant tidak dijumpai'; end if;

  select count(*) into n from public.employees
  where tenant_id = tn and deleted_at is null and staff_code = 'PHN-2026-006';
  if n <> 1 then raise exception 'Staff tidak sepadan. Jumpa %', n; end if;

  select id into emp_id from public.employees
  where tenant_id = tn and deleted_at is null and staff_code = 'PHN-2026-006' limit 1;

  update public.payroll_records
  set basic_description = 'Basic Salary (Pro-rata, 29 Sep – 4 Oct 2026, 6 hari)',
      payment_note = 'Final salary & claims settlement. Resignation effective 4 October 2026. Period 29 Sep 2026 – 4 Oct 2026 (6 hari). Kiraan: RM4,750 ÷ 30 = RM158.33 sehari; 6 hari = RM4,750 × 6 ÷ 30 = RM950.00 (Basic RM900.00 + Allowance RM50.00). Statutory on wages RM950 sahaja. Company round-up: EPF 105.00/124.00, SOCSO employer 16.65.'
  where tenant_id = tn and employee_id = emp_id and month = 10 and year = 2026;
end $$;

insert into public.dev_roadmap_items (title, description, module, stage)
select 'Payslip basic description',
       'payroll_records.basic_description shown on the basic line when set. Other slips keep Basic Salary.',
       'hr', 'completed'
where not exists (
  select 1 from public.dev_roadmap_items where title = 'Payslip basic description'
);

select e.staff_code, pr.month, pr.basic_salary, pr.basic_description, pr.net_pay, pr.amount_paid, pr.balance_outstanding
from public.payroll_records pr
join public.employees e on e.id = pr.employee_id
where e.staff_code = 'PHN-2026-006' and pr.year = 2026 and pr.month = 10;
