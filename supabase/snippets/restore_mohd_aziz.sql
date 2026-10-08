do $$
declare
  empire uuid;
  emp uuid;
begin
  select id into empire from public.tenants where upper(code) = 'BROZKY99' limit 1;
  if empire is null then
    raise exception 'Tenant BROZKY99 tidak dijumpai';
  end if;

  select id into emp
  from public.employees
  where tenant_id = empire
    and (name ilike 'Mohd Aziz Bin Haime' or bank_account_no = '4973014044')
  order by deleted_at nulls first
  limit 1;

  if emp is null then
    insert into public.employees (tenant_id, name, bank_name, bank_account_no, basic_salary, deleted_at)
    values (empire, 'Mohd Aziz Bin Haime', 'Public Bank', '4973014044', 5000, null)
    returning id into emp;
  else
    update public.employees
    set name = 'Mohd Aziz Bin Haime',
        bank_name = 'Public Bank',
        bank_account_no = '4973014044',
        basic_salary = 5000,
        deleted_at = null
    where id = emp;
  end if;

  if not exists (
    select 1 from public.payroll_records
    where tenant_id = empire and employee_id = emp and month = 9 and year = 2026
  ) then
    insert into public.payroll_records (
      tenant_id, employee_id, month, year, basic_salary,
      epf_employee, socso_employee, eis_employee, pcb, zakat,
      epf_employer, socso_employer, eis_employer, net_pay
    ) values (
      empire, emp, 9, 2026, 5000,
      550, 25, 10, 110, 0,
      0, 0, 0, 4305
    );
  end if;
end $$;

select t.code, e.name, e.bank_name, e.bank_account_no, e.basic_salary, e.deleted_at
from public.employees e
join public.tenants t on t.id = e.tenant_id
where e.name = 'Mohd Aziz Bin Haime';
