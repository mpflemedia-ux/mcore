-- Programme Lead -> Sales -> Payment · Phase 6-7: confirmation, balance invoice + reminders, weekly settlement
-- WRITE-ONLY: run after prog_lsp_04_invoice_payment.sql. Rerun-safe.

-- 1) confirmation letter templates (written by the organiser; placeholders {payer} {pax} {programme} {dates} {ref})
alter table public.prog_programmes add column if not exists confirm_letter_en text;
alter table public.prog_programmes add column if not exists confirm_letter_bm text;

-- 2) balance invoice: only after the deposit is fully paid, due on the programme balance date
create or replace function public.prog_issue_balance(p_enrolment uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare e public.prog_enrolments%rowtype; pg public.prog_programmes%rowtype; di public.invoices%rowtype; v_amt numeric; v_inv uuid;
begin
  select * into e from public.prog_enrolments where id = p_enrolment and deleted_at is null for update;
  if not found then raise exception 'enrolment not found'; end if;
  perform public.prog__guard(e.tenant_id, 'sales');
  if e.cancelled_at is not null then raise exception 'enrolment cancelled'; end if;
  if e.funding = 'hrdcorp' then raise exception 'HRD Corp enrolments have one invoice'; end if;
  if e.balance_invoice_id is not null then raise exception 'balance invoice already issued'; end if;
  select * into di from public.invoices where id = e.deposit_invoice_id and tenant_id = e.tenant_id;
  if not found then raise exception 'deposit invoice not issued'; end if;
  if coalesce(di.paid_amt, 0) < coalesce(di.total, 0) - 0.005 then raise exception 'deposit not paid'; end if;
  v_amt := round(coalesce(e.fee_total, 0) - coalesce(e.deposit_total, 0), 2);
  if v_amt <= 0 then raise exception 'no balance'; end if;
  select * into pg from public.prog_programmes where id = e.programme_id;
  if pg.balance_due_on is null then raise exception 'balance due date not set'; end if;
  v_inv := public.prog__make_invoice(e, pg, v_amt, pg.balance_due_on, 'Balance (' || e.pax || ' pax)');
  update public.prog_enrolments set balance_invoice_id = v_inv, updated_at = now() where id = e.id;
  return jsonb_build_object('ok', true, 'invoice_id', v_inv, 'amount', v_amt);
end;
$fn$;
revoke all on function public.prog_issue_balance(uuid) from public;
grant execute on function public.prog_issue_balance(uuid) to authenticated;

-- 3) daily 09:05 MYT: balance invoice unpaid and due in 14 / 7 / 3 days -> owner/admin alert with invoice deep link
create or replace function public.prog_cron_balance_remind()
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare n int := 0; v_today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
begin
  with due as (
    select e.tenant_id, e.payer_name, i.id as invoice_id, i.ref_no, i.total - coalesce(i.paid_amt, 0) as bal, i.due_date - v_today as days
    from public.prog_enrolments e
    join public.invoices i on i.id = e.balance_invoice_id and i.tenant_id = e.tenant_id
    where e.deleted_at is null and e.cancelled_at is null and i.deleted_at is null
      and i.status in ('unpaid', 'partial') and i.due_date - v_today in (14, 7, 3)
  ), ins as (
    insert into public.notifications (tenant_id, user_id, title, body, category, kind, type, priority, link, ref_table, ref_id)
    select d.tenant_id, u.id,
      case when u.language = 'bm' then 'Baki program perlu dibayar dalam ' || d.days || ' hari: ' || d.ref_no
           else 'Programme balance due in ' || d.days || ' days: ' || d.ref_no end,
      concat_ws(' · ', d.payer_name, 'RM ' || to_char(d.bal, 'FM999,999,990.00')),
      'sales', 'action', 'sales.programme_balance_due', case when d.days <= 3 then 2 else 1 end,
      jsonb_build_object('page', 'sales', 'params', jsonb_build_object('view', 'inv-detail', 'id', d.invoice_id::text)),
      'invoices', d.invoice_id::text
    from due d
    join public.user_profiles u on u.tenant_id = d.tenant_id and coalesce(u.is_active, true)
     and lower(coalesce(u.role, '')) in ('owner', 'admin')
    returning 1
  )
  select count(*) into n from ins;
  return n;
