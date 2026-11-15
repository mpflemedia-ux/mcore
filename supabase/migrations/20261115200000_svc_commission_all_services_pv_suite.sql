-- M-Core — Service Commission: all-services scheme, itemised products, price/code list, PV for all staff + PVD,
-- commission-only PV description, receipt signature, close month, source file. (The Brozky Club rollout.)
-- WRITE-ONLY: Mike runs this in the Supabase SQL editor AFTER svc_commission_01..04 + pv_revamp_01 + pay_attach_01.
-- Rerun-safe (idempotent). No tenant data is touched here (Brozky data lives in 20261115200100_*).
--
-- A  svc_comm_settings.svc_all       "Commission on all services (no lead/cap conditions)": every row with price > 0 earns
--                                     price × svc_rate_pct, no status/lead flags, no cap. Off = old NM + TT/ADS + cap model (unchanged).
-- B  svc_product_logs                one row per product sold (date, code, name, qty, amount). product_sales = SUM(amount)
--                                     when the emp-month has items, else the old single svc_comm_months.product_sales number.
-- C  svc_price_codes                 per-tenant code list (code, name, kind service|product, default_price). svc_logs.code +
--                                     svc_product_logs.code are auto-filled from it (trigger). Rows without a code = "needs review"
--                                     (counted in calc.review, never blocked).
--    svc__calc                        twin of SVC.calc in app/svc-commission.js (A + B + review).
-- D  svc_create_pv(emp,m,y,p_desc)   commission_only scheme → basic 0; optional generated description (draft PVs refreshed).
--    svc_create_pvd(m,y,title,bm)    one PVD (payment_voucher_batches, source='svc', source_period 'YYYY-MM') listing every
--                                     live svc PV of that period; lines carry voucher_id, PVs get batch_id/batch_line_id so the
--                                     existing PV paid → PVD line sync works. Status 'converted' (PVs already exist → no Convert).
-- F  svc_signatures role 'received'  staff acknowledges receipt (WhatsApp link / app), needs Approved + a live PV.
-- H  svc_comm_months.closed_at        set when the month's svc PV is marked paid (trigger) → logs + product items locked
--                                     (trigger guard), Reopen blocked; Owner-only svc_comm_reopen_closed(…, reason).
-- I  doc_attachments entity 'svc_month' + doc-files/{tenant}/svc-source/… for the original source sheet.
-- G  (comparison with last month) is app-only (reads the previous svc_comm_months row).

begin;

select 1 / (case when to_regclass('public.svc_comm_months') is null then 0 else 1 end) as svc_commission_01_present;
select 1 / (case when to_regclass('public.svc_signatures') is null then 0 else 1 end) as svc_commission_02_present;
select 1 / (case when to_regclass('public.payment_vouchers') is null then 0 else 1 end) as payment_vouchers_present;
select 1 / (case when to_regclass('public.payment_voucher_batches') is null then 0 else 1 end) as pv_batches_present;

-- ---------- A) scheme flag ----------
alter table public.svc_comm_settings add column if not exists svc_all boolean not null default false;

-- ---------- C) code list ----------
create table if not exists public.svc_price_codes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  kind text not null default 'service',
  code text not null,
  name text,
  default_price numeric(12,2),
  created_by uuid default auth.uid(),
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint svc_price_codes_kind_ck check (kind in ('service', 'product')),
  constraint svc_price_codes_code_ck check (code ~ '^[A-Z0-9][A-Z0-9 ._/&+-]{0,23}$'),
  constraint svc_price_codes_name_ck check (name is null or length(btrim(name)) between 1 and 120),
  constraint svc_price_codes_price_ck check (default_price is null or default_price >= 0)
);
create unique index if not exists svc_price_codes_uq on public.svc_price_codes (tenant_id, kind, code) where deleted_at is null;

-- ---------- B) product items ----------
create table if not exists public.svc_product_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  employee_id uuid not null,
  log_date date not null,
  code text,
  name text,
  qty numeric(10,2) not null default 1,
  amount numeric(12,2) not null,
  notes text,
  source text not null default 'manual',
  created_by uuid default auth.uid(),
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint svc_product_logs_qty_ck check (qty > 0),
  constraint svc_product_logs_amt_ck check (amount >= 0),
  constraint svc_product_logs_code_ck check (code is null or length(code) between 1 and 24),
  constraint svc_product_logs_name_ck check (name is null or length(name) <= 120),
  constraint svc_product_logs_source_ck check (source in ('manual', 'import', 'seed'))
);
create index if not exists svc_product_logs_emp_date_ix on public.svc_product_logs (tenant_id, employee_id, log_date) where deleted_at is null;

alter table public.svc_logs add column if not exists code text;
do $$ begin
  alter table public.svc_logs add constraint svc_logs_code_ck check (code is null or length(code) between 1 and 24);
exception when duplicate_object then null; end $$;

-- ---------- H / I) month columns ----------
alter table public.svc_comm_months
  add column if not exists closed_at timestamptz,
  add column if not exists reopen_reason text,
  add column if not exists reopened_by uuid,
  add column if not exists reopened_at timestamptz;

-- one live PV per svc month: a VOIDED PV no longer blocks a new one (svc_create_pv already skips void rows)
drop index if exists public.payment_vouchers_svc_src_uq;
create unique index if not exists payment_vouchers_svc_src_uq on public.payment_vouchers (tenant_id, source_ref)
  where source = 'svc' and deleted_at is null and status <> 'void';

-- ---------- D) PVD period key ----------
alter table public.payment_voucher_batches add column if not exists source_period text;
create unique index if not exists pvd_batches_svc_period_uq on public.payment_voucher_batches (tenant_id, source_period)
  where source = 'svc' and deleted_at is null;

-- ---------- touch + normalise ----------
drop trigger if exists svc_price_codes_touch on public.svc_price_codes;
create trigger svc_price_codes_touch before update on public.svc_price_codes for each row execute function public.svc__touch();
drop trigger if exists svc_product_logs_touch on public.svc_product_logs;
create trigger svc_product_logs_touch before update on public.svc_product_logs for each row execute function public.svc__touch();

create or replace function public.svc__codes_norm()
returns trigger language plpgsql as $$
begin
  NEW.code := upper(btrim(NEW.code));
  NEW.name := nullif(btrim(coalesce(NEW.name, '')), '');
  return NEW;
