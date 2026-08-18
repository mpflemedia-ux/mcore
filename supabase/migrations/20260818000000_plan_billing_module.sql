-- Plan/Billing module: plan catalog, tenant plan assignment, usage tracking
-- (soft-warning only, no hard blocking), and platform-wide announcements.
--
-- SAFETY: this migration must not be able to cap or block anything for any
-- tenant currently in the system. Every existing tenant is grandfathered to
-- the 'unlimited' plan (all limits null) in step 3 below, and nothing in
-- this file (or any later phase of this feature) adds enforcement logic —
-- limits are read-only reference data for soft warnings until a human
-- explicitly wires blocking behavior in a future migration.
--
-- KNOWN GAPS (flagged, not invented): the landing page pricing section does
-- not advertise a monthly_transaction_limit OR an ai_daily_quota for the
-- Free plan (no "X transactions/month" or "X AI queries/day" bullet on that
-- card, unlike Starter/Business/Pro which list both). Both are left null
-- (=unlimited) below rather than guessed — flag back before relying on
-- either number for the Free tier.

-- ---------- 1) plans ----------
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_en text not null,
  name_bm text not null,
  monthly_price numeric(10,2) null,
  annual_price numeric(10,2) null,
  setup_fee numeric(10,2) null,
  max_branches int null, -- null = unlimited
  monthly_transaction_limit int null, -- null = unlimited
  ai_daily_quota int null, -- null = unlimited
  created_at timestamptz not null default now()
);

insert into public.plans (code, name_en, name_bm, monthly_price, annual_price, setup_fee, max_branches, monthly_transaction_limit, ai_daily_quota)
values
  ('free', 'Free', 'Percuma', 0, 0, 0, 1, null, null),
  ('starter', 'Starter', 'Starter', 99, 990, 300, 1, 500, 100),
  ('business', 'Business', 'Business', 199, 1990, 500, 3, 2500, 500),
  ('pro', 'Pro', 'Pro', 349, 3490, 800, 10, null, 2000),
  ('unlimited', 'Unlimited (Legacy)', 'Tanpa Had (Legasi)', null, null, null, null, null, null)
on conflict (code) do nothing;

-- Reference data — every authenticated user can read the plan catalog
-- (needed client-side to render plan names/limits), nobody writes it via
-- the API (seeded above; future plan changes are a manual migration).
alter table public.plans enable row level security;
drop policy if exists plans_select_all on public.plans;
create policy plans_select_all on public.plans for select to authenticated using (true);

-- ---------- 2) tenants.plan_id — reuse existing column, add FK ----------
-- tenants.plan_id (uuid) already exists in the live DB (flagged as an
-- orphaned/dead column in an earlier verification pass — zero references
-- anywhere in app code or migrations up to now). This is the column that
-- orphaned status ends here: it becomes the real FK to plans(id).
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'tenants_plan_id_fkey' and table_name = 'tenants'
  ) then
    alter table public.tenants
      add constraint tenants_plan_id_fkey foreign key (plan_id) references public.plans(id);
  end if;
end $$;

-- ---------- 3) backfill: grandfather every existing tenant to Unlimited ----------
-- Covers all tenants currently in the system (24 at time of writing) —
-- anyone with a null plan_id gets the no-limits legacy plan, never a capped
-- one, so this migration cannot newly restrict an existing tenant.
update public.tenants
set plan_id = (select id from public.plans where code = 'unlimited')
where plan_id is null;

-- ---------- 4) tenant_usage_monthly ----------
create table if not exists public.tenant_usage_monthly (
  tenant_id uuid not null,
  year int not null,
  month int not null,
  transaction_count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, year, month)
);

alter table public.tenant_usage_monthly enable row level security;
drop policy if exists tenant_usage_monthly_select on public.tenant_usage_monthly;
create policy tenant_usage_monthly_select on public.tenant_usage_monthly for select to authenticated
  using (
    tenant_id = (select tenant_id from public.user_profiles where id = auth.uid())
    or exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'platform_admin')
  );
-- No INSERT/UPDATE/DELETE policy for the authenticated role — every write
-- happens exclusively through increment_monthly_transaction_usage() below
-- (SECURITY DEFINER, derives the caller's own tenant server-side so a
-- client can never inflate another tenant's usage counter).

-- ---------- 5) tenant_usage_daily ----------
create table if not exists public.tenant_usage_daily (
  tenant_id uuid not null,
  usage_date date not null,
  ai_queries_count int not null default 0,
  created_at timestamptz not null default now(),
  primary key (tenant_id, usage_date)
);

alter table public.tenant_usage_daily enable row level security;
drop policy if exists tenant_usage_daily_select on public.tenant_usage_daily;
create policy tenant_usage_daily_select on public.tenant_usage_daily for select to authenticated
  using (
    tenant_id = (select tenant_id from public.user_profiles where id = auth.uid())
    or exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'platform_admin')
  );
-- Same append-only-via-RPC reasoning as tenant_usage_monthly above — see
-- increment_ai_daily_usage() below.

-- ---------- 6) platform_announcements ----------
create table if not exists public.platform_announcements (
  id uuid primary key default gen_random_uuid(),
  message_en text not null,
  message_bm text not null,
  severity text not null default 'info' check (severity in ('info', 'warning')),
  created_by uuid null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz null,
  is_active boolean not null default true
);

alter table public.platform_announcements enable row level security;
drop policy if exists platform_announcements_select on public.platform_announcements;
create policy platform_announcements_select on public.platform_announcements for select to authenticated
  using (is_active = true and (expires_at is null or expires_at > now()));
-- Insert/update happens only through create_announcement() below (platform_admin only).

