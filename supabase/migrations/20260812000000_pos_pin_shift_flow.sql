-- Staff PIN clock-in for the POS "Open Shift" flow (set staff name +
-- password/PIN > confirm float > start shift). PINs identify which
-- EMPLOYEE physically ran the till on a shared POS terminal; they are
-- deliberately separate from Supabase Auth (pos_sessions.cashier_id stays
-- the authenticated app account, unchanged) — employees don't necessarily
-- have their own app login, but they always have an employees row.

create extension if not exists pgcrypto;

alter table employees add column if not exists pos_pin_hash text;
alter table pos_sessions add column if not exists employee_id uuid references employees(id);

-- Sets/resets a staff member's POS clock-in PIN. Owner/admin (or a
-- recognized Phion/MPFLE platform operator) only — mirrors the same
-- authorization pattern as merge_tenant_config
-- (20260809010000_period_lock_trigger.sql): SECURITY DEFINER bypasses RLS,
-- so the function does its own tenant + role check instead of relying on
-- a client-side gate, which is never a real security boundary on its own.
create or replace function public.set_employee_pos_pin(p_employee_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  caller_tenant_id uuid;
  caller_role text;
  caller_email text;
  emp_tenant_id uuid;
begin
  select tenant_id, role into caller_tenant_id, caller_role
  from public.user_profiles where id = auth.uid();

  if caller_tenant_id is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if coalesce(caller_role, '') not in ('owner', 'admin', 'platform_admin') then
    select email into caller_email from auth.users where id = auth.uid();
    if caller_email is null or not (
      caller_email ilike '%mpflemedia%' or caller_email ilike '%phion%'
    ) then
      raise exception 'Only owner/admin can set a staff PIN' using errcode = '42501';
    end if;
  end if;

  select tenant_id into emp_tenant_id from public.employees where id = p_employee_id;
  if emp_tenant_id is null or emp_tenant_id != caller_tenant_id then
    raise exception 'Employee not found in this tenant' using errcode = '42501';
  end if;

  if p_pin is null or p_pin !~ '^[0-9]{4,6}$' then
    raise exception 'PIN must be 4-6 digits' using errcode = '22023';
  end if;

  update public.employees
  set pos_pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf'))
  where id = p_employee_id;
end;
$$;

grant execute on function public.set_employee_pos_pin(uuid, text) to authenticated;

-- Verifies a PIN for shift clock-in. Tenant-scoped against the CALLER's own
-- user_profiles row (not trusted blindly from client input), so one
-- tenant's cashier can never probe another tenant's employee PINs by
-- guessing employee ids. Returns only {id, name} on success — never the
-- hash, and never a bare boolean, which would let a caller brute-force PINs
-- without even confirming which employee they hit.
create or replace function public.verify_employee_pos_pin(p_employee_id uuid, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  caller_tenant_id uuid;
  emp record;
begin
  select tenant_id into caller_tenant_id from public.user_profiles where id = auth.uid();
  if caller_tenant_id is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select id, name, pos_pin_hash into emp
  from public.employees
  where id = p_employee_id and tenant_id = caller_tenant_id and deleted_at is null;

  if emp.id is null then
    raise exception 'Staff not found' using errcode = '42501';
  end if;

  if emp.pos_pin_hash is null then
    raise exception 'No PIN set for this staff member. Ask an admin to set one.' using errcode = '42501';
  end if;

  if extensions.crypt(p_pin, emp.pos_pin_hash) != emp.pos_pin_hash then
    raise exception 'Incorrect PIN' using errcode = '42501';
  end if;

  return jsonb_build_object('id', emp.id, 'name', emp.name);
end;
$$;

grant execute on function public.verify_employee_pos_pin(uuid, text) to authenticated;