end;
$$;
drop trigger if exists svc_price_codes_norm on public.svc_price_codes;
create trigger svc_price_codes_norm before insert or update on public.svc_price_codes for each row execute function public.svc__codes_norm();

-- svc_logs: same normalisation as before + code (upper) auto-filled when the service text IS a service code of the tenant
create or replace function public.svc__logs_norm()
returns trigger language plpgsql security definer set search_path = public as $$
declare v text;
begin
  NEW.service := btrim(NEW.service);
  NEW.client_status := nullif(upper(btrim(coalesce(NEW.client_status, ''))), '');
  NEW.lead_source := nullif(upper(btrim(coalesce(NEW.lead_source, ''))), '');
  NEW.code := nullif(upper(btrim(coalesce(NEW.code, ''))), '');
  if NEW.code is null then
    select c.code into v from public.svc_price_codes c
      where c.tenant_id = NEW.tenant_id and c.kind = 'service' and c.deleted_at is null and c.code = upper(btrim(NEW.service)) limit 1;
    NEW.code := v;
  end if;
  return NEW;
end;
$$;

create or replace function public.svc__prod_norm()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_code text; v_name text;
begin
  NEW.code := nullif(upper(btrim(coalesce(NEW.code, ''))), '');
  NEW.name := nullif(btrim(coalesce(NEW.name, '')), '');
  if NEW.code is null and NEW.name is not null then
    select c.code into v_code from public.svc_price_codes c
      where c.tenant_id = NEW.tenant_id and c.kind = 'product' and c.deleted_at is null
        and (c.code = upper(NEW.name) or lower(c.name) = lower(NEW.name)) limit 1;
    NEW.code := v_code;
  end if;
  if NEW.code is not null and NEW.name is null then
    select c.name into v_name from public.svc_price_codes c
      where c.tenant_id = NEW.tenant_id and c.kind = 'product' and c.deleted_at is null and c.code = NEW.code limit 1;
    NEW.name := v_name;
  end if;
  return NEW;
end;
$$;
drop trigger if exists svc_product_logs_norm on public.svc_product_logs;
create trigger svc_product_logs_norm before insert or update on public.svc_product_logs for each row execute function public.svc__prod_norm();

-- ---------- H) closed month guard (server side; also blocks service-role edits) ----------
create or replace function public.svc__month_closed(p_tid uuid, p_emp uuid, p_date date)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.svc_comm_months m where m.tenant_id = p_tid and m.employee_id = p_emp
    and m.year = extract(year from p_date)::int and m.month = extract(month from p_date)::int
    and m.closed_at is not null and m.deleted_at is null)
$$;
revoke all on function public.svc__month_closed(uuid, uuid, date) from public, anon;
grant execute on function public.svc__month_closed(uuid, uuid, date) to authenticated;

create or replace function public.svc__logs_closed_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP in ('UPDATE', 'DELETE') and public.svc__month_closed(OLD.tenant_id, OLD.employee_id, OLD.log_date) then
    raise exception 'Month is closed (PV paid). Owner must reopen it with a reason first.' using errcode = 'P0001';
  end if;
  if TG_OP in ('INSERT', 'UPDATE') and public.svc__month_closed(NEW.tenant_id, NEW.employee_id, NEW.log_date) then
    raise exception 'Month is closed (PV paid). Owner must reopen it with a reason first.' using errcode = 'P0001';
  end if;
  return coalesce(NEW, OLD);
end;
$$;
drop trigger if exists svc_logs_closed_guard on public.svc_logs;
create trigger svc_logs_closed_guard before insert or update or delete on public.svc_logs for each row execute function public.svc__logs_closed_guard();
drop trigger if exists svc_product_logs_closed_guard on public.svc_product_logs;
create trigger svc_product_logs_closed_guard before insert or update or delete on public.svc_product_logs for each row execute function public.svc__logs_closed_guard();

-- PV paid → close the month; PV paid → void (allowed roles only) → open again
create or replace function public.svc__pv_paid_close()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.source = 'svc' and NEW.source_ref is not null then
    begin
      if NEW.status = 'paid' and OLD.status is distinct from 'paid' then
        update public.svc_comm_months set closed_at = coalesce(closed_at, now())
          where id = NEW.source_ref and tenant_id = NEW.tenant_id and deleted_at is null;
      elsif OLD.status = 'paid' and NEW.status = 'void' then
        update public.svc_comm_months set closed_at = null
          where id = NEW.source_ref and tenant_id = NEW.tenant_id and deleted_at is null;
      end if;
    exception when others then raise warning 'svc__pv_paid_close: %', sqlerrm; end;
  end if;
  return NEW;
end;
$$;
revoke all on function public.svc__pv_paid_close() from public, anon, authenticated;
drop trigger if exists svc_pv_paid_close on public.payment_vouchers;
create trigger svc_pv_paid_close after update of status on public.payment_vouchers
  for each row when (NEW.source = 'svc') execute function public.svc__pv_paid_close();

-- backfill: months whose svc PV is already paid are closed now
update public.svc_comm_months m set closed_at = now()
where m.closed_at is null and m.deleted_at is null
  and exists (select 1 from public.payment_vouchers v where v.tenant_id = m.tenant_id and v.source = 'svc' and v.source_ref = m.id
              and v.status = 'paid' and v.deleted_at is null);

-- ---------- RLS (same rules as svc_logs / svc_comm_settings) ----------
alter table public.svc_price_codes enable row level security;
alter table public.svc_product_logs enable row level security;
revoke all on public.svc_price_codes, public.svc_product_logs from anon;
grant select, insert, update on public.svc_price_codes, public.svc_product_logs to authenticated;

drop policy if exists svc_pc_sel on public.svc_price_codes;
create policy svc_pc_sel on public.svc_price_codes for select to authenticated using (tenant_id = public.svc__my_tenant());
drop policy if exists svc_pc_ins on public.svc_price_codes;
create policy svc_pc_ins on public.svc_price_codes for insert to authenticated with check (tenant_id = public.svc__my_tenant() and public.svc__is_hr(tenant_id));
drop policy if exists svc_pc_upd on public.svc_price_codes;
create policy svc_pc_upd on public.svc_price_codes for update to authenticated
  using (tenant_id = public.svc__my_tenant() and public.svc__is_hr(tenant_id))
  with check (tenant_id = public.svc__my_tenant() and public.svc__is_hr(tenant_id));

