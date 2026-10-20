-- PV disbursement commission for The Brozkey Club staff
-- Based on COMMISSION SUMMARY: Cheezy 282.85, Farid 699.50, Lutfi 672.10, Total 1654.45
do $$
declare
  club uuid;
  emp_cheezy record;
  emp_farid record;
  emp_lutfi record;
begin
  select id into club from public.tenants where upper(code) = 'THEBRO41' limit 1;
  if club is null then
    raise exception 'Tenant THEBRO41 (The Brozkey Club) tidak dijumpai';
  end if;

  -- Try match staff by nickname or name
  select name, bank_name, bank_account_no into emp_cheezy
  from public.employees
  where tenant_id = club and deleted_at is null and (nickname ilike '%cheezy%' or name ilike '%cheezy%')
  limit 1;

  select name, bank_name, bank_account_no into emp_farid
  from public.employees
  where tenant_id = club and deleted_at is null and (name ilike '%farid%' or nickname ilike '%farid%')
  limit 1;

  select name, bank_name, bank_account_no into emp_lutfi
  from public.employees
  where tenant_id = club and deleted_at is null and (name ilike '%lutfi%' or nickname ilike '%lutfi%')
  limit 1;

  -- Cheezy PV-20261020-CHEEZY RM 282.85
  if exists (select 1 from public.payment_vouchers where tenant_id = club and ref_no = 'PV-20261020-CHEEZY' and deleted_at is null) then
    update public.payment_vouchers
    set payee_name = coalesce(emp_cheezy.name, 'Cheezy'),
        amount = 282.85,
        voucher_date = '2026-10-20',
        payment_method = 'Bank Transfer',
        bank_name = emp_cheezy.bank_name,
        cheque_no = emp_cheezy.bank_account_no,
        description = E'Commission disbursement — Commission Summary\nCommission 1: RM 230.50\nCommission 2: RM 52.35\nTotal: RM 282.85',
        status = 'draft',
        updated_at = now()
    where tenant_id = club and ref_no = 'PV-20261020-CHEEZY' and deleted_at is null;
  else
    insert into public.payment_vouchers (
      tenant_id, ref_no, voucher_date, payee_name, amount, payment_method,
      bank_name, cheque_no, description, status, created_at, updated_at
    ) values (
      club, 'PV-20261020-CHEEZY', '2026-10-20',
      coalesce(emp_cheezy.name, 'Cheezy'),
      282.85, 'Bank Transfer', emp_cheezy.bank_name, emp_cheezy.bank_account_no,
      E'Commission disbursement — Commission Summary\nCommission 1: RM 230.50\nCommission 2: RM 52.35\nTotal: RM 282.85',
      'draft', now(), now()
    );
  end if;

  -- Farid PV-20261020-FARID RM 699.50
  if exists (select 1 from public.payment_vouchers where tenant_id = club and ref_no = 'PV-20261020-FARID' and deleted_at is null) then
    update public.payment_vouchers
    set payee_name = coalesce(emp_farid.name, 'Farid'),
        amount = 699.50,
        voucher_date = '2026-10-20',
        payment_method = 'Bank Transfer',
        bank_name = emp_farid.bank_name,
        cheque_no = emp_farid.bank_account_no,
        description = E'Commission disbursement — Commission Summary\nCommission 1: RM 561.80\nCommission 2: RM 137.70\nTotal: RM 699.50',
        status = 'draft',
        updated_at = now()
    where tenant_id = club and ref_no = 'PV-20261020-FARID' and deleted_at is null;
  else
    insert into public.payment_vouchers (
      tenant_id, ref_no, voucher_date, payee_name, amount, payment_method,
      bank_name, cheque_no, description, status, created_at, updated_at
    ) values (
      club, 'PV-20261020-FARID', '2026-10-20',
      coalesce(emp_farid.name, 'Farid'),
      699.50, 'Bank Transfer', emp_farid.bank_name, emp_farid.bank_account_no,
      E'Commission disbursement — Commission Summary\nCommission 1: RM 561.80\nCommission 2: RM 137.70\nTotal: RM 699.50',
      'draft', now(), now()
    );
  end if;

  -- Lutfi PV-20261020-LUTFI RM 672.10
  if exists (select 1 from public.payment_vouchers where tenant_id = club and ref_no = 'PV-20261020-LUTFI' and deleted_at is null) then
    update public.payment_vouchers
    set payee_name = coalesce(emp_lutfi.name, 'Lutfi'),
        amount = 672.10,
        voucher_date = '2026-10-20',
        payment_method = 'Bank Transfer',
        bank_name = emp_lutfi.bank_name,
        cheque_no = emp_lutfi.bank_account_no,
        description = E'Commission disbursement — Commission Summary\nCommission 1: RM 547.90\nCommission 2: RM 124.20\nTotal: RM 672.10',
        status = 'draft',
        updated_at = now()
    where tenant_id = club and ref_no = 'PV-20261020-LUTFI' and deleted_at is null;
  else
    insert into public.payment_vouchers (
      tenant_id, ref_no, voucher_date, payee_name, amount, payment_method,
      bank_name, cheque_no, description, status, created_at, updated_at
    ) values (
      club, 'PV-20261020-LUTFI', '2026-10-20',
      coalesce(emp_lutfi.name, 'Lutfi'),
      672.10, 'Bank Transfer', emp_lutfi.bank_name, emp_lutfi.bank_account_no,
      E'Commission disbursement — Commission Summary\nCommission 1: RM 547.90\nCommission 2: RM 124.20\nTotal: RM 672.10',
      'draft', now(), now()
    );
  end if;
end $$;

select t.code, t.name as tenant, v.ref_no, v.voucher_date, v.payee_name, v.amount, v.status, v.bank_name, v.cheque_no
from public.payment_vouchers v
join public.tenants t on t.id = v.tenant_id
where v.ref_no in ('PV-20261020-CHEEZY', 'PV-20261020-FARID', 'PV-20261020-LUTFI')
order by v.ref_no;
