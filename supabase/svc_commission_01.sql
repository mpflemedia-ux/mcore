-- M-Core — Service commission payroll (part-time). svc_commission_01.sql
-- WRITE-ONLY: Mike runs this in Supabase SQL editor. Rerun-safe (idempotent), guarded.
--
-- What it adds (all tenant-scoped, soft delete, RLS):
--   svc_comm_settings  per-employee scheme: base pay basis, work mode, service % + cap/head, eligible status + leads,
--                      product %, bonus amount. Defaults 5% / RM10 / NM / {TT,ADS} / 5% / RM100.
--   svc_logs           one row per head served (date, service, price, M/NM, lead, week_no). Staff log their own rows;
--                      Owner/HR edit anyone's. Locked once the month is approved.
--   svc_comm_months    one row per employee+month: product sales (manual), bonus on/off, status draft→submitted→approved,
--                      server-computed snapshot (heads, service / product commission, bonus, total, flags).
--   svc_comm_calc()    server-side calc (same rule as app/svc-commission.js SVC.calc).
--   svc_comm_submit()  staff/HR: draft → submitted (bell + push to Owner/Admin/Manager/HR, no amounts).
--   svc_comm_approve() Owner/HR: recompute + snapshot + approved (bell + push to the employee, no amounts).
--   svc_comm_reopen()  Owner/HR: approved/submitted → draft (bell + push to the employee).
-- Payroll: app wraps _scCommissionTotal (payout mode) so an APPROVED month's commission_total is added to
-- payroll_records.commission for the SAME month on Salary Disbursement → net pay, journal and payslip pick it up.
-- Notes: notifications.ref_id is uuid → compared ::text = ::text. No has_module(), no user_profiles.email.

begin;

-- ---------- 0) helpers ----------
create or replace function public.svc__my_tenant()
returns uuid language sql stable security definer set search_path = public as $$
  select p.tenant_id from public.user_profiles p where p.id = auth.uid()
$$;

create or replace function public.svc__is_hr(p_tid uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare ok boolean; vo boolean := false;
begin
  if p_tid is null or auth.uid() is null then return false; end if;
  select exists (select 1 from public.user_profiles u where u.id = auth.uid() and u.tenant_id = p_tid
                  and lower(coalesce(u.role, '')) in ('owner', 'admin', 'platform_admin', 'manager', 'hr')) into ok;
  if not ok then return false; end if;
  if to_regclass('public.platform_support_sessions') is not null then
    execute 'select exists (select 1 from public.platform_support_sessions s where s.actor_id = $1 and s.tenant_id = $2
             and s.ended_at is null and coalesce(s.view_only, false) and s.deleted_at is null)' into vo using auth.uid(), p_tid;
  end if;
  return not coalesce(vo, false);
end;
$$;

-- user id behind an employee (dk__emp_user when present, else employees.user_id / email via auth.users)
create or replace function public.svc__emp_user(p_tid uuid, p_emp uuid)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare e jsonb; u uuid;
begin
  if p_tid is null or p_emp is null then return null; end if;
  if to_regprocedure('public.dk__emp_user(uuid,uuid)') is not null then
    execute 'select public.dk__emp_user($1, $2)' into u using p_tid, p_emp;
    return u;
  end if;
  select to_jsonb(x) into e from public.employees x where x.id = p_emp and x.tenant_id = p_tid;
  if e is null then return null; end if;
  if coalesce(e->>'user_id', '') ~* '^[0-9a-f-]{36}$' then
    select p.id into u from public.user_profiles p where p.id = (e->>'user_id')::uuid and p.tenant_id = p_tid;
    if u is not null then return u; end if;
  end if;
  if coalesce(trim(e->>'email'), '') <> '' then
    begin
      execute 'select a.id from auth.users a join public.user_profiles p on p.id = a.id and p.tenant_id = $1
               where lower(a.email) = lower($2) limit 1' into u using p_tid, trim(e->>'email');
    exception when others then u := null; end;
  end if;
  return u;
end;
$$;

