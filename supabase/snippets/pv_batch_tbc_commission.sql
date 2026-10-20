-- Create PV Disbursement batch for TBC commission staff
do $$
declare
  club uuid;
  bid uuid;
begin
  select id into club from public.tenants where upper(code) = 'THEBRO41' limit 1;
  if club is null then raise exception 'Tenant THEBRO41 tidak dijumpai'; end if;

  -- Create or get batch
  if exists (select 1 from public.payment_voucher_batches where tenant_id = club and ref_no = 'PVB-20261020-COMM' and deleted_at is null) then
    select id into bid from public.payment_voucher_batches where tenant_id = club and ref_no = 'PVB-20261020-COMM' and deleted_at is null;
    update public.payment_voucher_batches
    set title = 'Commission Disbursement — Staff',
        batch_date = '2026-10-20',
        status = 'draft',
        total_amount = 1654.45,
        line_count = 3,
        updated_at = now()
    where id = bid;
    delete from public.payment_voucher_batch_lines where batch_id = bid;
  else
    insert into public.payment_voucher_batches (
      tenant_id, ref_no, batch_date, title, status, total_amount, line_count, created_at, updated_at
    ) values (
      club, 'PVB-20261020-COMM', '2026-10-20', 'Commission Disbursement — Staff', 'draft', 1654.45, 3, now(), now()
    ) returning id into bid;
  end if;

  -- Lines
  insert into public.payment_voucher_batch_lines (
    tenant_id, batch_id, sort_order, payee_name, amount, payment_method, bank_name, cheque_no, description
  ) values
    (club, bid, 1, 'Mohd Aziz Bin Haime', 282.85, 'Bank Transfer', 'Public Bank', '4973014044', 'Commission 1: 230.50 + Commission 2: 52.35'),
    (club, bid, 2, 'Muhammad Farid Razzaq Bin Wahiyudin', 699.50, 'Bank Transfer', 'Public Bank', '4975758817', 'Commission 1: 561.80 + Commission 2: 137.70'),
    (club, bid, 3, 'Muhammad Lutfi Bin Salim', 672.10, 'Bank Transfer', 'Maybank', '162179901324', 'Commission 1: 547.90 + Commission 2: 124.20');
end $$;

select b.ref_no, b.title, b.total_amount, b.line_count, b.status,
       l.sort_order, l.payee_name, l.amount, l.bank_name, l.cheque_no
from public.payment_voucher_batches b
join public.payment_voucher_batch_lines l on l.batch_id = b.id
join public.tenants t on t.id = b.tenant_id
where b.ref_no = 'PVB-20261020-COMM'
order by l.sort_order;
