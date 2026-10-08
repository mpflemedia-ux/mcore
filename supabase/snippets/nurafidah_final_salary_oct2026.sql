-- Company method for this October row only. September is not updated.
-- System percent on RM950 is EPF 104.50/123.50 and SOCSO employer 16.63.
-- No KWSP RM20 table exists. This row stores the company round-up.
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
    and name ilike 'Nurafidah Binti Mohamad Nizam';
  if n <> 1 then
    raise exception 'Staff tidak sepadan. Jumpa % baris. Tiada kemaskini.', n;
  end if;

  select id into emp_id from public.employees
  where tenant_id = tn and deleted_at is null
    and name ilike 'Nurafidah Binti Mohamad Nizam'
  limit 1;

  update public.employees
  set staff_code = 'PHN-2026-006'
  where id = emp_id and tenant_id = tn and staff_code is null;

  update public.payroll_records
  set basic_salary = 900.00,
      allowance_type_1 = 'Fixed Allowance (Pro-rata, 29 Sep – 4 Oct 2026, 6 hari)',
      allowance_1 = 50.00,
      allowance_type_2 = 'Transport Claim – MRT Kwasa Sentral to MRT Semantan (MIHAS), 24 & 25 Sep 2026 (2 trip x RM6)',
      allowance_2 = 12.00,
      allowance_type_3 = 'Medical Claim – Klinik Syifa 24 Jam Subang Bestari, Receipt No. VR-186515, 9 Sep 2026',
      allowance_3 = 67.00,
      epf_employee = 105.00,
      epf_employer = 124.00,
      socso_employee = 4.75,
      socso_employer = 16.65,
      eis_employee = 1.90,
      eis_employer = 1.90,
      pcb = 0,
      zakat = 0,
      net_pay = 917.35,
      pay_date = '2026-10-04',
      payment_note = 'Final salary & claims settlement. Resignation effective 4 October 2026. Period 29 Sep 2026 – 4 Oct 2026. Company round-up: EPF 105.00/124.00, SOCSO employer 16.65. Statutory on wages RM950 only.'
  where tenant_id = tn and employee_id = emp_id and month = 10 and year = 2026;
end $$;

select e.staff_code, e.name, pr.month, pr.basic_salary, pr.allowance_1, pr.allowance_2, pr.allowance_3,
       pr.epf_employee, pr.epf_employer, pr.socso_employee, pr.socso_employer, pr.eis_employee, pr.net_pay
from public.payroll_records pr
join public.employees e on e.id = pr.employee_id
join public.tenants t on t.id = pr.tenant_id
where t.name = 'Phion Sdn. Bhd.'
  and e.name ilike 'Nurafidah Binti Mohamad Nizam'
  and pr.year = 2026 and pr.month in (9, 10)
order by pr.month;