create or replace function public.svc__is_me(p_tid uuid, p_emp uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and p_tid = public.svc__my_tenant()
     and public.svc__emp_user(p_tid, p_emp)::text = auth.uid()::text
$$;

revoke all on function public.svc__emp_user(uuid, uuid) from public, anon, authenticated;
revoke all on function public.svc__my_tenant() from public, anon;
revoke all on function public.svc__is_hr(uuid) from public, anon;
revoke all on function public.svc__is_me(uuid, uuid) from public, anon;
grant execute on function public.svc__my_tenant() to authenticated;
grant execute on function public.svc__is_hr(uuid) to authenticated;
grant execute on function public.svc__is_me(uuid, uuid) to authenticated;

-- ---------- 1) tables ----------
create table if not exists public.svc_comm_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  employee_id uuid not null,
  enabled boolean not null default true,
  pay_basis text not null default 'monthly_fixed',
  work_mode text not null default 'wfh',
  svc_rate_pct numeric(6,3) not null default 5,
  svc_cap numeric(12,2) default 10,
  eligible_status text not null default 'NM',
  eligible_leads text[] not null default array['TT', 'ADS'],
  prod_rate_pct numeric(6,3) not null default 5,
  bonus_amount numeric(12,2) not null default 100,
  notes text,
  created_by uuid default auth.uid(),
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint svc_comm_settings_emp_uk unique (tenant_id, employee_id),
  constraint svc_comm_settings_basis_ck check (pay_basis in ('monthly_fixed', 'daily', 'hourly', 'commission_only')),
  constraint svc_comm_settings_mode_ck check (work_mode in ('wfh', 'onsite', 'hybrid')),
  constraint svc_comm_settings_rate_ck check (svc_rate_pct >= 0 and svc_rate_pct <= 100 and prod_rate_pct >= 0 and prod_rate_pct <= 100),
  constraint svc_comm_settings_amt_ck check ((svc_cap is null or svc_cap >= 0) and bonus_amount >= 0)
);

create table if not exists public.svc_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  employee_id uuid not null,
  log_date date not null,
  week_no smallint,
  service text not null,
  price numeric(12,2),
  client_status text,
  lead_source text,
  notes text,
  source text not null default 'manual',
  created_by uuid default auth.uid(),
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint svc_logs_service_ck check (length(btrim(service)) between 1 and 120),
  constraint svc_logs_price_ck check (price is null or price >= 0),
  constraint svc_logs_status_ck check (client_status is null or client_status in ('M', 'NM')),
  constraint svc_logs_lead_ck check (lead_source is null or lead_source ~ '^[A-Z0-9_]{1,16}$'),
  constraint svc_logs_week_ck check (week_no is null or week_no between 1 and 6),
  constraint svc_logs_source_ck check (source in ('manual', 'import', 'seed'))
);
create index if not exists svc_logs_emp_date_ix on public.svc_logs (tenant_id, employee_id, log_date) where deleted_at is null;

create table if not exists public.svc_comm_months (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  employee_id uuid not null,
  month smallint not null,
  year smallint not null,
  status text not null default 'draft',
  product_sales numeric(14,2) not null default 0,
  product_note text,
  bonus_on boolean not null default false,
  svc_heads int not null default 0,
  svc_commission numeric(14,2) not null default 0,
  prod_commission numeric(14,2) not null default 0,
  bonus numeric(14,2) not null default 0,
  commission_total numeric(14,2) not null default 0,
  flags int not null default 0,
  rates jsonb,
  submitted_by uuid, submitted_at timestamptz,
  approved_by uuid, approved_at timestamptz,
  created_by uuid default auth.uid(),
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint svc_comm_months_uk unique (tenant_id, employee_id, year, month),
  constraint svc_comm_months_m_ck check (month between 1 and 12 and year between 2000 and 2100),
  constraint svc_comm_months_st_ck check (status in ('draft', 'submitted', 'approved')),
  constraint svc_comm_months_amt_ck check (product_sales >= 0)
);
create index if not exists svc_comm_months_period_ix on public.svc_comm_months (tenant_id, year, month) where deleted_at is null;

-- ---------- 2) month lock + touch ----------
create or replace function public.svc__month_locked(p_tid uuid, p_emp uuid, p_date date)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.svc_comm_months m where m.tenant_id = p_tid and m.employee_id = p_emp
    and m.year = extract(year from p_date)::int and m.month = extract(month from p_date)::int
    and m.status = 'approved' and m.deleted_at is null)
$$;
revoke all on function public.svc__month_locked(uuid, uuid, date) from public, anon;
grant execute on function public.svc__month_locked(uuid, uuid, date) to authenticated;

create or replace function public.svc__touch()
returns trigger language plpgsql as $$
begin
  NEW.updated_at := now();
  if auth.uid() is not null then NEW.updated_by := auth.uid(); end if;
  return NEW;
end;
$$;
drop trigger if exists svc_comm_settings_touch on public.svc_comm_settings;
create trigger svc_comm_settings_touch before update on public.svc_comm_settings for each row execute function public.svc__touch();
drop trigger if exists svc_logs_touch on public.svc_logs;
create trigger svc_logs_touch before update on public.svc_logs for each row execute function public.svc__touch();
drop trigger if exists svc_comm_months_touch on public.svc_comm_months;
create trigger svc_comm_months_touch before update on public.svc_comm_months for each row execute function public.svc__touch();

-- normalise status / lead (upper, trimmed, '' → null) so 'nm ' and 'NM' count the same
create or replace function public.svc__logs_norm()
returns trigger language plpgsql as $$
begin
  NEW.service := btrim(NEW.service);
  NEW.client_status := nullif(upper(btrim(coalesce(NEW.client_status, ''))), '');
  NEW.lead_source := nullif(upper(btrim(coalesce(NEW.lead_source, ''))), '');
  return NEW;
