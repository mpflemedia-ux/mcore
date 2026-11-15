-- Service commission PVD: only the staff in this run (e.g. commission-only staff), not every approved staff-month with a svc PV.
-- Idempotent. Replaces svc_create_pvd(int,int,text,boolean) with an optional p_emp_ids filter (null = old behaviour).
drop function if exists public.svc_create_pvd(int, int, text, boolean);
create or replace function public.svc_create_pvd(p_month int, p_year int, p_title text default null, p_bm boolean default true, p_emp_ids uuid[] default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tid uuid := public.svc__my_tenant();
  per text; bid uuid; bref text; bst text; n int := 0; tot numeric := 0; r record; lid uuid; i int := 0; created boolean := false;
  mon text;
begin
  if auth.uid() is null or tid is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  if p_month is null or p_month not between 1 and 12 or p_year is null or p_year not between 2000 and 2100 then
    raise exception 'Invalid period' using errcode = '22023';
  end if;
  if not public.svc__is_hr(tid) then raise exception 'Only HR managers can create the payment voucher' using errcode = '42501'; end if;
  if to_regprocedure('public.pv__can(text)') is not null then
    if not public.pv__can('vouchers') then raise exception 'No access to Payment Vouchers' using errcode = '42501'; end if;
  end if;
  per := p_year::text || '-' || lpad(p_month::text, 2, '0');
  mon := (case when p_bm then array['Jan','Feb','Mac','Apr','Mei','Jun','Jul','Ogo','Sep','Okt','Nov','Dis']
               else array['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] end)[p_month] || ' ' || p_year;

  select count(*), coalesce(sum(v.amount), 0) into n, tot
  from public.svc_comm_months m join public.payment_vouchers v on v.tenant_id = m.tenant_id and v.source = 'svc' and v.source_ref = m.id
    and v.deleted_at is null and v.status <> 'void'
  where m.tenant_id = tid and m.month = p_month and m.year = p_year and m.deleted_at is null and m.status = 'approved'
    and (p_emp_ids is null or m.employee_id = any(p_emp_ids));
  if n = 0 then raise exception 'No payment vouchers for this month yet' using errcode = 'P0002'; end if;

  perform pg_advisory_xact_lock(hashtext(tid::text || ':svc-pvd:' || per));
  select id, ref_no, status into bid, bref, bst from public.payment_voucher_batches
    where tenant_id = tid and source = 'svc' and source_period = per and deleted_at is null limit 1;
  if bid is null then
    insert into public.payment_voucher_batches (tenant_id, ref_no, batch_date, title, status, total_amount, line_count,
      prepared_by, source, source_period, created_by, created_at, updated_at)
    values (tid, public.pv__next_ref(tid, 'PVD'), current_date,
      coalesce(nullif(btrim(p_title), ''), case when p_bm then 'Komisen Servis ' else 'Service Commission ' end || mon),
      'converted', tot, n,
      (select coalesce(nullif(btrim(u.full_name), ''), 'HR') from public.user_profiles u where u.id = auth.uid()),
      'svc', per, auth.uid(), now(), now())
    returning id, ref_no, status into bid, bref, bst;
    created := true;
  end if;
  -- lines are rebuilt from the live PVs while no line is paid yet (paid lines are never touched)
  if not exists (select 1 from public.payment_voucher_batch_lines where batch_id = bid and pay_status = 'paid') then
    update public.payment_vouchers set batch_id = null, batch_line_id = null where tenant_id = tid and batch_id = bid;
    delete from public.payment_voucher_batch_lines where batch_id = bid and tenant_id = tid;
    for r in
      select v.id as vid, v.ref_no, v.payee_name, v.payee_id, v.amount, v.payment_method, v.bank_name, v.bank_account_no, v.phone,
             m.id as mid, m.svc_commission, m.prod_commission, m.bonus
      from public.svc_comm_months m join public.payment_vouchers v on v.tenant_id = m.tenant_id and v.source = 'svc' and v.source_ref = m.id
        and v.deleted_at is null and v.status <> 'void'
      where m.tenant_id = tid and m.month = p_month and m.year = p_year and m.deleted_at is null and m.status = 'approved'
    and (p_emp_ids is null or m.employee_id = any(p_emp_ids))
      order by v.payee_name
    loop
      i := i + 1;
      insert into public.payment_voucher_batch_lines (tenant_id, batch_id, sort_order, payee_name, amount, payment_method, bank_name,
        bank_account_no, payee_type, payee_id, phone, category, description, voucher_id, source, source_ref, pay_status)
      values (tid, bid, i, r.payee_name, r.amount, coalesce(r.payment_method, 'Bank Transfer'), r.bank_name, r.bank_account_no,
        'employee', r.payee_id, r.phone, 'other',
        coalesce(r.ref_no, '') || ' · ' || case when p_bm then 'Servis ' else 'Service ' end || 'RM' || to_char(coalesce(r.svc_commission, 0), 'FM999,999,990.00') ||
          ' · ' || case when p_bm then 'Produk ' else 'Product ' end || 'RM' || to_char(coalesce(r.prod_commission, 0), 'FM999,999,990.00') ||
          case when coalesce(r.bonus, 0) > 0 then ' · Bonus RM' || to_char(r.bonus, 'FM999,999,990.00') else '' end,
        r.vid, 'svc', r.mid, 'unpaid')
      returning id into lid;
      update public.payment_vouchers set batch_id = bid, batch_line_id = lid where id = r.vid and tenant_id = tid;
    end loop;
    update public.payment_voucher_batches set total_amount = tot, line_count = n, updated_at = now() where id = bid;
  end if;
  return jsonb_build_object('id', bid, 'ref_no', bref, 'status', bst, 'lines', n, 'total', tot, 'created', created, 'period', per);
end;
$$;
revoke all on function public.svc_create_pvd(int, int, text, boolean, uuid[]) from public, anon;
grant execute on function public.svc_create_pvd(int, int, text, boolean, uuid[]) to authenticated;

insert into dev_roadmap_items (id, title, description, module, stage, started_at, completed_at)
select gen_random_uuid(), 'Service commission: PVD only for staff on the all-services scheme',
  '"Create PV for all staff this month" now only takes staff on the all-services (commission-only) scheme when the month mixes schemes, and the PVD lists only those staff (svc_create_pvd p_emp_ids). Staff on the old scheme are skipped and named in the confirm box.',
  'hr', 'completed', now(), now()
where not exists (select 1 from dev_roadmap_items where title = 'Service commission: PVD only for staff on the all-services scheme');

notify pgrst, 'reload schema';
