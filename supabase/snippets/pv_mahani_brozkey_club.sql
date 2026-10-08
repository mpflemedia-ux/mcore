do $$
declare
  club uuid;
  emp record;
  desc_txt text;
begin
  select id into club from public.tenants where upper(code) = 'THEBRO41' limit 1;
  if club is null then
    raise exception 'Tenant THEBRO41 tidak dijumpai';
  end if;

  select name, bank_name, bank_account_no into emp
  from public.employees
  where tenant_id = club and deleted_at is null and name ilike '%dayang%mahani%'
  limit 1;

  desc_txt := E'Bayaran elaun Dayang Mahani — MIHAS\n'
    || E'1. Elaun pengurusan dan follow-up leads — 46 rekod WhatsApp-Web; elaun tugasan — RM 300.00\n'
    || E'2. Tugasan operasi dan jualan di MIHAS — 4 hari x RM150 — RM 600.00\n'
    || E'3. Setup dan persediaan booth — elaun tugasan sekali bayar — RM 50.00\n'
    || E'4. Insentif jualan produk — kira-kira 10% daripada RM1,475 — RM 150.00\n'
    || E'Jumlah RM 1,100.00';

  if exists (select 1 from public.payment_vouchers where tenant_id = club and ref_no = 'PV-20261008-MAHANI' and deleted_at is null) then
    update public.payment_vouchers
    set payee_name = coalesce(emp.name, 'Dayang Mahani Binti Haime'),
        amount = 1100.00,
        voucher_date = '2026-10-08',
        payment_method = 'Bank Transfer',
        bank_name = emp.bank_name,
        cheque_no = emp.bank_account_no,
        description = desc_txt,
        status = 'draft',
        updated_at = now()
    where tenant_id = club and ref_no = 'PV-20261008-MAHANI' and deleted_at is null;
  else
    insert into public.payment_vouchers (
      tenant_id, ref_no, voucher_date, payee_name, amount, payment_method,
      bank_name, cheque_no, description, status, created_at, updated_at
    ) values (
      club, 'PV-20261008-MAHANI', '2026-10-08',
      coalesce(emp.name, 'Dayang Mahani Binti Haime'),
      1100.00, 'Bank Transfer', emp.bank_name, emp.bank_account_no,
      desc_txt, 'draft', now(), now()
    );
  end if;
end $$;

select t.code, v.ref_no, v.voucher_date, v.payee_name, v.amount, v.status, v.bank_name, v.cheque_no
from public.payment_vouchers v
join public.tenants t on t.id = v.tenant_id
where v.ref_no = 'PV-20261008-MAHANI';
