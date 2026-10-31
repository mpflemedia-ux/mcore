-- Payroll Reconciliation v3 — core (idempotent; safe to re-run).
--   1) payroll_records: paid_date, pay_ref, arrears_paid
--   2) PV / PVD lines: nullable period_month / period_year (statutory remittance period)
--   3) helpers: payroll__is_hr(tenant), payroll__text_period(text)
--   4) trigger: SD-sourced PVD line paid/unpaid -> payroll_records paid fields
--   5) RPCs: payroll_recon_mark_paid, payroll_recon_record_payment,
--            payroll_recon_statutory_items, payroll_recon_link_statutory,
--            payroll_recon_monthly_remind (+ marker table)
--   6) pv_import_sd: PVD salary line amount = net_pay + arrears_paid (no extra journal)
-- No accounting journals are posted by anything here.

-- ---------- 1) payroll_records columns ----------
alter table public.payroll_records add column if not exists paid_date date;
alter table public.payroll_records add column if not exists pay_ref text;
alter table public.payroll_records add column if not exists arrears_paid numeric(14,2) not null default 0;

-- ---------- 2) statutory remittance period on PV / PVD lines ----------
alter table public.payment_vouchers add column if not exists period_month int;
alter table public.payment_vouchers add column if not exists period_year int;
alter table public.payment_voucher_batch_lines add column if not exists period_month int;
alter table public.payment_voucher_batch_lines add column if not exists period_year int;
alter table public.payment_vouchers drop constraint if exists pv_period_chk;
alter table public.payment_vouchers add constraint pv_period_chk check (
  (period_month is null or period_month between 1 and 12) and (period_year is null or period_year between 2000 and 2100)) not valid;
alter table public.payment_voucher_batch_lines drop constraint if exists pvd_lines_period_chk;
alter table public.payment_voucher_batch_lines add constraint pvd_lines_period_chk check (
  (period_month is null or period_month between 1 and 12) and (period_year is null or period_year between 2000 and 2100)) not valid;

-- ---------- 3) helpers ----------
-- HR manager of p_tenant, not in a view-only support session.
create or replace function public.payroll__is_hr(p_tenant uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
      select 1 from public.user_profiles u
      where u.id = auth.uid() and u.tenant_id = p_tenant
        and lower(coalesce(u.role, '')) in ('owner', 'admin', 'platform_admin', 'manager', 'hr'))
    and not exists (
      select 1 from public.platform_support_sessions s
      where s.actor_id = auth.uid() and s.tenant_id = p_tenant and s.ended_at is null
        and coalesce(s.view_only, false) and s.deleted_at is null)
$$;

-- Period from free text, e.g. "KWSP Oct 2026", "Caruman PERKESO Okt 2026", "EPF 10/2026" -> {month, year}; null when not found.
create or replace function public.payroll__text_period(p_text text)
returns int[] language plpgsql immutable as $$
declare
  t text := lower(coalesce(p_text, ''));
  y int;
  m int;
  mm text;
begin
  mm := substring(t from '\m(0?[1-9]|1[0-2])[/-](20[0-9]{2})\M');
  if mm is not null then
    m := mm::int;
    y := substring(t from '\m(?:0?[1-9]|1[0-2])[/-](20[0-9]{2})\M')::int;
    return array[m, y];
  end if;
  y := substring(t from '\m(20[0-9]{2})\M')::int;
  if y is null then return null; end if;
  m := case
    when t ~ '\m(jan|januari|january)\M' then 1
    when t ~ '\m(feb|februari|february)\M' then 2
    when t ~ '\m(mar|mac|march)\M' then 3
    when t ~ '\m(apr|april)\M' then 4
    when t ~ '\m(may|mei)\M' then 5
    when t ~ '\m(jun|june)\M' then 6
    when t ~ '\m(jul|julai|july)\M' then 7
    when t ~ '\m(aug|ogos|august)\M' then 8
    when t ~ '\m(sep|sept|september)\M' then 9
    when t ~ '\m(oct|okt|october|oktober)\M' then 10
    when t ~ '\m(nov|november)\M' then 11
    when t ~ '\m(dec|dis|disember|december)\M' then 12
  end;
  if m is null then return null; end if;
  return array[m, y];
