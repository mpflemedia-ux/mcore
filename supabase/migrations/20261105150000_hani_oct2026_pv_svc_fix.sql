-- Hani (Dayang Mahani Binti Haime) — Oct 2026 Payment Voucher, The Brozkey Club (TBC)
-- tenant_id e25d49e8-a982-4b25-a73b-088d97e4e8f4 · employee_id a46e233f-8574-4ca7-ac74-9c4fa6761cf6
-- svc_comm_months.id fff40bfb-ae25-49e0-905d-51314cbe21cd (Oct 2026)
--
-- What this fixes/restores (full audit — see chat summary for the row-by-row reconciliation
-- against OCT_RECORD_2.xlsx, which matches the task's 41 paid / 23 not-paid heads exactly):
--   1. svc_create_pv(): the "already has a PV" check matched ANY payment_vouchers row for the
--      month, including a VOIDED one (PV-0001 was voided but still blocked a new PV). Now
--      excludes status='void' — a genuinely new PV can be created after a void.
--   2. svc_comm_settings.eligible_status for Hani was 'M' (wrong — her scheme is NM-based,
--      5%/head capped RM10, leads TT/ADS/OTHER). Fixed to 'NM'.
--   3. All 64 of Hani's Oct 2026 svc_logs rows were soft-deleted (0 active). Restored exactly
--      as recorded in OCT_RECORD_2.xlsx (Week 1–5), which recomputes to 41 NM+lead+price heads,
--      RM216.50 service commission — matching the task spec exactly.
--   4. svc_comm_months for Oct 2026 had product_sales=0 (stale). Set to RM1,589.00 (Moisturizer
--      x7=455, Hairmask x4=356, Shampoo x2=178, Keratin x1=600) so product commission computes
--      to RM79.45 (5%). bonus_on stays false (KPI/conversion bonus denied per the task).
--
-- What this does NOT do: it does not create the Payment Voucher itself. svc_create_pv() (like
-- svc_comm_submit/approve) is SECURITY DEFINER but requires auth.uid() to resolve the tenant —
-- it can only run from a real logged-in app session, not from this SQL Editor. Preferred path
-- per the task: after running this file, Mike opens Service Commission → Hani → Oct 2026 in the
-- app (now showing 41 NM heads / RM216.50 service / RM79.45 product / RM900 basic = RM1,195.95),
-- clicks Submit → Approve (product sales RM1,589, bonus OFF) → Buat PV. That creates a real
-- draft PV (ref_no auto-generated, journal/notification wiring untouched). STEP 5 below then
-- enriches that PV's remarks with the bilingual Paid/Not-Paid breakdown — run it only after the
-- PV exists.
--
-- Idempotent, write-only — run in Supabase SQL Editor. Safe to re-run.

-- ================= STEP 1: svc_create_pv — exclude voided PVs from the dup check =================
create or replace function public.svc_create_pv(p_emp uuid, p_month integer, p_year integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
    where tenant_id = tid and source = 'svc' and source_ref = m.id and deleted_at is null and status <> 'void'
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

  update public.svc_comm_settings
    set pay_via_pv = true, updated_by = auth.uid(), updated_at = now()
    where tenant_id = tid and employee_id = p_emp and deleted_at is null;

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
$function$;

-- ================= STEP 2: Hani's scheme — eligible_status 'M' -> 'NM' =================
update public.svc_comm_settings
set eligible_status = 'NM', updated_at = now()
where tenant_id = 'e25d49e8-a982-4b25-a73b-088d97e4e8f4'
  and employee_id = 'a46e233f-8574-4ca7-ac74-9c4fa6761cf6'
  and deleted_at is null
  and eligible_status <> 'NM';

-- ================= STEP 3: restore Hani's Oct 2026 svc_logs (64 rows, from OCT_RECORD_2.xlsx) ====
do $$
begin
  if not exists (
    select 1 from public.svc_logs
    where tenant_id = 'e25d49e8-a982-4b25-a73b-088d97e4e8f4'
      and employee_id = 'a46e233f-8574-4ca7-ac74-9c4fa6761cf6'
      and log_date >= date '2026-10-01' and log_date < date '2026-11-01'
      and deleted_at is null
  ) then
    insert into public.svc_logs (tenant_id, employee_id, log_date, week_no, service, price, client_status, lead_source, source) values
    -- Week 1
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-03',1,'Haircut (Ewan)',25,'NM','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-03',1,'Keratin',349,'M','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-03',1,'Haircut',45,null,null,'seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-03',1,'Haircut',65,'NM','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-04',1,'Haircut',65,'NM','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-04',1,'Keratin',349,'NM','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-06',1,'Hairmask',99,'M','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-06',1,'Haircut',45,'M','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-06',1,'Haircut',45,'M','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-07',1,'Keratin',349,'M','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-07',1,'Haircut',45,null,null,'seed'),
    -- Week 2
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-08',2,'Haircut',45,'M','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-09',2,'Keratin',349,'NM','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-09',2,'Haircut',45,'M','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-10',2,'Haircut',65,'NM','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-10',2,'Haircut',65,'NM','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-11',2,'Haircut',65,'NM',null,'seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-11',2,'Haircut',65,'NM',null,'seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-13',2,'Haircut',65,'NM',null,'seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-13',2,'Scalp Treatment',559,'M',null,'seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-13',2,'Keratin',null,null,null,'seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-13',2,'Scalp Treatment',99,'M',null,'seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-13',2,'Haircut',65,'NM',null,'seed'),
    -- Week 3
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-14',3,'Haircut',65,'NM','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-14',3,'Haircut',65,'NM','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-15',3,'Styling',25,'M','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-16',3,'Haircut',65,'NM','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-17',3,'Haircut',65,'NM','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-17',3,'Haircut',65,'NM','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-17',3,'Keratin',349,'NM','ADS','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-18',3,'Haircut',65,'NM','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-18',3,'Haircut',45,'M','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-18',3,'Haircut',65,'NM','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-18',3,'Haircut',65,'NM','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-20',3,'Scalp Treatment',150,'NM','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-20',3,'Keratin',349,'NM','TT','seed'),
    -- Week 4
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-21',4,'Haircut',45,'M','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-21',4,'Haircut',65,'NM','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-21',4,'Scalp + Keratin',624,'NM','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-21',4,'Haircut',null,null,null,'seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-21',4,'Haircut',45,'M','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-22',4,'Haircut',65,'NM','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-22',4,'Haircut',65,'NM','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-22',4,'Haircut',45,'M','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-23',4,'Keratin',349,'NM','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-24',4,'Haircut',65,'NM','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-25',4,'Keratin',349,'NM','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-25',4,'Keratin',349,'NM','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-25',4,'Haircut',65,'NM','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-25',4,'Keratin',349,'NM','TT','seed'),
    -- Week 5
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-27',5,'Haircut',65,'NM','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-27',5,'Scalp Keratin',559,'M','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-28',5,'Haircut',65,'NM','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-28',5,'Haircut',65,'NM','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-28',5,'Haircut',65,'NM','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-29',5,'Keratin',499,'NM','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-29',5,'Haircut',65,'NM','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-30',5,'Haircut',65,'NM','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-30',5,'Haircut',65,'NM','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-30',5,'Haircut',65,'NM','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-31',5,'Keratin',499,'NM','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-31',5,'Haircut',65,'NM','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-31',5,'Keratin',499,'NM','TT','seed'),
    ('e25d49e8-a982-4b25-a73b-088d97e4e8f4','a46e233f-8574-4ca7-ac74-9c4fa6761cf6','2026-10-31',5,'Haircut',65,'NM','TT','seed');
  end if;
end $$;

-- ================= STEP 4: svc_comm_months — product sales for Oct 2026 =================
update public.svc_comm_months
set product_sales = 1589.00,
    product_note = 'Moisturizer x7 (RM455), Hairmask x4 (RM356), Shampoo x2 (RM178), Keratin x1 (RM600)',
    bonus_on = false,
    updated_at = now()
where id = 'fff40bfb-ae25-49e0-905d-51314cbe21cd'
  and tenant_id = 'e25d49e8-a982-4b25-a73b-088d97e4e8f4';

-- ================= STEP 5 (RUN LAST — only after Mike clicks "Buat PV" in the app) ===============
-- After Submit -> Approve (product sales RM1,589, bonus OFF) -> Buat PV creates the real draft PV,
-- this adds the bilingual Paid / Not-Paid breakdown to that PV's remarks (printed PDF shows it —
-- pv-print.js splits description on real newlines). Safe to re-run; scoped by source_ref so it
-- finds the PV without needing its ref_no.
update public.payment_vouchers
set description =
  'PAID / DIBAYAR — RM1,195.95' || E'\n' ||
  '- Basic / Gaji asas: RM900.00' || E'\n' ||
  '- Service commission (41 heads, 5%/head, cap RM10) / Komisen servis (41 kepala): RM216.50' || E'\n' ||
  '  1xRM25, 27xRM65, 1xRM150, 8xRM349(cap RM10), 3xRM499(cap RM10), 1xRM624(cap RM10)' || E'\n' ||
  '- Product commission (5% x RM1,589 net sales) / Komisen produk: RM79.45' || E'\n' ||
  '  Moisturizer x7=RM455, Hairmask x4=RM356, Shampoo x2=RM178, Keratin x1=RM600' || E'\n' ||
  E'\n' ||
  'NOT PAID / TIDAK DIBAYAR (informational, not in total) — RM199.90' || E'\n' ||
  '- Existing members (status M), 15 heads [s.4]: RM69.15' || E'\n' ||
  '- NM heads, no lead recorded (11/10 x2, 13/10 x2), 4 heads [s.5]: RM13.00' || E'\n' ||
  '- No status & no lead (03/10, 07/10 Haircut RM45), 2 heads [s.6]: RM4.50' || E'\n' ||
  '- No price recorded (13/10 Keratin, 21/10 Haircut), 2 heads [s.7(2)]: RM13.25' || E'\n' ||
  '- KPI/conversion bonus denied [s.7(6)]: RM100.00' || E'\n' ||
  '- Onsite allowance denied [s.7(8)]: RM0.00' || E'\n' ||
  E'\n' ||
  'Tempoh / Period: Oct 2026 · Part-time pay via PV (bukan Penyaluran Gaji — no double pay).',
  updated_at = now()
where tenant_id = 'e25d49e8-a982-4b25-a73b-088d97e4e8f4'
  and source = 'svc'
  and source_ref = 'fff40bfb-ae25-49e0-905d-51314cbe21cd'
  and status <> 'void'
  and deleted_at is null;

-- ================= roadmap =================
insert into dev_roadmap_items (id, title, description, module, stage, started_at, completed_at)
select gen_random_uuid(),
  'Service commission: fix voided-PV blocking new PV + eligible-status hint text',
  'svc_create_pv() ignored status=''void'' when checking for an existing PV for the month, so a genuinely new PV could never be created after a void (same fix applied client-side in svc-commission.js''s PV lookup). Separately, the scheme settings card''s hint text hardcoded "M heads ... earn nothing" regardless of the actual Eligible status dropdown value — now reflects whichever status is NOT the configured eligible_status.',
  'hr', 'completed', now(), now()
where not exists (
  select 1 from dev_roadmap_items where title = 'Service commission: fix voided-PV blocking new PV + eligible-status hint text'
);
