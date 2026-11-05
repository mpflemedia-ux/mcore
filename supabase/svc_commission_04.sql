-- M-Core — Service commission → one Payment Voucher (full part-time pay).
-- svc_commission_04.sql — WRITE-ONLY: Mike runs this in Supabase SQL editor AFTER svc_commission_03.sql
--   AND after pv_revamp_01.sql (needs payment_vouchers + pv__next_ref). Rerun-safe (idempotent), guarded.
--
-- What changes:
--   svc_comm_settings.pay_via_pv   flag "Bayar via PV" — when true, approved commission does NOT flow into
--                                 Salary Disbursement (_scCommissionTotal skip in app).
--   payment_vouchers.source_ref   uuid link back to svc_comm_months.id (batches already had it; single PV did not).
--   unique index payment_vouchers_svc_src_uq  one live PV per svc month (source='svc').
--   svc_create_pv(emp, month, year)  HR creates ONE draft PV for that employee-month:
--     amount = employees.basic_salary + svc_comm_months.commission_total  (= slip Total)
--     description multiline: Gaji asas / Komisen servis / Komisen produk / Bonus + Tempoh
--     category = 'other' (NOT salary — salary category skips journal on some paths)
--     source='svc', source_ref=svc_comm_months.id, payee_type=employee, bank/phone from employee
--     also forces pay_via_pv=true on the scheme so SD cannot double-pay
-- Unchanged: approve/reopen/sign flow, amounts, public-svc.html.
-- Seed / data: none. Existing months stay as-is until HR clicks Buat PV.

begin;

select 1 / (case when to_regclass('public.svc_comm_months') is null then 0 else 1 end) as svc_commission_01_present;
select 1 / (case when to_regclass('public.svc_signatures') is null then 0 else 1 end) as svc_commission_02_present;
select 1 / (case when to_regprocedure('public.svc_sign_names(uuid,integer,integer,text,text)') is null then 0 else 1 end) as svc_commission_03_present;
select 1 / (case when to_regclass('public.payment_vouchers') is null then 0 else 1 end) as payment_vouchers_present;
select 1 / (case when to_regprocedure('public.pv__next_ref(uuid,text)') is null then 0 else 1 end) as pv_next_ref_present;

-- ---------- 1) scheme flag ----------
alter table public.svc_comm_settings
  add column if not exists pay_via_pv boolean not null default false;

-- ---------- 2) single-PV source link (batches already have source_ref; vouchers only had source) ----------
alter table public.payment_vouchers
  add column if not exists source_ref uuid;

create unique index if not exists payment_vouchers_svc_src_uq
  on public.payment_vouchers (tenant_id, source_ref)
  where source = 'svc' and deleted_at is null;