end;
$$;
drop trigger if exists svc_logs_norm on public.svc_logs;
create trigger svc_logs_norm before insert or update on public.svc_logs for each row execute function public.svc__logs_norm();

-- ---------- 3) RLS ----------
alter table public.svc_comm_settings enable row level security;
alter table public.svc_logs enable row level security;
alter table public.svc_comm_months enable row level security;
revoke all on public.svc_comm_settings, public.svc_logs, public.svc_comm_months from anon;
grant select, insert, update on public.svc_comm_settings, public.svc_logs, public.svc_comm_months to authenticated;

-- settings: HR read/write; the employee can read their own scheme
drop policy if exists svc_cs_sel on public.svc_comm_settings;
create policy svc_cs_sel on public.svc_comm_settings for select to authenticated using (
  tenant_id = public.svc__my_tenant() and (public.svc__is_hr(tenant_id) or public.svc__is_me(tenant_id, employee_id)));
drop policy if exists svc_cs_ins on public.svc_comm_settings;
create policy svc_cs_ins on public.svc_comm_settings for insert to authenticated with check (
  tenant_id = public.svc__my_tenant() and public.svc__is_hr(tenant_id));
drop policy if exists svc_cs_upd on public.svc_comm_settings;
create policy svc_cs_upd on public.svc_comm_settings for update to authenticated
  using (tenant_id = public.svc__my_tenant() and public.svc__is_hr(tenant_id))
  with check (tenant_id = public.svc__my_tenant() and public.svc__is_hr(tenant_id));

-- logs: HR anyone's, staff own rows; no writes into an approved month (reopen first)
drop policy if exists svc_lg_sel on public.svc_logs;
create policy svc_lg_sel on public.svc_logs for select to authenticated using (
  tenant_id = public.svc__my_tenant() and (public.svc__is_hr(tenant_id) or public.svc__is_me(tenant_id, employee_id)));
drop policy if exists svc_lg_ins on public.svc_logs;
create policy svc_lg_ins on public.svc_logs for insert to authenticated with check (
  tenant_id = public.svc__my_tenant() and (public.svc__is_hr(tenant_id) or public.svc__is_me(tenant_id, employee_id))
  and not public.svc__month_locked(tenant_id, employee_id, log_date));
drop policy if exists svc_lg_upd on public.svc_logs;
create policy svc_lg_upd on public.svc_logs for update to authenticated
  using (tenant_id = public.svc__my_tenant() and (public.svc__is_hr(tenant_id) or public.svc__is_me(tenant_id, employee_id))
         and not public.svc__month_locked(tenant_id, employee_id, log_date))
  with check (tenant_id = public.svc__my_tenant() and (public.svc__is_hr(tenant_id) or public.svc__is_me(tenant_id, employee_id))
         and not public.svc__month_locked(tenant_id, employee_id, log_date));

-- months: HR read/write draft fields (product sales, bonus, note); staff read own. Status moves only via the RPCs.
drop policy if exists svc_mo_sel on public.svc_comm_months;
create policy svc_mo_sel on public.svc_comm_months for select to authenticated using (
  tenant_id = public.svc__my_tenant() and (public.svc__is_hr(tenant_id) or public.svc__is_me(tenant_id, employee_id)));
drop policy if exists svc_mo_ins on public.svc_comm_months;
create policy svc_mo_ins on public.svc_comm_months for insert to authenticated with check (
  tenant_id = public.svc__my_tenant() and public.svc__is_hr(tenant_id) and status = 'draft');
drop policy if exists svc_mo_upd on public.svc_comm_months;
create policy svc_mo_upd on public.svc_comm_months for update to authenticated
  using (tenant_id = public.svc__my_tenant() and public.svc__is_hr(tenant_id) and status <> 'approved')
  with check (tenant_id = public.svc__my_tenant() and public.svc__is_hr(tenant_id) and status <> 'approved');
-- direct writes may not touch status / snapshot / approval columns
revoke update on public.svc_comm_months from authenticated;
grant update (product_sales, product_note, bonus_on, deleted_at) on public.svc_comm_months to authenticated;
revoke insert on public.svc_comm_months from authenticated;
grant insert (tenant_id, employee_id, month, year, product_sales, product_note, bonus_on) on public.svc_comm_months to authenticated;

-- ---------- 4) calc (pure SQL twin of SVC.calc in app/svc-commission.js) ----------
-- eligible head = client_status = eligible_status AND lead in eligible_leads AND price > 0
-- per head = round(min(price × svc_rate_pct%, svc_cap), 2); product = round(product_sales × prod_rate_pct%, 2); bonus = bonus_on ? bonus_amount : 0
create or replace function public.svc__calc(p_tid uuid, p_emp uuid, p_month int, p_year int)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  tid uuid := p_tid; s record; m record;
  heads int := 0; svc numeric := 0; flags int := 0; nrows int := 0; prod numeric := 0; bon numeric := 0; psales numeric := 0;
  r_rate numeric := 5; r_cap numeric := 10; r_st text := 'NM'; r_leads text[] := array['TT', 'ADS']; r_prod numeric := 5; r_bonus numeric := 100;
