-- Update PV-20261020-CHEEZY payee to Mohd Aziz Bin Haime and pull bank if available
do $$
declare
  club uuid;
  emp record;
begin
  select id into club from public.tenants where upper(code) = 'THEBRO41' limit 1;
  if club is null then raise exception 'Tenant THEBRO41 tidak dijumpai'; end if;

  -- Look for Mohd Aziz in both Brozky tenants
  select e.name, e.bank_name, e.bank_account_no into emp
  from public.employees e
  join public.tenants t on t.id = e.tenant_id
  where upper(t.code) in ('THEBRO41', 'BROZKY99')
    and e.deleted_at is null
    and (e.name ilike '%aziz%haime%' or e.name ilike '%mohd aziz%')
  order by case when upper(t.code) = 'THEBRO41' then 1 else 2 end
  limit 1;

  update public.payment_vouchers
  set payee_name = coalesce(emp.name, 'Mohd Aziz Bin Haime'),
      bank_name = emp.bank_name,
      cheque_no = emp.bank_account_no,
      updated_at = now()
  where tenant_id = club and ref_no = 'PV-20261020-CHEEZY' and deleted_at is null;
end $$;

select t.code, v.ref_no, v.payee_name, v.amount, v.bank_name, v.cheque_no, v.status
from public.payment_vouchers v
join public.tenants t on t.id = v.tenant_id
where v.ref_no = 'PV-20261020-CHEEZY';