-- ---------- 3) create PV from approved svc month ----------
create or replace function public.svc_create_pv(p_emp uuid, p_month int, p_year int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tid uuid := public.svc__my_tenant();
  me public.user_profiles%rowtype;
  m public.svc_comm_months%rowtype;
  e public.employees%rowtype;
  vid uuid;
  vref text;
  basic numeric(12,2) := 0;
  svc_c numeric(12,2) := 0;
  prod_c numeric(12,2) := 0;
  bon_c numeric(12,2) := 0;
  tot numeric(12,2) := 0;
  mon text;
  desc_txt text;
  existing boolean := false;
begin
  if auth.uid() is null or tid is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  if p_month is null or p_month not between 1 and 12 or p_year is null or p_year not between 2000 and 2100 then
    raise exception 'Invalid period' using errcode = '22023';
  end if;
  if not public.svc__is_hr(tid) then raise exception 'Only HR managers can create the payment voucher' using errcode = '42501'; end if;
  if to_regprocedure('public.pv__can(text)') is not null then
    if not public.pv__can('vouchers') then raise exception 'No access to Payment Vouchers' using errcode = '42501'; end if;
  end if;
  if to_regprocedure('public.pv__view_only(uuid)') is not null then
    if public.pv__view_only(tid) then raise exception 'View-only support session' using errcode = '42501'; end if;
  end if;

  select * into me from public.user_profiles where id = auth.uid();
  select * into m from public.svc_comm_months
    where tenant_id = tid and employee_id = p_emp and month = p_month and year = p_year and deleted_at is null;
  if not found then raise exception 'Service commission month not found' using errcode = 'P0002'; end if;
  if m.status is distinct from 'approved' then raise exception 'Approve the month first' using errcode = 'P0001'; end if;

  select id, ref_no into vid, vref from public.payment_vouchers
    where tenant_id = tid and source = 'svc' and source_ref = m.id and deleted_at is null
    limit 1;
  if vid is not null then
    return jsonb_build_object('id', vid, 'ref_no', vref, 'existing', true, 'month_id', m.id, 'amount', null);
  end if;

  select * into e from public.employees where id = p_emp and tenant_id = tid;
  if not found then raise exception 'Employee not found' using errcode = 'P0002'; end if;

  basic := coalesce(e.basic_salary, 0);
  svc_c := coalesce(m.svc_commission, 0);
  prod_c := coalesce(m.prod_commission, 0);
  bon_c := coalesce(m.bonus, 0);
  tot := round(basic + coalesce(m.commission_total, svc_c + prod_c + bon_c), 2);
  if tot <= 0 then raise exception 'Amount must be greater than 0' using errcode = '22023'; end if;

  mon := (array['Jan','Feb','Mac','Apr','Mei','Jun','Jul','Ogo','Sep','Okt','Nov','Dis'])[p_month] || ' ' || p_year;
  desc_txt :=
    'Gaji asas: RM ' || to_char(basic, 'FM999999990.00') || E'\n' ||
    'Komisen servis: RM ' || to_char(svc_c, 'FM999999990.00') || E'\n' ||
    'Komisen produk: RM ' || to_char(prod_c, 'FM999999990.00') || E'\n' ||
    'Bonus conversion: RM ' || to_char(bon_c, 'FM999999990.00') || E'\n' ||
    'Tempoh: ' || mon;

  insert into public.payment_vouchers (
    tenant_id, ref_no, voucher_date, payee_name, payee_type, payee_id,
    amount, payment_method, bank_name, bank_account_no, phone,
    description, status, prepared_by, created_by, category, source, source_ref,
    created_at, updated_at
  ) values (
    tid,
    public.pv__next_ref(tid, 'PV'),
    make_date(p_year, p_month, 1),
    e.name,
    'employee',
    e.id,
    tot,
    'Bank Transfer',
    e.bank_name,
    e.bank_account_no,
    e.phone,
    desc_txt,
    'draft',
    coalesce(nullif(btrim(me.full_name), ''), 'HR'),
    auth.uid(),
    'other',
    'svc',
    m.id,
    now(),
    now()
  )
  returning id, ref_no into vid, vref;

  -- force flag so SD hook skips this employee (even if HR forgot the checkbox)
  update public.svc_comm_settings
    set pay_via_pv = true, updated_by = auth.uid(), updated_at = now()
    where tenant_id = tid and employee_id = p_emp and deleted_at is null;

  -- if no scheme row yet, create a minimal one with the flag (defaults match svc_commission_01)
  if not found then
    insert into public.svc_comm_settings (tenant_id, employee_id, enabled, pay_via_pv, created_by)
    values (tid, p_emp, true, true, auth.uid())
    on conflict (tenant_id, employee_id) do update
      set pay_via_pv = true, deleted_at = null, updated_by = auth.uid(), updated_at = now();
  end if;

  return jsonb_build_object(
    'id', vid, 'ref_no', vref, 'existing', false, 'month_id', m.id, 'amount', tot,
    'basic', basic, 'svc_commission', svc_c, 'prod_commission', prod_c, 'bonus', bon_c
  );
end;
$$;

revoke all on function public.svc_create_pv(uuid, int, int) from public, anon;
grant execute on function public.svc_create_pv(uuid, int, int) to authenticated;

-- ---------- 4) soft helper: look up existing PV for a month (app can also select directly) ----------
create or replace function public.svc_pv_for_month(p_emp uuid, p_month int, p_year int)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  tid uuid := public.svc__my_tenant();
  mid uuid;
  r record;
begin
  if auth.uid() is null or tid is null then return null; end if;
  if not public.svc__is_hr(tid) and not public.svc__is_me(tid, p_emp) then return null; end if;
  select id into mid from public.svc_comm_months
    where tenant_id = tid and employee_id = p_emp and month = p_month and year = p_year and deleted_at is null;
  if mid is null then return null; end if;
  select v.id, v.ref_no, v.amount, v.status into r
    from public.payment_vouchers v
    where v.tenant_id = tid and v.source = 'svc' and v.source_ref = mid and v.deleted_at is null
    limit 1;
  if not found then return null; end if;
  return jsonb_build_object('id', r.id, 'ref_no', r.ref_no, 'amount', r.amount, 'status', r.status, 'month_id', mid);
end;
$$;

revoke all on function public.svc_pv_for_month(uuid, int, int) from public, anon;
grant execute on function public.svc_pv_for_month(uuid, int, int) to authenticated;

-- ---------- 5) roadmap ----------
update public.dev_roadmap_items set stage = 'completed', module = 'hr',
  description = 'After Service Commission month is Approved, HR can create ONE Payment Voucher (Buat PV) for the employee''s full part-time pay (basic + service commission + product commission + conversion bonus = slip Total). PV category=other, source=svc, unique per emp-month. Scheme flag Bayar via PV skips SD payroll so there is no double pay.'
where title = 'Service commission: pay via Payment Voucher (Buat PV)';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Service commission: pay via Payment Voucher (Buat PV)',
  'After Service Commission month is Approved, HR can create ONE Payment Voucher (Buat PV) for the employee''s full part-time pay (basic + service commission + product commission + conversion bonus = slip Total). PV category=other, source=svc, unique per emp-month. Scheme flag Bayar via PV skips SD payroll so there is no double pay.',
  'hr', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Service commission: pay via Payment Voucher (Buat PV)');

commit;

notify pgrst, 'reload schema';

-- ---------- checks (read-only) ----------
select (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'svc_comm_settings' and column_name = 'pay_via_pv') as pay_via_pv_col,
       (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'payment_vouchers' and column_name = 'source_ref') as pv_source_ref_col,
       to_regprocedure('public.svc_create_pv(uuid,integer,integer)') is not null as svc_create_pv_fn,
       to_regprocedure('public.svc_pv_for_month(uuid,integer,integer)') is not null as svc_pv_for_month_fn,
       (select stage from public.dev_roadmap_items where title = 'Service commission: pay via Payment Voucher (Buat PV)' limit 1) as roadmap_stage;