-- product items: Owner/HR write (same as the old product sales box), staff read their own; locked once approved
drop policy if exists svc_pl_sel on public.svc_product_logs;
create policy svc_pl_sel on public.svc_product_logs for select to authenticated using (
  tenant_id = public.svc__my_tenant() and (public.svc__is_hr(tenant_id) or public.svc__is_me(tenant_id, employee_id)));
drop policy if exists svc_pl_ins on public.svc_product_logs;
create policy svc_pl_ins on public.svc_product_logs for insert to authenticated with check (
  tenant_id = public.svc__my_tenant() and public.svc__is_hr(tenant_id) and not public.svc__month_locked(tenant_id, employee_id, log_date));
drop policy if exists svc_pl_upd on public.svc_product_logs;
create policy svc_pl_upd on public.svc_product_logs for update to authenticated
  using (tenant_id = public.svc__my_tenant() and public.svc__is_hr(tenant_id) and not public.svc__month_locked(tenant_id, employee_id, log_date))
  with check (tenant_id = public.svc__my_tenant() and public.svc__is_hr(tenant_id) and not public.svc__month_locked(tenant_id, employee_id, log_date));

-- ---------- A + B) calc (twin of SVC.calc) ----------
-- svc_all: per row round(price × rate%, 2) when price > 0, no cap / status / lead; flags = no price / RM0; review = rows without a code
-- else  : unchanged (eligible head = status = eligible_status AND lead in eligible_leads AND price > 0, capped per head)
-- product_sales = SUM(svc_product_logs.amount) when items exist, else svc_comm_months.product_sales
create or replace function public.svc__calc(p_tid uuid, p_emp uuid, p_month int, p_year int)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  tid uuid := p_tid; s record; m record; mf boolean := false; d0 date; d1 date;
  heads int := 0; svc numeric := 0; flags int := 0; nrows int := 0; prod numeric := 0; bon numeric := 0; psales numeric := 0;
  r_rate numeric := 5; r_cap numeric := 10; r_st text := 'NM'; r_leads text[] := array['TT', 'ADS']; r_prod numeric := 5; r_bonus numeric := 100;
  r_all boolean := false; rev int := 0; n_items int := 0; s_items numeric := 0; rev_p int := 0;
begin
  if tid is null or p_emp is null then return null; end if;
  d0 := make_date(p_year, p_month, 1); d1 := (d0 + interval '1 month')::date;
  select * into s from public.svc_comm_settings x where x.tenant_id = tid and x.employee_id = p_emp and x.deleted_at is null;
  if found then r_rate := s.svc_rate_pct; r_cap := s.svc_cap; r_st := upper(s.eligible_status); r_leads := s.eligible_leads; r_prod := s.prod_rate_pct; r_bonus := s.bonus_amount; r_all := coalesce(s.svc_all, false); end if;
  if r_all then
    select count(*)::int,
           count(*) filter (where coalesce(l.price, 0) > 0)::int,
           coalesce(sum(case when coalesce(l.price, 0) > 0 then round(l.price * r_rate / 100, 2) end), 0),
           count(*) filter (where l.price is null or l.price = 0)::int,
           count(*) filter (where l.code is null)::int
      into nrows, heads, svc, flags, rev
    from public.svc_logs l
    where l.tenant_id = tid and l.employee_id = p_emp and l.deleted_at is null and l.log_date >= d0 and l.log_date < d1;
  else
    select count(*)::int,
           count(*) filter (where l.client_status = r_st and l.lead_source = any(r_leads) and coalesce(l.price, 0) > 0)::int,
           coalesce(sum(case when l.client_status = r_st and l.lead_source = any(r_leads) and coalesce(l.price, 0) > 0
                        then round(case when r_cap is null then l.price * r_rate / 100 else least(l.price * r_rate / 100, r_cap) end, 2) end), 0),
           count(*) filter (where l.price is null or l.price = 0 or l.client_status is null
                               or (l.client_status = r_st and (l.lead_source is null or not (l.lead_source = any(r_leads)))))::int
      into nrows, heads, svc, flags
    from public.svc_logs l
    where l.tenant_id = tid and l.employee_id = p_emp and l.deleted_at is null and l.log_date >= d0 and l.log_date < d1;
  end if;
  select count(*)::int, coalesce(sum(p.amount), 0), count(*) filter (where p.code is null and p.name is null)::int
    into n_items, s_items, rev_p
  from public.svc_product_logs p
  where p.tenant_id = tid and p.employee_id = p_emp and p.deleted_at is null and p.log_date >= d0 and p.log_date < d1;
  select * into m from public.svc_comm_months x where x.tenant_id = tid and x.employee_id = p_emp and x.year = p_year and x.month = p_month and x.deleted_at is null;
  mf := found;
  if n_items > 0 then psales := s_items; elsif mf then psales := coalesce(m.product_sales, 0); end if;
  prod := round(psales * r_prod / 100, 2);
  bon := case when mf and m.bonus_on then r_bonus else 0 end;
  return jsonb_build_object('rows', nrows, 'heads', heads, 'svc_commission', svc, 'flags', flags,
    'product_sales', psales, 'prod_commission', prod, 'bonus', bon,
    'commission_total', svc + prod + bon,
    'product_items', n_items, 'review', rev + rev_p, 'svc_all', r_all,
    'rates', jsonb_build_object('svc_rate_pct', r_rate, 'svc_cap', r_cap, 'eligible_status', r_st, 'eligible_leads', to_jsonb(r_leads),
                                'prod_rate_pct', r_prod, 'bonus_amount', r_bonus, 'svc_all', r_all));
end;
$$;
revoke all on function public.svc__calc(uuid, uuid, int, int) from public, anon, authenticated;