-- ---------- 7) platform_admin_audit: extend action list + add details column ----------
-- Plan assignment and announcement creation are platform_admin actions on
-- the same append-only trail suspend_tenant/reactivate_tenant already
-- write to (20260817220000_platform_admin_tenant_status.sql) — extending
-- that one trail rather than starting a second one.
alter table public.platform_admin_audit drop constraint if exists platform_admin_audit_action_check;
alter table public.platform_admin_audit add constraint platform_admin_audit_action_check
  check (action in ('suspend_tenant', 'reactivate_tenant', 'set_tenant_plan', 'create_announcement'));

alter table public.platform_admin_audit add column if not exists details text;

-- create_announcement (below) is not scoped to any single tenant, so
-- target_tenant_id must be nullable for that one action — the original
-- migration had it not-null because suspend/reactivate always target one.
alter table public.platform_admin_audit alter column target_tenant_id drop not null;

-- ---------- 8) set_tenant_plan — platform_admin assigns a tenant's plan ----------
create or replace function public.set_tenant_plan(p_tenant_id uuid, p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  caller_role text;
  caller_email text;
  tenant_name text;
  old_plan_code text;
  new_plan_code text;
begin
  select role into caller_role from public.user_profiles where id = auth.uid();
  if coalesce(lower(caller_role), '') <> 'platform_admin' then
    raise exception 'Only platform_admin can change a tenant plan' using errcode = '42501';
  end if;

  select email into caller_email from auth.users where id = auth.uid();
  select name into tenant_name from public.tenants where id = p_tenant_id;
  if tenant_name is null then
    raise exception 'Tenant not found' using errcode = 'P0002';
  end if;

  select p.code into new_plan_code from public.plans p where p.id = p_plan_id;
  if new_plan_code is null then
    raise exception 'Plan not found' using errcode = 'P0002';
  end if;

  select p.code into old_plan_code from public.tenants t join public.plans p on p.id = t.plan_id where t.id = p_tenant_id;

  update public.tenants set plan_id = p_plan_id where id = p_tenant_id;

  insert into public.platform_admin_audit (actor_user_id, actor_email, action, target_tenant_id, target_tenant_name, details)
  values (auth.uid(), caller_email, 'set_tenant_plan', p_tenant_id, tenant_name, coalesce(old_plan_code, '(none)') || ' -> ' || new_plan_code);
end;
$$;

grant execute on function public.set_tenant_plan(uuid, uuid) to authenticated;

-- ---------- 9) increment_monthly_transaction_usage — self-tenant only ----------
-- No tenant_id parameter by design: derives the caller's own tenant from
-- auth.uid() server-side, same reasoning as every other SECURITY DEFINER
-- function in this file — a client-supplied tenant_id could otherwise be
-- used to inflate a different tenant's billing-relevant usage counter.
-- Called fire-and-forget from the app right after a sale is finalized
-- (invoice marked paid / POS checkout) — never allowed to block or fail
-- the sale itself; the caller wraps this in try/catch.
create or replace function public.increment_monthly_transaction_usage()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  caller_tenant uuid;
  y int := extract(year from now())::int;
  m int := extract(month from now())::int;
begin
  select tenant_id into caller_tenant from public.user_profiles where id = auth.uid();
  if caller_tenant is null then return; end if;

  insert into public.tenant_usage_monthly (tenant_id, year, month, transaction_count, updated_at)
  values (caller_tenant, y, m, 1, now())
  on conflict (tenant_id, year, month)
    do update set transaction_count = tenant_usage_monthly.transaction_count + 1, updated_at = now();
end;
$$;

grant execute on function public.increment_monthly_transaction_usage() to authenticated;

-- ---------- 10) increment_ai_daily_usage — self-tenant only ----------
-- Called from the ai-proxy edge function (using the caller's own JWT, not
-- the service role key) right after a successful Groq call — same
-- non-blocking, best-effort contract as increment_monthly_transaction_usage.
create or replace function public.increment_ai_daily_usage()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  caller_tenant uuid;
  d date := current_date;
begin
  select tenant_id into caller_tenant from public.user_profiles where id = auth.uid();
  if caller_tenant is null then return; end if;

  insert into public.tenant_usage_daily (tenant_id, usage_date, ai_queries_count)
  values (caller_tenant, d, 1)
  on conflict (tenant_id, usage_date)
    do update set ai_queries_count = tenant_usage_daily.ai_queries_count + 1;
end;
$$;

grant execute on function public.increment_ai_daily_usage() to authenticated;

-- ---------- 11) create_announcement — platform_admin broadcasts to all tenants ----------
create or replace function public.create_announcement(p_message_en text, p_message_bm text, p_severity text default 'info')
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  caller_role text;
  caller_email text;
  new_id uuid;
begin
  select role into caller_role from public.user_profiles where id = auth.uid();
  if coalesce(lower(caller_role), '') <> 'platform_admin' then
    raise exception 'Only platform_admin can broadcast an announcement' using errcode = '42501';
  end if;
  if coalesce(trim(p_message_en), '') = '' or coalesce(trim(p_message_bm), '') = '' then
    raise exception 'Both message_en and message_bm are required' using errcode = '22023';
  end if;
  if p_severity not in ('info', 'warning') then
    raise exception 'severity must be info or warning' using errcode = '22023';
  end if;

  select email into caller_email from auth.users where id = auth.uid();

  insert into public.platform_announcements (message_en, message_bm, severity, created_by)
  values (p_message_en, p_message_bm, p_severity, auth.uid())
  returning id into new_id;

  insert into public.platform_admin_audit (actor_user_id, actor_email, action, target_tenant_id, target_tenant_name, details)
  values (auth.uid(), caller_email, 'create_announcement', null, null, left(p_message_en, 200));

  return new_id;
end;
$$;

grant execute on function public.create_announcement(text, text, text) to authenticated;
