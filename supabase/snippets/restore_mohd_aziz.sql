do $$
declare
  empire uuid;
  next_code text;
  n int;
begin
  select id into empire from public.tenants where upper(code) = 'BROZKY99' limit 1;
  if empire is null then
    raise exception 'Tenant BROZKY99 tidak dijumpai';
  end if;

  if exists (
    select 1 from public.employees
    where tenant_id = empire and deleted_at is null and name ilike 'Mohd Aziz Bin Haime'
  ) then
    return;
  end if;

  select coalesce(max((substring(staff_code from '-([0-9]+)$'))::int), 0) + 1
  into n
  from public.employees
  where tenant_id = empire and staff_code ~* '^BROZKY99-[0-9]+$';

  next_code := 'BROZKY99-' || lpad(n::text, 4, '0');

  insert into public.employees (tenant_id, name, staff_code, bank_name, bank_account_no, basic_salary)
  values (empire, 'Mohd Aziz Bin Haime', next_code, 'Public Bank', '4973014044', 5000);
end $$;

select t.code, e.name, e.staff_code, e.bank_name, e.bank_account_no, e.basic_salary, e.deleted_at
from public.employees e
join public.tenants t on t.id = e.tenant_id
where upper(t.code) = 'BROZKY99' and e.name ilike 'Mohd Aziz Bin Haime';