end;
$fn$;
revoke all on function public.prog_cron_balance_remind() from public;

-- 4) settlement: collection agent -> programme tenant, weekly. One allocation can be settled once only.
create table if not exists public.prog_settlements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  programme_id uuid not null references public.prog_programmes(id),
  period_to date not null,
  amount numeric(14,2) not null check (amount > 0),
  settled_on date not null,
  bank_ref text check (bank_ref is null or length(bank_ref) <= 80),
  note text check (note is null or length(note) <= 500),
  created_by uuid,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table if not exists public.prog_settlement_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  settlement_id uuid not null references public.prog_settlements(id),
  allocation_id uuid not null,
  invoice_id uuid not null,
  payment_id uuid,
  amount numeric(14,2) not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists prog_settlement_items_alloc_uidx on public.prog_settlement_items (allocation_id) where deleted_at is null;
create index if not exists prog_settlements_prog_idx on public.prog_settlements (tenant_id, programme_id) where deleted_at is null;

alter table public.prog_settlements enable row level security;
alter table public.prog_settlement_items enable row level security;
do $pol$
declare t text;
begin
  foreach t in array array['prog_settlements','prog_settlement_items'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (tenant_id = public.get_my_tenant_id())', t || '_select', t);
    execute format('drop policy if exists platform_admin_all on public.%I', t);
    execute format('create policy platform_admin_all on public.%I for all to authenticated using (public.prog__is_pa()) with check (public.prog__is_pa())', t);
  end loop;
end $pol$;
-- writes only through prog_settle (no insert/update policy for normal users)

-- payments received through the agent account and not yet settled (per invoice allocation, not per payment → no double count)
create or replace function public.prog_unsettled(p_programme uuid, p_to date default null)
returns table (allocation_id uuid, invoice_id uuid, invoice_ref text, payer_name text, payment_id uuid, payment_date date, payment_method text, payment_ref text, amount numeric)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare pg public.prog_programmes%rowtype;
begin
  select * into pg from public.prog_programmes where id = p_programme and deleted_at is null;
  if not found then raise exception 'programme not found'; end if;
  perform public.prog__guard(pg.tenant_id, 'sales');
  return query
  select a.id, i.id, i.ref_no, e.payer_name, p.id, p.payment_date, p.payment_method, p.ref_no, a.amount::numeric
  from public.prog_enrolments e
  join public.invoices i on i.tenant_id = e.tenant_id and i.id in (e.deposit_invoice_id, e.balance_invoice_id)
  join public.payment_allocations a on a.invoice_id = i.id and a.tenant_id = e.tenant_id
  left join public.payments p on p.id = a.payment_id and p.tenant_id = e.tenant_id
  where e.programme_id = pg.id and e.deleted_at is null and e.funding <> 'hrdcorp'
    and nullif(trim(coalesce(i.pay_account_number, '')), '') is not null
    and coalesce(a.amount, 0) > 0
    and (p_to is null or p.payment_date is null or p.payment_date <= p_to)
    and not exists (select 1 from public.prog_settlement_items s where s.allocation_id = a.id and s.deleted_at is null)
  order by p.payment_date nulls last, i.ref_no;
end;
$fn$;
revoke all on function public.prog_unsettled(uuid, date) from public;
grant execute on function public.prog_unsettled(uuid, date) to authenticated;

create or replace function public.prog_settle(p_programme uuid, p_to date, p_settled_on date, p_bank_ref text, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare pg public.prog_programmes%rowtype; v_id uuid; v_amt numeric; v_n int;
begin
  select * into pg from public.prog_programmes where id = p_programme and deleted_at is null for update;
  if not found then raise exception 'programme not found'; end if;
  perform public.prog__guard(pg.tenant_id, 'sales');
  if p_to is null or p_settled_on is null then raise exception 'dates required'; end if;
  select coalesce(sum(u.amount), 0), count(*) into v_amt, v_n from public.prog_unsettled(pg.id, p_to) u;
  if v_n = 0 or v_amt <= 0 then raise exception 'nothing to settle'; end if;
  insert into public.prog_settlements (tenant_id, programme_id, period_to, amount, settled_on, bank_ref, note, created_by)
  values (pg.tenant_id, pg.id, p_to, v_amt, p_settled_on, left(nullif(trim(coalesce(p_bank_ref, '')), ''), 80), left(nullif(trim(coalesce(p_note, '')), ''), 500), auth.uid())
  returning id into v_id;
  insert into public.prog_settlement_items (tenant_id, settlement_id, allocation_id, invoice_id, payment_id, amount)
  select pg.tenant_id, v_id, u.allocation_id, u.invoice_id, u.payment_id, u.amount from public.prog_unsettled(pg.id, p_to) u;
  return jsonb_build_object('ok', true, 'settlement_id', v_id, 'amount', v_amt, 'items', v_n);
end;
$fn$;
revoke all on function public.prog_settle(uuid, date, date, text, text) from public;
grant execute on function public.prog_settle(uuid, date, date, text, text) to authenticated;

-- 5) Friday 09:15 MYT: unsettled agent collections -> owner/admin alert
create or replace function public.prog_cron_settle_remind()
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare n int := 0;
begin
  with t as (
    select pg.tenant_id, pg.id as programme_id, pg.code, sum(a.amount) as amt, count(*) as cnt
    from public.prog_programmes pg
    join public.prog_enrolments e on e.programme_id = pg.id and e.deleted_at is null and e.funding <> 'hrdcorp'
    join public.invoices i on i.tenant_id = e.tenant_id and i.id in (e.deposit_invoice_id, e.balance_invoice_id)
      and nullif(trim(coalesce(i.pay_account_number, '')), '') is not null
    join public.payment_allocations a on a.invoice_id = i.id and a.tenant_id = e.tenant_id and coalesce(a.amount, 0) > 0
    where pg.deleted_at is null
      and not exists (select 1 from public.prog_settlement_items s where s.allocation_id = a.id and s.deleted_at is null)
    group by pg.tenant_id, pg.id, pg.code
  ), ins as (
    insert into public.notifications (tenant_id, user_id, title, body, category, kind, type, priority, link, ref_table, ref_id)
    select t.tenant_id, u.id,
      case when u.language = 'bm' then 'Settlement mingguan: ' || t.code else 'Weekly settlement: ' || t.code end,
      case when u.language = 'bm' then t.cnt || ' bayaran belum diserah · RM ' || to_char(t.amt, 'FM999,999,990.00')
           else t.cnt || ' payments not settled · RM ' || to_char(t.amt, 'FM999,999,990.00') end,
      'sales', 'action', 'sales.programme_settlement', 1,
      jsonb_build_object('page', 'crm', 'params', jsonb_build_object('view', 'programmes', 'tab', 'settle')),
      'prog_programmes', t.programme_id::text
    from t
    join public.user_profiles u on u.tenant_id = t.tenant_id and coalesce(u.is_active, true)
     and lower(coalesce(u.role, '')) in ('owner', 'admin')
    where t.amt > 0
    returning 1
  )
  select count(*) into n from ins;
  return n;
end;
$fn$;
revoke all on function public.prog_cron_settle_remind() from public;

select cron.unschedule(jobid) from cron.job where jobname in ('mcore-prog-balance', 'mcore-prog-settle');
select cron.schedule('mcore-prog-balance', '5 1 * * *', 'select public.prog_cron_balance_remind()');
select cron.schedule('mcore-prog-settle', '15 1 * * 5', 'select public.prog_cron_settle_remind()');

do $rd$
begin
  if exists (select 1 from public.dev_roadmap_items where title = 'Programme LSP · Phase 6-7: confirmation, balance, settlement') then
    update public.dev_roadmap_items set stage = 'completed', module = 'sales' where title = 'Programme LSP · Phase 6-7: confirmation, balance, settlement';
  else
    insert into public.dev_roadmap_items (title, description, module, stage)
    values ('Programme LSP · Phase 6-7: confirmation, balance, settlement',
      'Confirmation letter from organiser template (EN/BM placeholders) + ETA/insurance checklist per participant; balance invoice after deposit paid (due = programme balance date); daily D-14/D-7/D-3 balance alerts; weekly settlement of agent collections (per allocation, settled once) + Friday reminder.',
      'sales', 'completed');
  end if;
exception when undefined_column or undefined_table then raise notice 'dev_roadmap skip: %', sqlerrm;
end $rd$;

notify pgrst, 'reload schema';