end;
$$;

-- ---------- 4) SD-sourced PVD line (or the PV converted from it) paid/unpaid -> payroll_records ----------
-- paid   : amount_paid = least(net, paid amount + arrears already allocated to this record), balance = net - paid
-- unpaid : amount_paid = arrears allocated to this record (0 when none), balance = net - that
create or replace function public.payroll__apply_sd_paid(p_record uuid, p_tenant uuid, p_paid boolean, p_amount numeric, p_date date, p_ref text)
returns void language plpgsql security definer set search_path = public as $$
declare
  alloc numeric := 0;
  amt numeric := greatest(coalesce(p_amount, 0), 0);
begin
  if p_record is null then return; end if;
  begin
    if to_regclass('public.payroll_arrears_allocations') is not null then
      execute 'select coalesce(sum(amount),0) from public.payroll_arrears_allocations where target_record_id = $1 and deleted_at is null'
        into alloc using p_record;
    end if;
  exception when others then alloc := 0;
  end;
  if p_paid then
    update public.payroll_records pr set
      amount_paid = round(least(coalesce(pr.net_pay, 0), amt + alloc), 2),
      balance_outstanding = round(greatest(coalesce(pr.net_pay, 0) - least(coalesce(pr.net_pay, 0), amt + alloc), 0), 2),
      paid_date = coalesce(p_date, current_date),
      pay_ref = left(nullif(btrim(coalesce(p_ref, '')), ''), 120)
    where pr.id = p_record and pr.tenant_id = p_tenant;
  else
    update public.payroll_records pr set
      amount_paid = round(least(coalesce(pr.net_pay, 0), alloc), 2),
      balance_outstanding = round(greatest(coalesce(pr.net_pay, 0) - alloc, 0), 2),
      paid_date = null, pay_ref = null
    where pr.id = p_record and pr.tenant_id = p_tenant;
  end if;
end;
$$;

create or replace function public.payroll__pvd_line_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  bref text;
begin
  if new.source is distinct from 'sd' or new.source_ref is null then return new; end if;
  if tg_op = 'UPDATE' and new.pay_status is not distinct from old.pay_status and new.paid_date is not distinct from old.paid_date
     and new.pay_ref is not distinct from old.pay_ref and new.amount is not distinct from old.amount then return new; end if;
  if new.pay_status = 'paid' then
    select ref_no into bref from public.payment_voucher_batches where id = new.batch_id;
    perform public.payroll__apply_sd_paid(new.source_ref, new.tenant_id, true, new.amount, new.paid_date, coalesce(nullif(btrim(new.pay_ref), ''), bref));
  elsif tg_op = 'UPDATE' and old.pay_status = 'paid' then
    perform public.payroll__apply_sd_paid(new.source_ref, new.tenant_id, false, 0, null, null);
  end if;
  return new;
exception when others then
  raise warning 'payroll__pvd_line_sync skipped: %', sqlerrm;  -- never block a PVD payment update
  return new;
end;
$$;
drop trigger if exists payroll_pvd_line_sync_trg on public.payment_voucher_batch_lines;
create trigger payroll_pvd_line_sync_trg after insert or update of pay_status, paid_date, pay_ref, amount on public.payment_voucher_batch_lines
  for each row execute function public.payroll__pvd_line_sync();

-- PV converted from an SD PVD line (batch_line_id) marked paid / un-paid -> same sync.
create or replace function public.payroll__pv_sd_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  l record;
begin
  if new.batch_line_id is null or new.status is not distinct from old.status then return new; end if;
  if new.status <> 'paid' and old.status is distinct from 'paid' then return new; end if;
  select bl.source, bl.source_ref, bl.tenant_id, bl.pay_status into l from public.payment_voucher_batch_lines bl where bl.id = new.batch_line_id;
  if not found or l.source is distinct from 'sd' or l.source_ref is null then return new; end if;
  if new.status = 'paid' then
    perform public.payroll__apply_sd_paid(l.source_ref, l.tenant_id, true, new.amount, coalesce(new.voucher_date, current_date), new.ref_no);
  elsif l.pay_status is distinct from 'paid' then
    perform public.payroll__apply_sd_paid(l.source_ref, l.tenant_id, false, 0, null, null);
  end if;
  return new;
