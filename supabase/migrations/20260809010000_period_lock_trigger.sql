-- Server-side enforcement for the accounting period lock.
--
-- Until this migration, "books lock" was purely client-side: app/index.html's
-- assertNotPeriodLocked() checked the lock date (previously localStorage,
-- now tenants.config->>'books_lock_date' — see the same commit that added
-- this file) before every call site that posts a journal entry, saves an
-- invoice, or records a payment. That's real protection against an ordinary
-- user in the app UI, but it can never be a real security boundary: anyone
-- with a valid session token can call the Supabase REST/JS API directly and
-- insert into any of these tables without the app's JS ever running. A
-- closed period isn't actually closed until the database itself refuses
-- the write.
--
-- Stored in tenants.config->>'books_lock_date' rather than a dedicated
-- column, matching how role permissions already live in config->'roles'
-- for this same table (see _rpSave in app/index.html) — one JSONB blob for
-- tenant-wide settings, not a new column per setting.
--
-- BEFORE INSERT triggers (not RLS policies) are used deliberately: this
-- check needs a cross-table lookup (tenants.config) with a clear, specific
-- error message telling the caller WHY the insert failed and through what
-- date the books are locked — an RLS policy violation returns a generic
-- "new row violates row-level security policy" with no such detail.
--
-- Scope: the tables assertNotPeriodLocked guards client-side today (grep
-- app/index.html for its call sites, including the _pvMarkPaid one added
-- alongside this migration) — journal_entries, invoices (issue_date),
-- payments (payment_date), and supplier_payments (payment_date, written by
-- _pvMarkPaid for a bill-linked Payment Voucher). INSERT only, on each
-- table's own date column. This closes the biggest gap (creating a NEW
-- backdated record via a direct API call, bypassing the app entirely) but
-- deliberately does NOT cover UPDATE — editing an existing row's date into
-- a locked period, or editing any other field of an already-posted row
-- inside one, is still only guarded by the client-side check today. Treat
-- this as a real, known limitation, not full coverage.
--
-- Every ::date cast below is wrapped in its own exception handler that
-- treats a malformed books_lock_date as "no lock" rather than propagating
-- the cast error — merge_tenant_config (further down) validates the format
-- before writing, but that's not the only way this column can ever be set
-- (direct SQL, a future code path, manual editing), and a bad value here
-- must never turn into a hard failure on every single journal/invoice/
-- payment insert for the whole tenant. Fail open on a malformed SETTING,
-- fail closed on an actual locked date — those are different failure modes
-- and only the second one is the point of this feature.

create or replace function public.assert_period_not_locked_journal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_lock text;
  lock_date date;
