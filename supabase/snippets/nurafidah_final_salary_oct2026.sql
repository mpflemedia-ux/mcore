-- Final salary + claims, October 2026 only. September payroll is not updated.
do $$
declare
  tn uuid;
  emp_id uuid;
  n int;
begin
  select id into tn from public.tenants
  where name = 'Phion Sdn. Bhd.' and deleted_at is null
  order by created_at
  limit 1;
  if tn is null then
    raise exception 'Tenant Phion Sdn. Bhd. tidak dijumpai';
  end if;

  select count(*) into n from public.employees
  where tenant_id = tn and deleted_at is null
    and (staff_code = 'PHN-2026-006' or name ilike 'Nurafidah Binti Mohamad Nizam');
  if n <> 1 then
    raise exception 'Staff tidak sepadan. Jumpa % baris, bukan 1. Tiada rekod dicipta.', n;
  end if;

  select id into emp_id from public.employees
  where tenant_id = tn and deleted_at is null
    and (staff_code = 'PHN-2026-006' or name ilike 'Nurafidah Binti Mohamad Nizam')
  limit 1;

  insert into public.payroll_records (
    tenant_id, employee_id, month, year, pay_date,
    basic_salary,
    allowance_type_1, allowance_1,
    allowance_type_2, allowance_2,
    allowance_type_3, allowance_3,
    epf_employee, epf_employer,
    socso_employee, socso_employer,
    eis_employee, eis_employer,
    pcb, zakat, net_pay, payment_note, generated_at
  ) values (
    tn, emp_id, 10, 2026, '2026-10-04',
    900.00,
    'Basic is pro-rata. Fixed allowance is allowance 1.', 50.00,
    'Transport Claim – MRT Kwasa Sentral to MRT Semantan (MIHAS), 24 & 25 Sep 2026 (2 trip x RM6)', 12.00,
    'Medical Claim – Klinik Syifa 24 Jam Subang Bestari, Receipt No. VR-186515, 9 Sep 2026', 67.00,
    104.50, 123.50,
    4.75, 16.63,
    1.90, 1.90,
    0, 0, 917.85,
    'Final salary & claims settlement. Resignation effective 4 October 2026. Period 29 Sep 2026 – 4 Oct 2026. Statutory on wages RM950 only.',
    now()
  )
  on conflict (tenant_id, employee_id, month, year) do update set
    pay_date = excluded.pay_date,
    basic_salary = excluded.basic_salary,
    allowance_type_1 = excluded.allowance_type_1,
    allowance_1 = excluded.allowance_1,
    allowance_type_2 = excluded.allowance_type_2,
    allowance_2 = excluded.allowance_2,
    allowance_type_3 = excluded.allowance_type_3,
    allowance_3 = excluded.allowance_3,
    epf_employee = excluded.epf_employee,
    epf_employer = excluded.epf_employer,
    socso_employee = excluded.socso_employee,
    socso_employer = excluded.socso_employer,
    eis_employee = excluded.eis_employee,
    eis_employer = excluded.eis_employer,
    pcb = excluded.pcb,
    zakat = excluded.zakat,
    net_pay = excluded.net_pay,
    payment_note = excluded.payment_note
  where payroll_records.month = 10 and payroll_records.year = 2026;
end $$;

insert into public.dev_roadmap_items (title, description, module, stage)
select 'Final salary and claims settlement',
       'October payroll_records only. Claims stored in allowance 2 and 3, excluded from statutory base.',
       'hr', 'completed'
where not exists (
  select 1 from public.dev_roadmap_items where title = 'Final salary and claims settlement'
);

select e.staff_code, e.name, pr.month, pr.year, pr.basic_salary, pr.allowance_1, pr.allowance_2, pr.allowance_3,
       pr.epf_employee, pr.socso_employee, pr.eis_employee, pr.net_pay
from public.payroll_records pr
join public.employees e on e.id = pr.employee_id
join public.tenants t on t.id = pr.tenant_id
where t.name = 'Phion Sdn. Bhd.'
  and e.staff_code = 'PHN-2026-006'
  and pr.year = 2026
  and pr.month in (9, 10)
order by pr.month;