-- product_sales follows the items whenever items exist (submit + approve snapshot)
create or replace function public.svc__sync_psales(p_rid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m public.svc_comm_months%rowtype; n int; s numeric;
begin
  select * into m from public.svc_comm_months where id = p_rid;
  if not found then return; end if;
  select count(*), coalesce(sum(amount), 0) into n, s from public.svc_product_logs
   where tenant_id = m.tenant_id and employee_id = m.employee_id and deleted_at is null
     and log_date >= make_date(m.year, m.month, 1) and log_date < (make_date(m.year, m.month, 1) + interval '1 month')::date;
  if n > 0 then update public.svc_comm_months set product_sales = s where id = p_rid and product_sales is distinct from s; end if;
end;
$$;
revoke all on function public.svc__sync_psales(uuid) from public, anon, authenticated;

create or replace function public.svc_comm_submit(p_emp uuid, p_month int, p_year int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare tid uuid := public.svc__my_tenant(); rid uuid; st text; c jsonb;
begin
  if tid is null or not (public.svc__is_hr(tid) or public.svc__is_me(tid, p_emp)) then raise exception 'not allowed' using errcode = '42501'; end if;
  rid := public.svc__month_row(tid, p_emp, p_month, p_year);
  select status into st from public.svc_comm_months where id = rid;
  if st = 'approved' then raise exception 'month already approved' using errcode = 'P0001'; end if;
  perform public.svc__sync_psales(rid);
  c := public.svc__calc(tid, p_emp, p_month, p_year);
  update public.svc_comm_months set status = 'submitted', submitted_by = auth.uid(), submitted_at = now(),
    svc_heads = (c->>'heads')::int, svc_commission = (c->>'svc_commission')::numeric, prod_commission = (c->>'prod_commission')::numeric,
    bonus = (c->>'bonus')::numeric, commission_total = (c->>'commission_total')::numeric, flags = (c->>'flags')::int, rates = c->'rates'
  where id = rid;
  return c || jsonb_build_object('id', rid, 'status', 'submitted');
end;
$$;

create or replace function public.svc_comm_approve(p_emp uuid, p_month int, p_year int, p_product_sales numeric default null, p_bonus_on boolean default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare tid uuid := public.svc__my_tenant(); rid uuid; c jsonb;
begin
  if tid is null or not public.svc__is_hr(tid) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_product_sales is not null and p_product_sales < 0 then raise exception 'product sales must be >= 0' using errcode = '22023'; end if;
  rid := public.svc__month_row(tid, p_emp, p_month, p_year);
  update public.svc_comm_months set product_sales = coalesce(p_product_sales, product_sales), bonus_on = coalesce(p_bonus_on, bonus_on) where id = rid;
  perform public.svc__sync_psales(rid);  -- items win over the typed number
  c := public.svc__calc(tid, p_emp, p_month, p_year);
  update public.svc_comm_months set status = 'approved', approved_by = auth.uid(), approved_at = now(),
    svc_heads = (c->>'heads')::int, svc_commission = (c->>'svc_commission')::numeric, prod_commission = (c->>'prod_commission')::numeric,
    bonus = (c->>'bonus')::numeric, commission_total = (c->>'commission_total')::numeric, flags = (c->>'flags')::int, rates = c->'rates',
    closed_at = case when exists (select 1 from public.payment_vouchers v where v.tenant_id = tid and v.source = 'svc' and v.source_ref = rid
                                  and v.status = 'paid' and v.deleted_at is null) then now() else null end
  where id = rid;
  return c || jsonb_build_object('id', rid, 'status', 'approved');
end;
$$;

-- reopen: blocked once the month is closed (PV paid)
create or replace function public.svc_comm_reopen(p_emp uuid, p_month int, p_year int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare tid uuid := public.svc__my_tenant(); rid uuid;
begin
  if tid is null or not public.svc__is_hr(tid) then raise exception 'not allowed' using errcode = '42501'; end if;
  if exists (select 1 from public.svc_comm_months where tenant_id = tid and employee_id = p_emp and month = p_month and year = p_year
             and deleted_at is null and closed_at is not null) then
    raise exception 'Month is closed (PV paid). Owner must reopen it with a reason.' using errcode = 'P0001';
  end if;
  update public.svc_comm_months set status = 'draft', approved_by = null, approved_at = null
  where tenant_id = tid and employee_id = p_emp and month = p_month and year = p_year and deleted_at is null and status <> 'draft'
  returning id into rid;
  return jsonb_build_object('id', rid, 'status', 'draft');
end;
$$;

-- Owner only: reopen a CLOSED month with a reason (kept on the month row; the paid PV is not touched)
create or replace function public.svc_comm_reopen_closed(p_emp uuid, p_month int, p_year int, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare tid uuid := public.svc__my_tenant(); rid uuid; why text := left(btrim(coalesce(p_reason, '')), 500);
begin
  if tid is null or not public.svc__is_hr(tid) or not exists (select 1 from public.user_profiles u where u.id = auth.uid()
       and u.tenant_id = tid and lower(coalesce(u.role, '')) in ('owner', 'platform_admin')) then
    raise exception 'Only the Owner can reopen a closed month' using errcode = '42501';
  end if;
  if length(why) < 3 then raise exception 'Reason required' using errcode = '22023'; end if;
  update public.svc_comm_months set status = 'draft', approved_by = null, approved_at = null, closed_at = null,
    reopen_reason = why, reopened_by = auth.uid(), reopened_at = now()
  where tenant_id = tid and employee_id = p_emp and month = p_month and year = p_year and deleted_at is null
  returning id into rid;
  if rid is null then raise exception 'Service commission month not found' using errcode = 'P0002'; end if;
  return jsonb_build_object('id', rid, 'status', 'draft', 'reason', why);
end;
$$;
revoke all on function public.svc_comm_reopen_closed(uuid, int, int, text) from public, anon;
grant execute on function public.svc_comm_reopen_closed(uuid, int, int, text) to authenticated;

-- ---------- D) one PV per emp-month (commission_only → no basic; optional generated description) ----------
drop function if exists public.svc_create_pv(uuid, integer, integer);
create or replace function public.svc_create_pv(p_emp uuid, p_month int, p_year int, p_desc text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tid uuid := public.svc__my_tenant();
  me public.user_profiles%rowtype;
  m public.svc_comm_months%rowtype;
  e public.employees%rowtype;
  vid uuid; vref text; vst text;
  basic numeric(12,2) := 0; svc_c numeric(12,2) := 0; prod_c numeric(12,2) := 0; bon_c numeric(12,2) := 0; tot numeric(12,2) := 0;
  mon text; desc_txt text; comm_only boolean := false; d text := nullif(left(btrim(coalesce(p_desc, '')), 8000), '');
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

  select id, ref_no, status into vid, vref, vst from public.payment_vouchers
    where tenant_id = tid and source = 'svc' and source_ref = m.id and deleted_at is null and status <> 'void'
    limit 1;
  if vid is not null then
    if d is not null and vst = 'draft' then
      update public.payment_vouchers set description = d, updated_at = now() where id = vid and tenant_id = tid;
    end if;
    return jsonb_build_object('id', vid, 'ref_no', vref, 'existing', true, 'month_id', m.id, 'amount', null, 'status', vst);
  end if;

  select * into e from public.employees where id = p_emp and tenant_id = tid;
  if not found then raise exception 'Employee not found' using errcode = 'P0002'; end if;
  select coalesce(s.pay_basis = 'commission_only', false) into comm_only from public.svc_comm_settings s
    where s.tenant_id = tid and s.employee_id = p_emp and s.deleted_at is null;
  comm_only := coalesce(comm_only, false);

  basic := case when comm_only then 0 else coalesce(e.basic_salary, 0) end;
  svc_c := coalesce(m.svc_commission, 0);
  prod_c := coalesce(m.prod_commission, 0);
  bon_c := coalesce(m.bonus, 0);
  tot := round(basic + coalesce(m.commission_total, svc_c + prod_c + bon_c), 2);
  if tot <= 0 then raise exception 'Amount must be greater than 0' using errcode = '22023'; end if;

  mon := (array['Jan','Feb','Mac','Apr','Mei','Jun','Jul','Ogo','Sep','Okt','Nov','Dis'])[p_month] || ' ' || p_year;
  desc_txt := coalesce(d,
    case when comm_only then '' else 'Gaji asas: RM ' || to_char(basic, 'FM999999990.00') || E'\n' end ||
    'Komisen servis: RM ' || to_char(svc_c, 'FM999999990.00') || E'\n' ||
    'Komisen produk: RM ' || to_char(prod_c, 'FM999999990.00') || E'\n' ||
    case when comm_only and bon_c = 0 then '' else 'Bonus conversion: RM ' || to_char(bon_c, 'FM999999990.00') || E'\n' end ||
    'Tempoh: ' || mon);

  insert into public.payment_vouchers (
    tenant_id, ref_no, voucher_date, payee_name, payee_type, payee_id,
    amount, payment_method, bank_name, bank_account_no, phone,
    description, status, prepared_by, created_by, category, source, source_ref, created_at, updated_at
  ) values (
    tid, public.pv__next_ref(tid, 'PV'), make_date(p_year, p_month, 1), e.name, 'employee', e.id,
    tot, 'Bank Transfer', e.bank_name, e.bank_account_no, e.phone,
    desc_txt, 'draft', coalesce(nullif(btrim(me.full_name), ''), 'HR'), auth.uid(), 'other', 'svc', m.id, now(), now()
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

  return jsonb_build_object('id', vid, 'ref_no', vref, 'existing', false, 'month_id', m.id, 'amount', tot, 'status', 'draft',
    'basic', basic, 'svc_commission', svc_c, 'prod_commission', prod_c, 'bonus', bon_c);
end;
$$;
revoke all on function public.svc_create_pv(uuid, int, int, text) from public, anon;
grant execute on function public.svc_create_pv(uuid, int, int, text) to authenticated;

-- ---------- D) PVD summary for one period (idempotent; rebuilds lines while nothing is paid) ----------
create or replace function public.svc_create_pvd(p_month int, p_year int, p_title text default null, p_bm boolean default true)
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
  where m.tenant_id = tid and m.month = p_month and m.year = p_year and m.deleted_at is null and m.status = 'approved';
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
revoke all on function public.svc_create_pvd(int, int, text, boolean) from public, anon;
grant execute on function public.svc_create_pvd(int, int, text, boolean) to authenticated;

-- ---------- F) receipt signature role 'received' ----------
do $$
declare c record;
begin
  for c in select k.conrelid::regclass::text as tbl, k.conname from pg_constraint k
           where k.conrelid in ('public.svc_signatures'::regclass, 'public.svc_sign_links'::regclass) and k.contype = 'c'
             and pg_get_constraintdef(k.oid) ilike '%prepared%' and pg_get_constraintdef(k.oid) not ilike '%received%'
  loop
    execute format('alter table %s drop constraint %I', c.tbl, c.conname);
  end loop;
end $$;
do $$ begin
  alter table public.svc_signatures add constraint svc_signatures_role_ck check (role in ('prepared', 'approved', 'received'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.svc_sign_links add constraint svc_sign_links_role_ck check (role in ('prepared', 'approved', 'received'));
exception when duplicate_object then null; end $$;

create or replace function public.svc__sign_label(p_role text, p_bm boolean)
returns text language sql immutable set search_path = public as $$
  select case p_role
    when 'prepared' then case when p_bm then 'Disediakan oleh' else 'Prepared by' end
    when 'received' then case when p_bm then 'Diterima oleh' else 'Received by' end
    else case when p_bm then 'Diluluskan oleh' else 'Approved by' end end
$$;

create or replace function public.svc__sign_gate(p_status text, p_role text)
returns void language plpgsql immutable set search_path = public as $$
begin
  if p_role is null or p_role not in ('prepared', 'approved', 'received') then raise exception 'Invalid role' using errcode = '22023'; end if;
  if p_role = 'prepared' and coalesce(p_status, 'draft') not in ('submitted', 'approved') then
    raise exception 'Submit the month first' using errcode = 'P0001'; end if;
  if p_role in ('approved', 'received') and coalesce(p_status, 'draft') <> 'approved' then
    raise exception 'Approve the month first' using errcode = 'P0001'; end if;
end;
$$;

create or replace function public.svc__has_pv(p_mid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.payment_vouchers v join public.svc_comm_months m on m.id = p_mid and v.tenant_id = m.tenant_id
                 where v.source = 'svc' and v.source_ref = p_mid and v.deleted_at is null and v.status <> 'void')
$$;
revoke all on function public.svc__has_pv(uuid) from public, anon, authenticated;

-- after each signature: 2/2 counts only Prepared + Approved; a receipt tells Owner/Admin/Manager/HR (no amounts, actor skipped)
create or replace function public.svc__after_sign(p_mid uuid, p_role text, p_signer text, p_via text, p_actor uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  m public.svc_comm_months%rowtype;
  n int; ename text := ''; who uuid; lnk jsonb; typ text := 'hr.svc_comm_signed';
  per_en text; per_bm text; via_en text; via_bm text;
begin
  select * into m from public.svc_comm_months where id = p_mid;
  select count(*) into n from public.svc_signatures where month_id = p_mid and voided_at is null and role in ('prepared', 'approved');
  begin
    update public.notifications set acted_at = now(), read_at = coalesce(read_at, now())
    where tenant_id = m.tenant_id and ref_id::text = p_mid::text and type = 'hr.svc_comm_sign_req' and acted_at is null
      and coalesce(link->'params'->>'sig', '') = p_role;
  exception when others then raise warning 'svc__after_sign close: %', sqlerrm; end;
  if to_regprocedure('public.dk__notify(uuid,text[],uuid[],uuid,text,text,text,text,text,jsonb,text,uuid,text)') is not null then
    begin
      select coalesce(e.name, '') into ename from public.employees e where e.id = m.employee_id and e.tenant_id = m.tenant_id;
      per_en := public.svc__sign_period(m.month, m.year, false); per_bm := public.svc__sign_period(m.month, m.year, true);
      via_en := case when p_via = 'link' then 'via WhatsApp link' else 'in the app' end;
      via_bm := case when p_via = 'link' then 'melalui pautan WhatsApp' else 'dalam aplikasi' end;
      who := public.svc__emp_user(m.tenant_id, m.employee_id);
      lnk := jsonb_build_object('page', 'hr', 'params', jsonb_build_object('view', 'my-payslips', 'svc', 'log',
               'emp', m.employee_id::text, 'm', m.month, 'y', m.year, 'sig', p_role), 'icon', case when n >= 2 or p_role = 'received' then 'ti-circle-check' else 'ti-signature' end);
      if p_role = 'received' then
        typ := 'hr.svc_comm_received';
        perform public.dk__notify(m.tenant_id, array['owner', 'admin', 'manager', 'hr'], null, p_actor,
          'Payment receipt acknowledged · ' || coalesce(nullif(ename, ''), 'staff') || ' · ' || per_en,
          'Penerimaan bayaran disahkan · ' || coalesce(nullif(ename, ''), 'staf') || ' · ' || per_bm,
          'Service commission · ' || left(coalesce(p_signer, ''), 80) || ' signed ' || via_en || '. Tap to view.',
          'Komisen servis · ' || left(coalesce(p_signer, ''), 80) || ' tandatangan ' || via_bm || '. Ketik untuk lihat.',
          typ, lnk, 'svc_comm_months', m.id, typ || ':' || m.id::text || ':' || now()::text);
      else
        perform public.dk__notify(m.tenant_id, array['owner', 'admin', 'manager', 'hr'],
          case when p_role = 'approved' and who is not null then array[who] else null end, p_actor,
          case when n >= 2 then 'Service commission statement fully signed (2/2) · ' || coalesce(nullif(ename, ''), 'staff') || ' · ' || per_en
               else public.svc__sign_label(p_role, false) || ' signed (' || n || '/2) · ' || coalesce(nullif(ename, ''), 'staff') || ' · ' || per_en end,
          case when n >= 2 then 'Penyata komisen servis lengkap ditandatangani (2/2) · ' || coalesce(nullif(ename, ''), 'staf') || ' · ' || per_bm
               else public.svc__sign_label(p_role, true) || ' ditandatangani (' || n || '/2) · ' || coalesce(nullif(ename, ''), 'staf') || ' · ' || per_bm end,
          'Service commission · ' || left(coalesce(p_signer, ''), 80) || ' signed ' || via_en || '. Tap to view the statement.',
          'Komisen servis · ' || left(coalesce(p_signer, ''), 80) || ' tandatangan ' || via_bm || '. Ketik untuk lihat penyata.',
          typ, lnk, 'svc_comm_months', m.id, typ || ':' || m.id::text || ':' || p_role || ':' || now()::text);
      end if;
    exception when others then
      raise warning 'svc__after_sign notify skipped: %', sqlerrm;
    end;
  end if;
  return jsonb_build_object('signed', n, 'complete', n >= 2, 'role', p_role, 'slots', public.svc__sign_slots(p_mid));
end;
$$;

create or replace function public.svc_sign_app(p_emp uuid, p_month int, p_year int, p_role text, p_name text, p_path text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tid uuid := public.svc__my_tenant();
  m public.svc_comm_months%rowtype;
  nm text := left(btrim(coalesce(p_name, '')), 120);
  hr boolean; pre text;
begin
  if auth.uid() is null or tid is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  hr := public.svc__is_hr(tid);
  if not (hr or (p_role in ('prepared', 'received') and public.svc__is_me(tid, p_emp))) then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into m from public.svc_comm_months where id = public.svc__sign_month(tid, p_emp, p_month, p_year);
  if not found then raise exception 'Submit the month first' using errcode = 'P0001'; end if;
  perform public.svc__sign_gate(m.status, p_role);
  if p_role = 'received' and not public.svc__has_pv(m.id) then raise exception 'Create the PV first' using errcode = 'P0001'; end if;
  if nm = '' then raise exception 'Name required' using errcode = '22023'; end if;
  pre := m.tenant_id::text || '/svc-signatures/' || m.id::text || '/';
  if p_path is null or left(p_path, length(pre)) <> pre or p_path !~* '\.png$' then raise exception 'Invalid signature file' using errcode = '22023'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'doc-files' and o.name = p_path) then raise exception 'Signature file not uploaded' using errcode = 'P0001'; end if;
  begin
    insert into public.svc_signatures (tenant_id, month_id, role, signer_name, signer_user_id, storage_path, signed_via)
    values (m.tenant_id, m.id, p_role, nm, auth.uid(), p_path, 'app');
  exception when unique_violation then raise exception 'This slot is already signed' using errcode = 'P0001';
  end;
  return public.svc__after_sign(m.id, p_role, nm, 'app', auth.uid());
end;
$$;

create or replace function public.svc_sign_link_create(p_emp uuid, p_month int, p_year int, p_role text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tid uuid := public.svc__my_tenant();
  m public.svc_comm_months%rowtype;
  tok text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  l public.svc_sign_links%rowtype;
begin
  if tid is null or not public.svc__is_hr(tid) then raise exception 'Only HR managers can share signing links' using errcode = '42501'; end if;
  select * into m from public.svc_comm_months where id = public.svc__sign_month(tid, p_emp, p_month, p_year);
  if not found then raise exception 'Submit the month first' using errcode = 'P0001'; end if;
  perform public.svc__sign_gate(m.status, p_role);
  if p_role = 'received' and not public.svc__has_pv(m.id) then raise exception 'Create the PV first' using errcode = 'P0001'; end if;
  insert into public.svc_sign_links (tenant_id, month_id, role, token_hash, created_by)
  values (m.tenant_id, m.id, p_role, encode(sha256(convert_to(tok, 'UTF8')), 'hex'), auth.uid())
  returning * into l;
  return jsonb_build_object('token', tok, 'link_id', l.id, 'expires_at', l.expires_at, 'role', p_role, 'month_id', m.id,
    'signed', exists (select 1 from public.svc_signatures s where s.month_id = m.id and s.role = p_role and s.voided_at is null));
end;
$$;

-- public page: all-services rows earn commission too; a 'received' link also gets the PV ref + description + receipt slot
create or replace function public.get_public_svc_sign(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  l public.svc_sign_links%rowtype;
  m public.svc_comm_months%rowtype;
  tn public.tenants%rowtype;
  ename text; epos text; cp jsonb; rt jsonb; rows jsonb; pv jsonb; rc jsonb; prods jsonb;
  r_rate numeric; r_cap numeric; r_st text; r_leads jsonb; r_all boolean;
begin
  if p_token is null or length(btrim(p_token)) < 32 then raise exception 'Invalid token'; end if;
  select * into l from public.svc_sign_links where token_hash = encode(sha256(convert_to(btrim(p_token), 'UTF8')), 'hex');
  if not found or l.revoked_at is not null or l.expires_at <= now() then raise exception 'Link expired or revoked'; end if;
  select * into m from public.svc_comm_months where id = l.month_id and deleted_at is null;
  if not found then raise exception 'Statement not found'; end if;
  select x.name, x.position into ename, epos from public.employees x where x.id = m.employee_id and x.tenant_id = m.tenant_id;
  select * into tn from public.tenants where id = m.tenant_id;
  cp := coalesce(tn.config->'company_profile', '{}'::jsonb);
  rt := coalesce(m.rates, '{}'::jsonb);
  r_rate := coalesce(nullif(rt->>'svc_rate_pct', '')::numeric, 5);
  r_cap := case when rt ? 'svc_cap' then nullif(rt->>'svc_cap', '')::numeric else 10 end;
  r_st := upper(coalesce(nullif(rt->>'eligible_status', ''), 'NM'));
  r_leads := case when jsonb_typeof(rt->'eligible_leads') = 'array' then rt->'eligible_leads' else '["TT","ADS"]'::jsonb end;
  r_all := coalesce((rt->>'svc_all')::boolean, false);
  select coalesce(jsonb_agg(jsonb_build_object(
      'date', g.log_date, 'service', g.service, 'code', g.code, 'price', g.price, 'status', g.client_status, 'lead', g.lead_source,
      'commission', case when r_all then case when coalesce(g.price, 0) > 0 then round(g.price * r_rate / 100, 2) else 0 end
                     when g.client_status = r_st and r_leads ? coalesce(g.lead_source, '') and coalesce(g.price, 0) > 0
                     then round(case when r_cap is null then g.price * r_rate / 100 else least(g.price * r_rate / 100, r_cap) end, 2)
                     else 0 end
    ) order by g.log_date, g.created_at), '[]'::jsonb) into rows
  from public.svc_logs g
  where g.tenant_id = m.tenant_id and g.employee_id = m.employee_id and g.deleted_at is null
    and g.log_date >= make_date(m.year, m.month, 1) and g.log_date < (make_date(m.year, m.month, 1) + interval '1 month')::date;
  select coalesce(jsonb_agg(jsonb_build_object('date', p.log_date, 'code', p.code, 'name', p.name, 'qty', p.qty, 'amount', p.amount)
           order by p.log_date, p.created_at), '[]'::jsonb) into prods
  from public.svc_product_logs p
  where p.tenant_id = m.tenant_id and p.employee_id = m.employee_id and p.deleted_at is null
    and p.log_date >= make_date(m.year, m.month, 1) and p.log_date < (make_date(m.year, m.month, 1) + interval '1 month')::date;
  if l.role = 'received' then
    select jsonb_build_object('ref_no', v.ref_no, 'amount', v.amount, 'status', v.status, 'description', v.description) into pv
    from public.payment_vouchers v where v.tenant_id = m.tenant_id and v.source = 'svc' and v.source_ref = m.id
      and v.deleted_at is null and v.status <> 'void' limit 1;
  end if;
  select jsonb_build_object('signed', true, 'signer_name', s.signer_name, 'signed_at', s.signed_at, 'signed_via', s.signed_via) into rc
  from public.svc_signatures s where s.month_id = m.id and s.role = 'received' and s.voided_at is null limit 1;
  return jsonb_build_object(
    'mode', 'sign', 'month_id', m.id, 'tenant_id', m.tenant_id, 'link_id', l.id, 'role', l.role, 'expires_at', l.expires_at,
    'status', m.status, 'month', m.month, 'year', m.year,
    'tenant_name', coalesce(nullif(tn.name, ''), cp->>'name'),
    'logo_url', coalesce(nullif(tn.logo_url, ''), cp->>'logo_url'),
    'address', coalesce(nullif(tn.address, ''), cp->>'address'),
    'employee_name', ename, 'position', epos,
    'heads', m.svc_heads, 'svc_commission', m.svc_commission, 'product_sales', m.product_sales, 'prod_commission', m.prod_commission,
    'bonus', m.bonus, 'commission_total', m.commission_total, 'product_note', m.product_note, 'rates', rt,
    'rows', rows, 'products', prods, 'pv', pv, 'receipt', coalesce(rc, jsonb_build_object('signed', false)),
    'slots', public.svc__sign_slots(m.id));
end;
$$;

revoke all on function public.svc__sign_label(text, boolean) from public, anon, authenticated;
revoke all on function public.svc__sign_gate(text, text) from public, anon, authenticated;
revoke all on function public.svc__after_sign(uuid, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.svc_sign_app(uuid, int, int, text, text, text) from public, anon;
revoke all on function public.svc_sign_link_create(uuid, int, int, text) from public, anon;
revoke all on function public.get_public_svc_sign(text) from public;
grant execute on function public.svc_sign_app(uuid, int, int, text, text, text) to authenticated;
grant execute on function public.svc_sign_link_create(uuid, int, int, text) to authenticated;
grant execute on function public.get_public_svc_sign(text) to anon, authenticated;

-- doc_shares: widen (never shrink) for the receipt WhatsApp template
do $$
declare c record; d text; v text[]; want text[];
begin
  if to_regclass('public.doc_shares') is null then return; end if;
  for c in select * from (values ('doc_shares_template_check', 'template', array['svc_receipt'])) t(cname, col, vals) loop
    select pg_get_constraintdef(k.oid) into d from pg_constraint k where k.conrelid = 'public.doc_shares'::regclass and k.conname = c.cname;
    if d is null then continue; end if;
    select coalesce(array_agg(distinct y), '{}') into v from regexp_matches(d, '''([^'']+)''', 'g') x,
      unnest(string_to_array(btrim(x[1], '{}'), ',')) y;
    if v @> c.vals then continue; end if;
    select array_agg(distinct u order by u) into want from unnest(v || c.vals) u;
    execute format('alter table public.doc_shares drop constraint %I', c.cname);
    execute format('alter table public.doc_shares add constraint %I check (%I is null or %I = any (array[%s]::text[])) not valid', c.cname, c.col, c.col,
      (select string_agg(quote_literal(u), ', ') from unnest(want) u));
  end loop;
end $$;

-- ---------- I) source file on the month (doc_attachments, entity 'svc_month') ----------
do $$
declare c record; d text; v text[]; want text[];
begin
  if to_regclass('public.doc_attachments') is null then raise notice 'doc_attachments missing — run pay_attach_01.sql'; return; end if;
  for c in select k.conname, pg_get_constraintdef(k.oid) as def from pg_constraint k
           where k.conrelid = 'public.doc_attachments'::regclass and k.contype = 'c' and pg_get_constraintdef(k.oid) ilike '%entity_type%'
  loop
    select coalesce(array_agg(distinct y), '{}') into v from regexp_matches(c.def, '''([^'']+)''', 'g') x,
      unnest(string_to_array(btrim(x[1], '{}'), ',')) y;
    if v @> array['svc_month'] then continue; end if;
    select array_agg(distinct u order by u) into want from unnest(v || array['svc_month']) u;
    execute format('alter table public.doc_attachments drop constraint %I', c.conname);
    execute format('alter table public.doc_attachments add constraint %I check (entity_type = any (array[%s]::text[])) not valid', c.conname,
      (select string_agg(quote_literal(u), ', ') from unnest(want) u));
  end loop;
end $$;
drop policy if exists doc_files_svcsrc_ins on storage.objects;
create policy doc_files_svcsrc_ins on storage.objects for insert to authenticated with check (
  bucket_id = 'doc-files'
  and (storage.foldername(name))[1] = (select p.tenant_id::text from public.user_profiles p where p.id = auth.uid())
  and (storage.foldername(name))[2] = 'svc-source'
  and public.svc__is_hr((select p.tenant_id from public.user_profiles p where p.id = auth.uid())));

revoke all on function public.svc_create_pv(uuid, int, int, text) from public, anon;
revoke all on function public.svc_comm_reopen(uuid, int, int) from public, anon;
grant execute on function public.svc_comm_reopen(uuid, int, int) to authenticated;

commit;

-- ---------- System Development roadmap ----------
insert into dev_roadmap_items (id, title, description, module, stage, started_at, completed_at)
select gen_random_uuid(), 'Service commission: all-services scheme (no lead / cap)',
  'Scheme option "Commission on all services (no lead/cap conditions)" / "Komisen semua servis (tanpa syarat lead / had)": every log with a price earns price × service %, no NM/TT/ADS flags and no cap. Same rule in public.svc__calc and SVC.calc; the NM + TT/ADS + cap model is unchanged when the option is off.',
  'hr', 'completed', now(), now()
where not exists (select 1 from dev_roadmap_items where title = 'Service commission: all-services scheme (no lead / cap)');
insert into dev_roadmap_items (id, title, description, module, stage, started_at, completed_at)
select gen_random_uuid(), 'Service commission: itemised product sales + price/code list',
  'Product sales logged per item (svc_product_logs: date, code, name, qty, amount); product sales = sum of items, else the old single number. Per-tenant code list (svc_price_codes: code, name, service|product, default price) autofills name + price in the log forms; rows without a code are flagged "needs review" (import is never blocked). Excel/CSV import reads DATE / PRODUK / RM / SERVICE / RM sheets directly.',
  'hr', 'completed', now(), now()
where not exists (select 1 from dev_roadmap_items where title = 'Service commission: itemised product sales + price/code list');
insert into dev_roadmap_items (id, title, description, module, stage, started_at, completed_at)
select gen_random_uuid(), 'Service commission: PV for all staff + PVD + commission-only PV description',
  'One tap "Create PV for all staff this month" creates one draft PV per approved staff-month (idempotent) with a WhatsApp-style description (service lines by code / price, product lines, PERLU SEMAK section, no Basic for commission-only staff, comparison with last month) and one PV Disbursement (PVD) listing staff, service / product commission, total and PV ref. Commission-only schemes no longer add basic pay to the PV.',
  'hr', 'completed', now(), now()
where not exists (select 1 from dev_roadmap_items where title = 'Service commission: PV for all staff + PVD + commission-only PV description');
insert into dev_roadmap_items (id, title, description, module, stage, started_at, completed_at)
select gen_random_uuid(), 'Service commission: receipt signature, close month, source file',
  'PV description sent to the staff WhatsApp with a "Received by" signature link (stored in svc_signatures, bell + push to Owner/HR without amounts). When the month''s PV is marked paid the month closes: service logs and product items are locked server-side and Reopen is blocked; only the Owner can reopen with a reason. The original source sheet can be attached to the month for audit (doc_attachments + doc-files).',
  'hr', 'completed', now(), now()
where not exists (select 1 from dev_roadmap_items where title = 'Service commission: receipt signature, close month, source file');

notify pgrst, 'reload schema';