begin
  select t.config->>'books_lock_date' into raw_lock
  from public.tenants t
  where t.id = new.tenant_id;

  begin
    lock_date := raw_lock::date;
  exception when others then
    lock_date := null;
  end;

  if lock_date is not null and new.entry_date <= lock_date then
    raise exception 'Books locked through %. Cannot post a journal entry dated on or before this date.', lock_date
      using errcode = '23514'; -- check_violation, so client error handling (e.g. Supabase's error.code) can distinguish this from a generic failure
  end if;

  return new;
end;
$$;

drop trigger if exists trg_assert_period_not_locked on public.journal_entries;
create trigger trg_assert_period_not_locked
  before insert on public.journal_entries
  for each row execute function public.assert_period_not_locked_journal();

create or replace function public.assert_period_not_locked_invoice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_lock text;
  lock_date date;
begin
  select t.config->>'books_lock_date' into raw_lock
  from public.tenants t
  where t.id = new.tenant_id;

  begin
    lock_date := raw_lock::date;
  exception when others then
    lock_date := null;
  end;

  if lock_date is not null and new.issue_date <= lock_date then
    raise exception 'Books locked through %. Cannot create an invoice dated on or before this date.', lock_date
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_assert_period_not_locked on public.invoices;
create trigger trg_assert_period_not_locked
  before insert on public.invoices
  for each row execute function public.assert_period_not_locked_invoice();

create or replace function public.assert_period_not_locked_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_lock text;
  lock_date date;
begin
  select t.config->>'books_lock_date' into raw_lock
  from public.tenants t
  where t.id = new.tenant_id;

  begin
    lock_date := raw_lock::date;
  exception when others then
    lock_date := null;
  end;

  if lock_date is not null and new.payment_date <= lock_date then
    raise exception 'Books locked through %. Cannot record a payment dated on or before this date.', lock_date
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_assert_period_not_locked on public.payments;
create trigger trg_assert_period_not_locked
  before insert on public.payments
  for each row execute function public.assert_period_not_locked_payment();

-- supplier_payments isn't one of assertNotPeriodLocked's original call
-- sites, but _pvMarkPaid (app/index.html) inserts into it as part of
-- marking a bill-linked Payment Voucher paid, guarded by the same
-- assertNotPeriodLocked(voucherDate) check added alongside this migration
-- (see that function's comment) — without a matching trigger here, that
-- write path would have real client-side protection but zero server-side
-- backstop, unlike payments/invoices/journal_entries above.
create or replace function public.assert_period_not_locked_supplier_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_lock text;
  lock_date date;
begin
  select t.config->>'books_lock_date' into raw_lock
  from public.tenants t
  where t.id = new.tenant_id;

  begin
    lock_date := raw_lock::date;
  exception when others then
    lock_date := null;
  end;

  if lock_date is not null and new.payment_date <= lock_date then
    raise exception 'Books locked through %. Cannot record a supplier payment dated on or before this date.', lock_date
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_assert_period_not_locked on public.supplier_payments;
create trigger trg_assert_period_not_locked
  before insert on public.supplier_payments
  for each row execute function public.assert_period_not_locked_supplier_payment();

-- Atomic merge helper for tenants.config, used by _tenantConfigPatch in
-- app/index.html (role permissions save, books_lock_date save, and any
-- future tenant-wide setting stored in this same JSONB blob). A single
-- `config = config || patch` UPDATE done entirely inside Postgres closes
-- the TOCTOU race a client-side SELECT-then-merge-then-UPDATE always has:
-- two concurrent callers patching DIFFERENT keys (e.g. one saving role
-- permissions while another sets the period lock) can now never clobber
-- each other, because Postgres's own row-level locking serializes the two
-- UPDATEs — whichever runs second reads the FIRST one's already-committed
-- config as its starting point, not a stale pre-fetched copy.
--
-- SECURITY DEFINER bypasses RLS on tenants entirely, so this function MUST
-- do its own authorization — without the checks below, ANY authenticated
-- user (any tenant, any role) could pass an arbitrary p_tenant_id and
-- silently rewrite another tenant's config, including config->'roles'
-- (every role's module permissions) and now config->>'books_lock_date'.
-- Restricted to owner/admin of the SAME tenant being patched, matching the
-- client-side isAdmin gate the Settings UI already puts around every
-- caller of this (Role Permissions, Period Lock) — client-side gating
-- alone is never a real boundary, per this repo's own security rule.
--
-- Also validates books_lock_date's format specifically when the patch sets
-- it (rather than accepting arbitrary jsonb blindly) — app/index.html's
-- setBooksLockDate() already checks this client-side too, but this is the
-- one write path that's actually enforced: a malformed value here would
-- get ::date-cast inside the three trigger functions above on every single
-- future journal/invoice/payment insert for the tenant. Those casts are
-- defensively wrapped to fail open rather than hard-break the tenant's
-- accounting either way, but rejecting a bad value at write time (a clear
-- error to the one admin trying to set it) is far better than silently
-- storing it and only ever finding out via that fallback behavior.
create or replace function public.merge_tenant_config(p_tenant_id uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_tenant_id uuid;
  caller_role text;
  caller_email text;
  result jsonb;
begin
  select tenant_id, role into caller_tenant_id, caller_role
  from public.user_profiles
  where id = auth.uid();

  if caller_tenant_id is null or caller_tenant_id != p_tenant_id then
    raise exception 'Not authorized to modify this tenant''s config' using errcode = '42501';
  end if;

  -- Mirrors isPlatformAdmin() in app/index.html: owner/admin OR a
  -- recognized Phion/MPFLE operator (role='platform_admin', or an email
  -- containing "mpflemedia"/"phion") also passes — that's how the app's
  -- own admin panels (Role Permissions, Period Lock, Company Profile TIN)
  -- are gated client-side (isTenantAdmin() = isAdmin() || isPlatformAdmin()),
  -- so this RPC needs the same allowance or a legitimate platform-admin
  -- support session would see every save from those panels start failing
  -- with 'Only owner/admin' the moment this migration ships. The one part
  -- of isPlatformAdmin() NOT replicated here is its localStorage flag
  -- check — that's a purely client-side, self-asserted toggle with no
  -- server-side equivalent, and not replicating it only tightens this
  -- specific privileged operation, it doesn't break the intended cases.
  -- coalesce(caller_role, '') — NOT the bare column — deliberately, because
  -- `NULL NOT IN (...)` evaluates to SQL NULL (not TRUE), and plpgsql's IF
  -- treats a NULL condition as FALSE: a caller with role IS NULL (a state
  -- canAccess() in app/index.html explicitly anticipates, `if(!role) return
  -- false`) would silently skip this whole authorization block and fall
  -- straight through to the UPDATE — a real privilege-escalation bug this
  -- fixes, not just style.
  if coalesce(caller_role, '') not in ('owner', 'admin', 'platform_admin') then
    select email into caller_email from auth.users where id = auth.uid();
    if caller_email is null or not (
      caller_email ilike '%mpflemedia%' or caller_email ilike '%phion%'
    ) then
      raise exception 'Only owner/admin can modify tenant config' using errcode = '42501';
    end if;
  end if;

  if p_patch ? 'books_lock_date' and p_patch->>'books_lock_date' is not null then
    -- An actual cast attempt, not just a YYYY-MM-DD shape regex — a
    -- shape-valid but calendar-invalid value like '2026-02-30' would pass
    -- a regex, get stored, and then be silently treated as "no lock" by
    -- the trigger functions' own fail-open exception handling (see their
    -- comment above), leaving an admin who believes the books are locked
    -- with no actual enforcement and no error telling them why.
    begin
      perform (p_patch->>'books_lock_date')::date;
    exception when others then
      raise exception 'Invalid books_lock_date: % is not a valid date', p_patch->>'books_lock_date'
        using errcode = '22007'; -- invalid_datetime_format
    end;
  end if;

  update public.tenants
  set config = coalesce(config, '{}'::jsonb) || p_patch
  where id = p_tenant_id
  returning config into result;

  return result;
end;
$$;

-- Without this, PostgREST refuses to let any client call the function at
-- all (permission denied, not a missing-function error) — every other
-- client-callable RPC in this repo's migrations grants this explicitly
-- (join_tenant_by_invite, get_public_invoice, get_public_quotation), EXECUTE
-- is not granted by default in this database. The function's own
-- owner/admin + same-tenant checks above are what actually authorize a
-- specific call; this grant only makes the function reachable at all.
GRANT EXECUTE ON FUNCTION public.merge_tenant_config(uuid, jsonb) TO authenticated;