begin
  if tid is null or p_emp is null then return null; end if;
  select * into s from public.svc_comm_settings x where x.tenant_id = tid and x.employee_id = p_emp and x.deleted_at is null;
  if found then r_rate := s.svc_rate_pct; r_cap := s.svc_cap; r_st := upper(s.eligible_status); r_leads := s.eligible_leads; r_prod := s.prod_rate_pct; r_bonus := s.bonus_amount; end if;
  select count(*)::int,
         count(*) filter (where l.client_status = r_st and l.lead_source = any(r_leads) and coalesce(l.price, 0) > 0)::int,
         coalesce(sum(case when l.client_status = r_st and l.lead_source = any(r_leads) and coalesce(l.price, 0) > 0
                      then round(case when r_cap is null then l.price * r_rate / 100 else least(l.price * r_rate / 100, r_cap) end, 2) end), 0),
         count(*) filter (where l.price is null or l.price = 0 or l.client_status is null
                             or (l.client_status = r_st and (l.lead_source is null or not (l.lead_source = any(r_leads)))))::int
    into nrows, heads, svc, flags
  from public.svc_logs l
  where l.tenant_id = tid and l.employee_id = p_emp and l.deleted_at is null
    and l.log_date >= make_date(p_year, p_month, 1) and l.log_date < (make_date(p_year, p_month, 1) + interval '1 month')::date;
  select * into m from public.svc_comm_months x where x.tenant_id = tid and x.employee_id = p_emp and x.year = p_year and x.month = p_month and x.deleted_at is null;
  if found then
    psales := coalesce(m.product_sales, 0);
    prod := round(psales * r_prod / 100, 2);
    bon := case when m.bonus_on then r_bonus else 0 end;
  end if;
  return jsonb_build_object('rows', nrows, 'heads', heads, 'svc_commission', svc, 'flags', flags,
    'product_sales', psales, 'prod_commission', prod, 'bonus', bon,
    'commission_total', svc + prod + bon,
    'rates', jsonb_build_object('svc_rate_pct', r_rate, 'svc_cap', r_cap, 'eligible_status', r_st, 'eligible_leads', to_jsonb(r_leads),
                                'prod_rate_pct', r_prod, 'bonus_amount', r_bonus));
end;
$$;

revoke all on function public.svc__calc(uuid, uuid, int, int) from public, anon, authenticated;

create or replace function public.svc_comm_calc(p_emp uuid, p_month int, p_year int)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare tid uuid := public.svc__my_tenant();
begin
  if tid is null or not (public.svc__is_hr(tid) or public.svc__is_me(tid, p_emp)) then raise exception 'not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from public.employees e where e.id = p_emp and e.tenant_id = tid) then raise exception 'not allowed' using errcode = '42501'; end if;
  return public.svc__calc(tid, p_emp, p_month, p_year);
end;
$$;

create or replace function public.svc__month_row(p_tid uuid, p_emp uuid, p_month int, p_year int)
returns uuid language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  if not exists (select 1 from public.employees e where e.id = p_emp and e.tenant_id = p_tid) then raise exception 'employee not in tenant' using errcode = '42501'; end if;
  insert into public.svc_comm_months (tenant_id, employee_id, month, year) values (p_tid, p_emp, p_month, p_year)
  on conflict (tenant_id, employee_id, year, month) do update set deleted_at = null
  returning id into rid;
  return rid;
end;
$$;
revoke all on function public.svc__month_row(uuid, uuid, int, int) from public, anon, authenticated;