exception when others then
  raise warning 'payroll__pv_sd_sync skipped: %', sqlerrm;
  return new;
end;
$$;
drop trigger if exists payroll_pv_sd_sync_trg on public.payment_vouchers;
create trigger payroll_pv_sd_sync_trg after update of status on public.payment_vouchers
  for each row execute function public.payroll__pv_sd_sync();

-- ---------- 5) RPCs ----------
-- Bulk "Mark as paid" for a month. Only when that month's SD batch is approved.
-- Skips rows already settled through an SD-sourced PVD line and rows with nothing outstanding.
create or replace function public.payroll_recon_mark_paid(p_month int, p_year int, p_paid_date date, p_ref text, p_ids uuid[] default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tid uuid := public.get_my_tenant_id();
  n int := 0;
begin
  if auth.uid() is null or tid is null then raise exception 'Not signed in'; end if;
  if not public.payroll__is_hr(tid) then raise exception 'HR managers only'; end if;
  if p_month not between 1 and 12 or p_year not between 2000 and 2100 then raise exception 'Invalid period'; end if;
  if not exists (select 1 from public.salary_disbursement_batches b where b.tenant_id = tid and b.month = p_month and b.year = p_year
                 and b.deleted_at is null and b.status = 'approved') then
    raise exception 'Salary disbursement for this month is not approved yet';
  end if;
  update public.payroll_records pr set
    amount_paid = coalesce(pr.net_pay, 0), balance_outstanding = 0,
    paid_date = coalesce(p_paid_date, current_date), pay_ref = left(nullif(btrim(coalesce(p_ref, '')), ''), 120)
  where pr.tenant_id = tid and pr.month = p_month and pr.year = p_year
    and (p_ids is null or pr.id = any(p_ids))
    and coalesce(pr.balance_outstanding, 0) > 0.01
    and not exists (select 1 from public.payment_voucher_batch_lines l join public.payment_voucher_batches pb on pb.id = l.batch_id
                    where l.source = 'sd' and l.source_ref = pr.id and pb.deleted_at is null);
  get diagnostics n = row_count;
  return jsonb_build_object('updated', n,
    'remaining', (select count(*) from public.payroll_records pr where pr.tenant_id = tid and pr.month = p_month and pr.year = p_year
                  and coalesce(pr.balance_outstanding, 0) > 0.01));
end;
$$;

-- Per-employee partial / full payment against one payroll record.
create or replace function public.payroll_recon_record_payment(p_record uuid, p_amount numeric, p_paid_date date, p_ref text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tid uuid := public.get_my_tenant_id();
  r public.payroll_records%rowtype;
  amt numeric := round(coalesce(p_amount, 0), 2);
  newpaid numeric;
begin
  if auth.uid() is null or tid is null then raise exception 'Not signed in'; end if;
  if not public.payroll__is_hr(tid) then raise exception 'HR managers only'; end if;
  select * into r from public.payroll_records where id = p_record and tenant_id = tid for update;
  if not found then raise exception 'Payroll record not found'; end if;
  if amt <= 0 then raise exception 'Amount must be more than 0'; end if;
  if exists (select 1 from public.payment_voucher_batch_lines l join public.payment_voucher_batches pb on pb.id = l.batch_id
             where l.source = 'sd' and l.source_ref = r.id and pb.deleted_at is null) then
    raise exception 'This salary is paid through a PVD — record the payment there';
  end if;
  if amt > coalesce(r.balance_outstanding, 0) + 0.005 then raise exception 'Amount is more than the balance outstanding'; end if;
  newpaid := round(least(coalesce(r.net_pay, 0), coalesce(r.net_pay, 0) - coalesce(r.balance_outstanding, 0) + amt), 2);
  update public.payroll_records set amount_paid = newpaid, balance_outstanding = round(greatest(coalesce(net_pay, 0) - newpaid, 0), 2),
    paid_date = coalesce(p_paid_date, current_date), pay_ref = left(nullif(btrim(coalesce(p_ref, '')), ''), 120)
  where id = r.id;
  return jsonb_build_object('id', r.id, 'amount_paid', newpaid, 'balance_outstanding', round(greatest(coalesce(r.net_pay, 0) - newpaid, 0), 2));
end;
$$;

-- Statutory (KWSP / SOCSO / EIS / PCB) payment items for this tenant, with the period they cover.
-- Period = explicit period_month/period_year, else parsed from the description / title text; null when unknown.
create or replace function public.payroll_recon_statutory_items(p_since date default null)
returns table (kind text, id uuid, ref_no text, label text, amount numeric, paid boolean, paid_date date,
               period_month int, period_year int, explicit boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  tid uuid := public.get_my_tenant_id();
  since date := coalesce(p_since, current_date - 730);
begin
  if auth.uid() is null or tid is null then return; end if;
  return query
  with pv as (
    select 'pv'::text k, v.id, v.ref_no, coalesce(nullif(v.description, ''), v.payee_name)::text lbl, coalesce(v.amount, 0)::numeric amt,
      (v.status = 'paid') pd, v.voucher_date pdt, v.period_month pm, v.period_year py,
      public.payroll__text_period(coalesce(v.description, '') || ' ' || coalesce(v.payee_name, '')) tp
    from public.payment_vouchers v
    where v.tenant_id = tid and v.deleted_at is null and v.category = 'statutory' and v.batch_line_id is null
      and coalesce(v.voucher_date, v.created_at::date) >= since
  ), ln as (
    select 'pvd'::text k, l.id, b.ref_no, coalesce(nullif(l.description, ''), l.payee_name)::text lbl, coalesce(l.amount, 0)::numeric amt,
      (l.pay_status = 'paid' or exists (select 1 from public.payment_vouchers v2 where v2.batch_line_id = l.id and v2.deleted_at is null and v2.status = 'paid')) pd,
      l.paid_date pdt, l.period_month pm, l.period_year py,
      public.payroll__text_period(coalesce(l.description, '') || ' ' || coalesce(l.payee_name, '') || ' ' || coalesce(b.title, '')) tp
    from public.payment_voucher_batch_lines l join public.payment_voucher_batches b on b.id = l.batch_id
    where l.tenant_id = tid and b.deleted_at is null and l.category = 'statutory'
      and coalesce(b.batch_date, b.created_at::date) >= since
  )
  select x.k, x.id, x.ref_no, x.lbl, x.amt, x.pd, x.pdt,
    coalesce(x.pm, x.tp[1]), coalesce(x.py, x.tp[2]), (x.pm is not null and x.py is not null)
  from (select * from pv union all select * from ln) x
  order by coalesce(x.py, x.tp[2]) desc nulls last, coalesce(x.pm, x.tp[1]) desc nulls last, x.ref_no;
end;
$$;

-- HR sets the period a statutory PV / PVD line covers (used when the text has no month).
create or replace function public.payroll_recon_link_statutory(p_kind text, p_id uuid, p_month int, p_year int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tid uuid := public.get_my_tenant_id();
  n int := 0;
begin
  if auth.uid() is null or tid is null then raise exception 'Not signed in'; end if;
  if not public.payroll__is_hr(tid) then raise exception 'HR managers only'; end if;
  if (p_month is not null and p_month not between 1 and 12) or (p_year is not null and p_year not between 2000 and 2100) then raise exception 'Invalid period'; end if;
  perform set_config('mcore.pv_rpc', '1', true);
  if p_kind = 'pv' then
    update public.payment_vouchers set period_month = p_month, period_year = p_year where id = p_id and tenant_id = tid and category = 'statutory';
    get diagnostics n = row_count;
    update public.payment_voucher_batch_lines l set period_month = p_month, period_year = p_year
      from public.payment_vouchers v where v.id = p_id and v.tenant_id = tid and l.id = v.batch_line_id;
  elsif p_kind = 'pvd' then
    update public.payment_voucher_batch_lines set period_month = p_month, period_year = p_year where id = p_id and tenant_id = tid and category = 'statutory';
    get diagnostics n = row_count;
    update public.payment_vouchers set period_month = p_month, period_year = p_year where batch_line_id = p_id and tenant_id = tid;
  else
    raise exception 'Unknown kind';
  end if;
  if n = 0 then raise exception 'Statutory item not found'; end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- Once-a-month bell to HR managers: counts only, no amounts. Marker table makes it once per tenant per month.
create table if not exists public.payroll_recon_reminders (
  tenant_id uuid not null,
  period text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (tenant_id, period)
);
alter table public.payroll_recon_reminders enable row level security;
revoke all on public.payroll_recon_reminders from anon;
drop policy if exists payroll_recon_reminders_read on public.payroll_recon_reminders;
create policy payroll_recon_reminders_read on public.payroll_recon_reminders for select to authenticated using (
  tenant_id = public.get_my_tenant_id() and deleted_at is null and public.payroll__is_hr(tenant_id));

create or replace function public.payroll_recon_monthly_remind()
returns int language plpgsql security definer set search_path = public as $$
declare
  tid uuid := public.get_my_tenant_id();
  now_my timestamp := (now() at time zone 'Asia/Kuala_Lumpur');
  per text := to_char(now() at time zone 'Asia/Kuala_Lumpur', 'YYYY-MM');
  cur int := extract(year from now_my)::int * 12 + extract(month from now_my)::int;
  staff int := 0;
  stat int := 0;
  k int := 0;
  en_m text := to_char(now_my, 'Mon YYYY');
  bm_m text := (array['Jan','Feb','Mac','Apr','Mei','Jun','Jul','Ogo','Sep','Okt','Nov','Dis'])[extract(month from now_my)::int] || ' ' || extract(year from now_my)::int;
begin
  if auth.uid() is null or tid is null then return 0; end if;
  if not public.payroll__is_hr(tid) then return 0; end if;
  insert into public.payroll_recon_reminders (tenant_id, period) values (tid, per) on conflict do nothing;
  get diagnostics k = row_count;
  if k = 0 then return 0; end if;
  select count(distinct pr.employee_id) into staff from public.payroll_records pr
    where pr.tenant_id = tid and coalesce(pr.balance_outstanding, 0) > 0.01 and (pr.year * 12 + pr.month) < cur;
  select count(*) into stat from (
    select pr.month, pr.year from public.payroll_records pr
    where pr.tenant_id = tid and (pr.year * 12 + pr.month) between cur - 3 and cur - 1
      and (coalesce(pr.epf_employee, 0) + coalesce(pr.socso_employee, 0) + coalesce(pr.eis_employee, 0) + coalesce(pr.pcb, 0)) > 0
    group by pr.month, pr.year
    having not exists (select 1 from public.payroll_recon_statutory_items(null) s
                       where s.paid and s.period_month = pr.month and s.period_year = pr.year)) z;
  if staff = 0 and stat = 0 then return 0; end if;
  begin
    insert into public.notifications (tenant_id, user_id, actor_id, title, body, category, kind, type, priority, link, ref_table, ref_id)
    select tid, u.id, null,
      case when u.language = 'bm' then 'Rekonsiliasi gaji · ' || bm_m else 'Payroll reconciliation · ' || en_m end,
      case when u.language = 'bm' then staff || ' staf ada baki tertunggak · ' || stat || ' bulan caruman berkanun belum diremit.'
        else staff || ' staff with outstanding pay · ' || stat || ' month(s) statutory not remitted.' end,
      'approval', 'for_you', 'approval.payroll', 0,
      jsonb_build_object('page', 'hr', 'params', jsonb_build_object('view', 'payroll-recon'), 'icon', 'ti-scale'),
      'payroll_recon_reminders', per
    from public.user_profiles u
    where u.tenant_id = tid and coalesce(u.is_active, true)
      and lower(coalesce(u.role, '')) in ('owner', 'admin', 'platform_admin', 'manager', 'hr');
    get diagnostics k = row_count;
  exception when others then
    raise warning 'payroll_recon_monthly_remind notify skipped: %', sqlerrm;
    k := 0;
  end;
  return k;
end;
$$;

-- ---------- 6) pv_import_sd: salary line = net pay + arrears instalment paid with it ----------
create or replace function public.pv_import_sd(p_sd_batch uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.salary_disbursement_batches%rowtype;
  me public.user_profiles%rowtype;
  bid uuid;
  n int;
  tot numeric;
  mon text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into me from public.user_profiles where id = auth.uid();
  select * into s from public.salary_disbursement_batches where id = p_sd_batch and deleted_at is null;
  if not found or s.tenant_id is distinct from public.get_my_tenant_id() then raise exception 'Salary disbursement not found'; end if;
  if not public.pv__can('vouchers') then raise exception 'No access to Payment Vouchers'; end if;
  if public.pv__view_only(s.tenant_id) then raise exception 'View-only support session'; end if;
  if s.status <> 'approved' then raise exception 'Salary disbursement is not approved yet'; end if;
  select id into bid from public.payment_voucher_batches where tenant_id = s.tenant_id and source = 'sd' and source_ref = s.id and deleted_at is null limit 1;
  if bid is not null then return jsonb_build_object('id', bid, 'existing', true); end if;
  mon := (array['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'])[s.month] || ' ' || s.year;
  insert into public.payment_voucher_batches (tenant_id, ref_no, batch_date, title, status, prepared_by, created_by, source, source_ref, created_at, updated_at)
  values (s.tenant_id, public.pv__next_ref(s.tenant_id, 'PVD'), current_date, 'Salary ' || mon, 'draft', me.full_name, auth.uid(), 'sd', s.id, now(), now())
  returning id into bid;
  insert into public.payment_voucher_batch_lines (tenant_id, batch_id, sort_order, payee_name, amount, payment_method, bank_name, bank_account_no,
    description, payee_type, payee_id, phone, category, source, source_ref)
  select s.tenant_id, bid, row_number() over (order by e.name), e.name, coalesce(pr.net_pay, 0) + coalesce(pr.arrears_paid, 0), 'Bank Transfer', e.bank_name, e.bank_account_no,
    'Salary ' || mon || case when coalesce(pr.arrears_paid, 0) > 0 then ' + arrears' else '' end, 'employee', e.id, e.phone, 'salary', 'sd', pr.id
  from public.payroll_records pr join public.employees e on e.id = pr.employee_id
  where pr.tenant_id = s.tenant_id and pr.month = s.month and pr.year = s.year and coalesce(pr.net_pay, 0) + coalesce(pr.arrears_paid, 0) > 0;
  get diagnostics n = row_count;
  select coalesce(sum(amount), 0) into tot from public.payment_voucher_batch_lines where batch_id = bid;
  update public.payment_voucher_batches set total_amount = tot, line_count = n where id = bid;
  return jsonb_build_object('id', bid, 'existing', false, 'lines', n);
end;
$$;

revoke all on function public.payroll__is_hr(uuid) from public, anon;
revoke all on function public.payroll__apply_sd_paid(uuid, uuid, boolean, numeric, date, text) from public, anon, authenticated;
revoke all on function public.payroll_recon_mark_paid(int, int, date, text, uuid[]) from public, anon;
revoke all on function public.payroll_recon_record_payment(uuid, numeric, date, text) from public, anon;
revoke all on function public.payroll_recon_statutory_items(date) from public, anon;
revoke all on function public.payroll_recon_link_statutory(text, uuid, int, int) from public, anon;
revoke all on function public.payroll_recon_monthly_remind() from public, anon;
grant execute on function public.payroll__is_hr(uuid) to authenticated;
grant execute on function public.payroll__text_period(text) to authenticated;
grant execute on function public.payroll_recon_mark_paid(int, int, date, text, uuid[]) to authenticated;
grant execute on function public.payroll_recon_record_payment(uuid, numeric, date, text) to authenticated;
grant execute on function public.payroll_recon_statutory_items(date) to authenticated;
grant execute on function public.payroll_recon_link_statutory(text, uuid, int, int) to authenticated;
grant execute on function public.payroll_recon_monthly_remind() to authenticated;

notify pgrst, 'reload schema';