-- staff (own) or HR: draft → submitted
create or replace function public.svc_comm_submit(p_emp uuid, p_month int, p_year int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare tid uuid := public.svc__my_tenant(); rid uuid; st text; c jsonb;
begin
  if tid is null or not (public.svc__is_hr(tid) or public.svc__is_me(tid, p_emp)) then raise exception 'not allowed' using errcode = '42501'; end if;
  rid := public.svc__month_row(tid, p_emp, p_month, p_year);
  select status into st from public.svc_comm_months where id = rid;
  if st = 'approved' then raise exception 'month already approved' using errcode = 'P0001'; end if;
  c := public.svc__calc(tid, p_emp, p_month, p_year);
  update public.svc_comm_months set status = 'submitted', submitted_by = auth.uid(), submitted_at = now(),
    svc_heads = (c->>'heads')::int, svc_commission = (c->>'svc_commission')::numeric, prod_commission = (c->>'prod_commission')::numeric,
    bonus = (c->>'bonus')::numeric, commission_total = (c->>'commission_total')::numeric, flags = (c->>'flags')::int, rates = c->'rates'
  where id = rid;
  return c || jsonb_build_object('id', rid, 'status', 'submitted');
end;
$$;

-- Owner/HR: recompute on the server, snapshot, approve (locks the month's logs)
create or replace function public.svc_comm_approve(p_emp uuid, p_month int, p_year int, p_product_sales numeric default null, p_bonus_on boolean default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare tid uuid := public.svc__my_tenant(); rid uuid; c jsonb;
begin
  if tid is null or not public.svc__is_hr(tid) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_product_sales is not null and p_product_sales < 0 then raise exception 'product sales must be >= 0' using errcode = '22023'; end if;
  rid := public.svc__month_row(tid, p_emp, p_month, p_year);
  update public.svc_comm_months set product_sales = coalesce(p_product_sales, product_sales), bonus_on = coalesce(p_bonus_on, bonus_on) where id = rid;
  c := public.svc__calc(tid, p_emp, p_month, p_year);
  update public.svc_comm_months set status = 'approved', approved_by = auth.uid(), approved_at = now(),
    svc_heads = (c->>'heads')::int, svc_commission = (c->>'svc_commission')::numeric, prod_commission = (c->>'prod_commission')::numeric,
    bonus = (c->>'bonus')::numeric, commission_total = (c->>'commission_total')::numeric, flags = (c->>'flags')::int, rates = c->'rates'
  where id = rid;
  return c || jsonb_build_object('id', rid, 'status', 'approved');
end;
$$;

-- Owner/HR: back to draft so logs / product sales can change (payroll stops adding it until re-approved)
create or replace function public.svc_comm_reopen(p_emp uuid, p_month int, p_year int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare tid uuid := public.svc__my_tenant(); rid uuid;
begin
  if tid is null or not public.svc__is_hr(tid) then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.svc_comm_months set status = 'draft', approved_by = null, approved_at = null
  where tenant_id = tid and employee_id = p_emp and month = p_month and year = p_year and deleted_at is null and status <> 'draft'
  returning id into rid;
  return jsonb_build_object('id', rid, 'status', 'draft');
end;
$$;

revoke all on function public.svc_comm_calc(uuid, int, int) from public, anon;
revoke all on function public.svc_comm_submit(uuid, int, int) from public, anon;
revoke all on function public.svc_comm_approve(uuid, int, int, numeric, boolean) from public, anon;
revoke all on function public.svc_comm_reopen(uuid, int, int) from public, anon;
grant execute on function public.svc_comm_calc(uuid, int, int) to authenticated;
grant execute on function public.svc_comm_submit(uuid, int, int) to authenticated;
grant execute on function public.svc_comm_approve(uuid, int, int, numeric, boolean) to authenticated;
grant execute on function public.svc_comm_reopen(uuid, int, int) to authenticated;

-- ---------- 5) notifications (bell + push via dk__notify; actor skipped; no amounts; 1 event = 1 per recipient) ----------
create or replace function public.svc__month_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ename text := ''; per_en text; per_bm text; who uuid; lnk jsonb; typ text; mon_en text[] := array['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  mon_bm text[] := array['Jan','Feb','Mac','Apr','Mei','Jun','Jul','Ogo','Sep','Okt','Nov','Dis'];
begin
  if TG_OP = 'UPDATE' and NEW.status is not distinct from OLD.status then return NEW; end if;
  if TG_OP = 'INSERT' and NEW.status = 'draft' then return NEW; end if;
  if to_regprocedure('public.dk__notify(uuid,text[],uuid[],uuid,text,text,text,text,text,jsonb,text,uuid,text)') is null then return NEW; end if;
  begin
    select coalesce(e.name, '') into ename from public.employees e where e.id = NEW.employee_id and e.tenant_id = NEW.tenant_id;
    per_en := mon_en[NEW.month] || ' ' || NEW.year; per_bm := mon_bm[NEW.month] || ' ' || NEW.year;
    lnk := jsonb_build_object('page', 'hr', 'params', jsonb_build_object('view', 'my-payslips', 'svc', 'log',
             'emp', NEW.employee_id::text, 'm', NEW.month, 'y', NEW.year));
    -- leaving 'submitted' closes the approvers' to-do rows
    if TG_OP = 'UPDATE' and OLD.status = 'submitted' then
      begin
        update public.notifications set acted_at = now(), read_at = coalesce(read_at, now())
        where tenant_id = NEW.tenant_id and ref_id::text = NEW.id::text and type = 'hr.svc_comm_submitted' and acted_at is null;
      exception when others then raise warning 'svc__month_notify close: %', sqlerrm; end;
    end if;
    if NEW.status = 'submitted' then
      typ := 'hr.svc_comm_submitted';
      perform public.dk__notify(NEW.tenant_id, array['owner', 'admin', 'manager', 'hr'], null, auth.uid(),
        'Service log awaiting approval: ' || coalesce(nullif(ename, ''), 'staff') || ' · ' || per_en,
        'Log servis menunggu kelulusan: ' || coalesce(nullif(ename, ''), 'staf') || ' · ' || per_bm,
        'Tap to review the heads and approve for payroll.', 'Ketik untuk semak head dan lulus untuk payroll.',
        typ, lnk, 'svc_comm_months', NEW.id, typ || ':' || NEW.id::text || ':' || coalesce(NEW.submitted_at, now())::text);
    else
      who := public.svc__emp_user(NEW.tenant_id, NEW.employee_id);
      if who is null then return NEW; end if;
      if NEW.status = 'approved' then
        typ := 'hr.svc_comm_approved';
        perform public.dk__notify(NEW.tenant_id, null, array[who], auth.uid(),
          'Your service commission for ' || per_en || ' is approved', 'Komisen servis ' || per_bm || ' anda diluluskan',
          'Tap to view the breakdown. It goes into this month''s payslip.', 'Ketik untuk lihat pecahan. Ia masuk slip gaji bulan ini.',
          typ, lnk, 'svc_comm_months', NEW.id, typ || ':' || NEW.id::text || ':' || coalesce(NEW.approved_at, now())::text);
      elsif NEW.status = 'draft' and TG_OP = 'UPDATE' then
        typ := 'hr.svc_comm_reopened';
        perform public.dk__notify(NEW.tenant_id, null, array[who], auth.uid(),
          'Service log ' || per_en || ' reopened for edits', 'Log servis ' || per_bm || ' dibuka semula untuk dikemas kini',
          'Tap to check and resubmit.', 'Ketik untuk semak dan hantar semula.',
          typ, lnk, 'svc_comm_months', NEW.id, typ || ':' || NEW.id::text || ':' || now()::text);
      end if;
    end if;
  exception when others then
    raise warning 'svc__month_notify: %', sqlerrm;  -- never block the payroll write
  end;
  return NEW;
end;
$$;
revoke all on function public.svc__month_notify() from public, anon, authenticated;
drop trigger if exists svc_comm_months_notify on public.svc_comm_months;
create trigger svc_comm_months_notify after insert or update of status on public.svc_comm_months
  for each row execute function public.svc__month_notify();

commit;

-- ---------- 6) seed: Brozkey Club (BROZKY99) · Hani · Oct 2026 (from Hani's sheet). Guarded + idempotent ----------
-- Runs only if tenant BROZKY99 exists AND exactly one active employee named like 'Hani'. Skips if Oct 2026 logs exist.
do $seed$
declare tid uuid; emp uuid; n int; c jsonb;
begin
  if to_regclass('public.tenants') is null or to_regclass('public.employees') is null then raise notice 'seed skipped: base tables missing'; return; end if;
  select t.id into tid from public.tenants t where upper(t.code) = 'BROZKY99' limit 1;
  if tid is null then raise notice 'seed skipped: tenant BROZKY99 not found'; return; end if;
  select count(*) into n from public.employees e where e.tenant_id = tid and e.deleted_at is null and e.name ilike '%hani%';
  if n <> 1 then raise notice 'seed skipped: % employees match Hani in BROZKY99 (need exactly 1)', n; return; end if;
  select e.id into emp from public.employees e where e.tenant_id = tid and e.deleted_at is null and e.name ilike '%hani%';

  insert into public.svc_comm_settings (tenant_id, employee_id, enabled, pay_basis, work_mode, svc_rate_pct, svc_cap, eligible_status, eligible_leads, prod_rate_pct, bonus_amount, notes)
  values (tid, emp, true, 'monthly_fixed', 'wfh', 5, 10, 'NM', array['TT', 'ADS'], 5, 100, 'Part-time WFH · basic RM900 on the employee record')
  on conflict (tenant_id, employee_id) do nothing;

  if exists (select 1 from public.svc_logs l where l.tenant_id = tid and l.employee_id = emp and l.deleted_at is null
             and l.log_date >= date '2026-10-01' and l.log_date < date '2026-11-01') then
    raise notice 'seed: Oct 2026 logs already exist for Hani — rows not re-inserted';
  else
    insert into public.svc_logs (tenant_id, employee_id, log_date, service, price, client_status, lead_source, week_no, source, created_by)
    select tid, emp, v.d, v.svc, v.price, v.st, v.lead, v.wk, 'seed', null
    from (values
    (date '2026-10-03', 'HAIRCUT (EWAN)', 25, 'NM', 'TT', 1),
    (date '2026-10-03', 'KERATIN', 349, 'M', 'TT', 1),
    (date '2026-10-03', 'HAIRCUT', 45, null, null, 1),
    (date '2026-10-03', 'HAIRCUT', 65, 'NM', 'TT', 1),
    (date '2026-10-04', 'HAIRCUT', 65, 'NM', 'TT', 1),
    (date '2026-10-04', 'KERATIN', 349, 'NM', 'TT', 1),
    (date '2026-10-06', 'HAIRMASK', 99, 'M', 'TT', 1),
    (date '2026-10-06', 'HAIRCUT', 45, 'M', 'TT', 1),
    (date '2026-10-06', 'HAIRCUT', 45, 'M', 'TT', 1),
    (date '2026-10-07', 'KERATIN', 349, 'M', 'TT', 1),
    (date '2026-10-07', 'HAIRCUT', 45, null, null, 1),
    (date '2026-10-08', 'HAIRCUT', 45, 'M', 'TT', 2),
    (date '2026-10-09', 'KERATIN', 349, 'NM', 'TT', 2),
    (date '2026-10-09', 'HAIRCUT', 45, 'M', 'TT', 2),
    (date '2026-10-10', 'HAIRCUT', 65, 'NM', 'TT', 2),
    (date '2026-10-10', 'HAIRCUT', 65, 'NM', 'TT', 2),
    (date '2026-10-11', 'HAIRCUT', 65, 'NM', null, 2),
    (date '2026-10-11', 'HAIRCUT', 65, 'NM', null, 2),
    (date '2026-10-13', 'HAIRCUT', 65, 'NM', null, 2),
    (date '2026-10-13', 'SCALP TREATMENT', 559, 'M', null, 2),
    (date '2026-10-13', 'KERATIN', null, null, null, 2),
    (date '2026-10-13', 'SCALP TREATMENT', 99, 'M', null, 2),
    (date '2026-10-13', 'HAIRCUT', 65, 'NM', null, 2),
    (date '2026-10-14', 'HAIRCUT', 65, 'NM', 'TT', 3),
    (date '2026-10-14', 'HAIRCUT', 65, 'NM', 'TT', 3),
    (date '2026-10-15', 'STYLING', 25, 'M', 'TT', 3),
    (date '2026-10-16', 'HAIRCUT', 65, 'NM', 'TT', 3),
    (date '2026-10-17', 'HAIRCUT', 65, 'NM', 'TT', 3),
    (date '2026-10-17', 'HAIRCUT', 65, 'NM', 'TT', 3),
    (date '2026-10-17', 'KERATIN', 349, 'NM', 'ADS', 3),
    (date '2026-10-18', 'HAIRCUT', 65, 'NM', 'TT', 3),
    (date '2026-10-18', 'HAIRCUT', 45, 'M', 'TT', 3),
    (date '2026-10-18', 'HAIRCUT', 65, 'NM', 'TT', 3),
    (date '2026-10-18', 'HAIRCUT', 65, 'NM', 'TT', 3),
    (date '2026-10-20', 'SCALP TREATMENT', 150, 'NM', 'TT', 3),
    (date '2026-10-20', 'KERATIN', 349, 'NM', 'TT', 3),
    (date '2026-10-21', 'HAIRCUT', 45, 'M', 'TT', 4),
    (date '2026-10-21', 'HAIRCUT', 65, 'NM', 'TT', 4),
    (date '2026-10-21', 'SCALP + KERATIN', 624, 'NM', 'TT', 4),
    (date '2026-10-21', 'HAIRCUT', null, null, null, 4),
    (date '2026-10-21', 'HAIRCUT', 45, 'M', 'TT', 4),
    (date '2026-10-22', 'HAIRCUT', 65, 'NM', 'TT', 4),
    (date '2026-10-22', 'HAIRCUT', 65, 'NM', 'TT', 4),
    (date '2026-10-22', 'HAIRCUT', 45, 'M', 'TT', 4),
    (date '2026-10-23', 'KERATIN', 349, 'NM', 'TT', 4),
    (date '2026-10-24', 'HAIRCUT', 65, 'NM', 'TT', 4),
    (date '2026-10-25', 'KERATIN', 349, 'NM', 'TT', 4),
    (date '2026-10-25', 'KERATIN', 349, 'NM', 'TT', 4),
    (date '2026-10-25', 'HAIRCUT', 65, 'NM', 'TT', 4),
    (date '2026-10-25', 'KERATIN', 349, 'NM', 'TT', 4),
    (date '2026-10-27', 'HAIRCUT', 65, 'NM', 'TT', 5),
    (date '2026-10-27', 'SCALP KERATIN', 559, 'M', 'TT', 5),
    (date '2026-10-28', 'HAIRCUT', 65, 'NM', 'TT', 5),
    (date '2026-10-28', 'HAIRCUT', 65, 'NM', 'TT', 5),
    (date '2026-10-28', 'HAIRCUT', 65, 'NM', 'TT', 5),
    (date '2026-10-29', 'KERATIN', 499, 'NM', 'TT', 5),
    (date '2026-10-29', 'HAIRCUT', 65, 'NM', 'TT', 5),
    (date '2026-10-30', 'HAIRCUT', 65, 'NM', 'TT', 5),
    (date '2026-10-30', 'HAIRCUT', 65, 'NM', 'TT', 5),
    (date '2026-10-30', 'HAIRCUT', 65, 'NM', 'TT', 5),
    (date '2026-10-31', 'KERATIN', 499, 'NM', 'TT', 5),
    (date '2026-10-31', 'HAIRCUT', 65, 'NM', 'TT', 5),
    (date '2026-10-31', 'KERATIN', 499, 'NM', 'TT', 5),
    (date '2026-10-31', 'HAIRCUT', 65, 'NM', 'TT', 5)    ) as v(d, svc, price, st, lead, wk);
  end if;

  insert into public.svc_comm_months (tenant_id, employee_id, month, year, status, product_sales, product_note, bonus_on, created_by)
  values (tid, emp, 10, 2026, 'draft', 1589, 'Moisturizer x7 RM455 · Hairmask x4 RM356 · Shampoo x2 RM178 · Keratin x1 RM600', false, null)
  on conflict (tenant_id, employee_id, year, month) do nothing;

  -- draft snapshot (Owner still reviews + toggles the bonus + approves in the app)
  c := public.svc__calc(tid, emp, 10, 2026);
  update public.svc_comm_months set svc_heads = (c->>'heads')::int, svc_commission = (c->>'svc_commission')::numeric,
    prod_commission = (c->>'prod_commission')::numeric, bonus = (c->>'bonus')::numeric,
    commission_total = (c->>'commission_total')::numeric, flags = (c->>'flags')::int, rates = c->'rates'
  where tenant_id = tid and employee_id = emp and year = 2026 and month = 10 and status = 'draft';
  raise notice 'seed: Hani Oct 2026 → %', c;
end
$seed$;

-- ---------- 7) System Development roadmap ----------
do $rm$
begin
  if to_regclass('public.dev_roadmap_items') is null then raise notice 'roadmap skipped: dev_roadmap_items missing'; return; end if;
  update public.dev_roadmap_items set stage = 'completed', module = 'hr',
    description = 'Part-time service commission: per-employee scheme (service % + cap per head on NM + TT/ADS leads, product %, KPI bonus), Service Log cards (staff log own heads, Owner/HR edit, CSV paste import, weekly/monthly totals, flags for no price / no status / NM without lead), submit → approve (server recompute + lock), approved total flows into Salary Disbursement commission → net pay, journal, payslip breakdown (Komisen servis / produk / Bonus) + A4 statement with signature boxes. Bell + push on submit / approve / reopen, no amounts.'
  where title = 'Service commission payroll (part-time)';
  insert into public.dev_roadmap_items (title, description, module, stage)
  select 'Service commission payroll (part-time)',
    'Part-time service commission: per-employee scheme (service % + cap per head on NM + TT/ADS leads, product %, KPI bonus), Service Log cards (staff log own heads, Owner/HR edit, CSV paste import, weekly/monthly totals, flags for no price / no status / NM without lead), submit → approve (server recompute + lock), approved total flows into Salary Disbursement commission → net pay, journal, payslip breakdown (Komisen servis / produk / Bonus) + A4 statement with signature boxes. Bell + push on submit / approve / reopen, no amounts.',
    'hr', 'completed'
  where not exists (select 1 from public.dev_roadmap_items where title = 'Service commission payroll (part-time)');
end
$rm$;

notify pgrst, 'reload schema';

-- ---------- 8) checks (read-only) ----------
-- a) objects exist
select to_regclass('public.svc_comm_settings') as settings, to_regclass('public.svc_logs') as logs, to_regclass('public.svc_comm_months') as months,
       to_regprocedure('public.svc_comm_approve(uuid,integer,integer,numeric,boolean)') as approve_fn,
       to_regprocedure('public.dk__notify(uuid,text[],uuid[],uuid,text,text,text,text,text,jsonb,text,uuid,text)') as notify_fn;
-- b) RLS on + policies
select c.relname, c.relrowsecurity, count(p.polname) as policies
from pg_class c left join pg_policy p on p.polrelid = c.oid
where c.relname in ('svc_comm_settings', 'svc_logs', 'svc_comm_months') group by 1, 2 order by 1;
-- c) Hani Oct 2026: expect rows 64 · heads 41 · svc 216.50 · product 79.45 · bonus 0 (100 when on) · flags 8
select t.code, e.name, x.*
from public.tenants t join public.employees e on e.tenant_id = t.id and e.deleted_at is null and e.name ilike '%hani%'
cross join lateral (select public.svc__calc(t.id, e.id, 10, 2026) as calc) x
where upper(t.code) = 'BROZKY99';
-- d) month rows
select m.year, m.month, m.status, m.svc_heads, m.svc_commission, m.prod_commission, m.bonus, m.commission_total, m.flags
from public.svc_comm_months m join public.tenants t on t.id = m.tenant_id
where upper(t.code) = 'BROZKY99' and m.deleted_at is null order by m.year desc, m.month desc;
-- e) roadmap
select title, module, stage from public.dev_roadmap_items where title = 'Service commission payroll (part-time)';
