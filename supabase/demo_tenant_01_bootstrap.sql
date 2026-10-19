-- ============================================================================
-- DEMO TENANT — PART 1: BOOTSTRAP (auth users + tenant + onboarding + COA)
-- Run this FIRST, in full, in Supabase SQL Editor.
-- Safe to re-run: every step checks "if not exists" before creating anything.
--
-- Creates:
--   - 2 login accounts (owner + staff), password for both: mcore123
--       owner: demo.owner@mpflemedia.my
--       staff: demo.staff@mpflemedia.my
--   - Tenant "Maju Trading Sdn Bhd", code DEMO, plan=pro (unlocks all modules)
--   - Onboarding completed (company profile + fiscal year 2026)
--   - Full Chart of Accounts (seed_chart_of_accounts default_my template)
--   - is_demo flag on tenants (new column, additive, default false)
--
-- NOTE on the auth.users/auth.identities insert below: this is the standard
-- community recipe for creating a Supabase Auth user via raw SQL (bcrypt via
-- pgcrypto + a matching auth.identities row for the email provider). I have
-- NOT seen this pattern used anywhere else in this repo, so it is not
-- verified against your specific Supabase project version. If login fails
-- after running this, the fallback is simple: create the 2 users manually via
-- Supabase Dashboard -> Authentication -> Add User (same emails/password),
-- then just re-run this whole script again — the "if not exists" guards will
-- skip user creation and continue correctly with the tenant/onboarding steps.
-- ============================================================================

-- ---------- STEP 1: create the 2 login accounts ----------
do $$
declare
  v_owner_id uuid;
  v_staff_id uuid;
begin
  if not exists (select 1 from auth.users where email = 'demo.owner@mpflemedia.my') then
    v_owner_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_owner_id, 'authenticated', 'authenticated',
      'demo.owner@mpflemedia.my', crypt('mcore123', gen_salt('bf')),
      now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_owner_id, v_owner_id::text,
      jsonb_build_object('sub', v_owner_id::text, 'email', 'demo.owner@mpflemedia.my'),
      'email', now(), now(), now());
    raise notice 'created demo.owner@mpflemedia.my (%)', v_owner_id;
  else
    raise notice 'demo.owner@mpflemedia.my already exists, skipped';
  end if;

  if not exists (select 1 from auth.users where email = 'demo.staff@mpflemedia.my') then
    v_staff_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_staff_id, 'authenticated', 'authenticated',
      'demo.staff@mpflemedia.my', crypt('mcore123', gen_salt('bf')),
      now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_staff_id, v_staff_id::text,
      jsonb_build_object('sub', v_staff_id::text, 'email', 'demo.staff@mpflemedia.my'),
      'email', now(), now(), now());
    raise notice 'created demo.staff@mpflemedia.my (%)', v_staff_id;
  else
    raise notice 'demo.staff@mpflemedia.my already exists, skipped';
  end if;
end $$;

-- ---------- STEP 2: create the tenant (owner = demo.owner@mpflemedia.my) ----------
do $$
declare
  v_owner_id uuid;
  v_result jsonb;
begin
  if exists (select 1 from tenants where code = 'DEMO') then
    raise notice 'tenant code DEMO already exists, skipped register_tenant()';
    return;
  end if;

  select id into v_owner_id from auth.users where email = 'demo.owner@mpflemedia.my';
  if v_owner_id is null then
    raise exception 'demo.owner@mpflemedia.my not found in auth.users — Step 1 must succeed first';
  end if;

  v_result := register_tenant(
    v_owner_id,
    'Maju Trading Sdn Bhd',
    'DEMO',
    'Demo Owner',
    'sdn_bhd',
    'retail',
    'pro'
  );
  raise notice 'register_tenant result: %', v_result;
end $$;

-- ---------- STEP 3: tag as demo + clear trial status (so it never "expires") ----------
alter table public.tenants add column if not exists is_demo boolean not null default false;

update public.tenants
set is_demo = true,
    is_trial = false,
    trial_ends_at = null
where code = 'DEMO';

-- ---------- STEP 4: company profile + fiscal year 2026 ----------
-- NOTE: complete_onboarding() itself checks auth.uid() = the owner's own
-- session (it's designed to be called from the app while the owner is
-- logged in), which is null when run from the SQL Editor -> raises
-- "Unauthorized". So this does the exact same thing directly instead
-- (confirmed from the RPC's real source: UPDATE tenants + INSERT
-- fiscal_years), which needs no session auth.
do $$
declare
  v_tenant_id uuid;
begin
  select id into v_tenant_id from tenants where code = 'DEMO';
  if v_tenant_id is null then
    raise exception 'tenant code DEMO not found — Step 2 must succeed first';
  end if;
  if exists (select 1 from tenants where id = v_tenant_id and onboarding_done = true) then
    raise notice 'onboarding already completed for DEMO, skipped';
    return;
  end if;

  update tenants set
    legal_name      = 'Maju Trading Sdn Bhd',
    reg_no          = '202601012345',
    tax_no          = 'C12345678000',
    email           = 'demo@majutrading.my',
    phone           = '+603-78881234',
    address_line1   = 'No. 12, Jalan Perniagaan 5',
    address_line2   = 'Taman Perindustrian Maju',
    city            = 'Shah Alam',
    state           = 'Selangor',
    postcode        = '40150',
    sst_registered  = true,
    onboarding_done = true
  where id = v_tenant_id;

  if not exists (select 1 from fiscal_years where tenant_id = v_tenant_id) then
    insert into fiscal_years (tenant_id, year_label, start_date, end_date, is_current)
    values (v_tenant_id, '2026', '2026-01-01', '2026-12-31', true);
  end if;

  raise notice 'onboarding completed directly for tenant %', v_tenant_id;
end $$;

-- ---------- STEP 5: seed Chart of Accounts ----------
do $$
declare
  v_tenant_id uuid;
  v_count int;
begin
  select id into v_tenant_id from tenants where code = 'DEMO';
  if exists (select 1 from chart_of_accounts where tenant_id = v_tenant_id) then
    raise notice 'chart_of_accounts already seeded for DEMO, skipped';
    return;
  end if;
  v_count := seed_chart_of_accounts(v_tenant_id, 'default_my');
  raise notice 'seeded % chart_of_accounts rows', v_count;
end $$;

-- ---------- STEP 6: add staff as a second user_profile on the same tenant ----------
do $$
declare
  v_tenant_id uuid;
  v_branch_id uuid;
  v_staff_id uuid;
begin
  select id into v_tenant_id from tenants where code = 'DEMO';
  select id into v_branch_id from branches where tenant_id = v_tenant_id and is_hq = true;
  select id into v_staff_id from auth.users where email = 'demo.staff@mpflemedia.my';

  if v_staff_id is null then
    raise exception 'demo.staff@mpflemedia.my not found in auth.users — Step 1 must succeed first';
  end if;
  if exists (select 1 from user_profiles where id = v_staff_id) then
    raise notice 'user_profiles row for staff already exists, skipped';
    return;
  end if;

  insert into user_profiles (id, tenant_id, branch_id, full_name, role)
  values (v_staff_id, v_tenant_id, v_branch_id, 'Demo Staff', 'staff');
  raise notice 'staff user_profile created for tenant %', v_tenant_id;
end $$;

-- ---------- STEP 7: sanity check — confirm everything landed ----------
select
  t.id as tenant_id, t.code, t.name, t.legal_name, t.is_demo, t.is_trial, t.onboarding_done,
  (select count(*) from branches b where b.tenant_id = t.id) as branches,
  (select count(*) from user_profiles up where up.tenant_id = t.id) as user_profiles,
  (select count(*) from chart_of_accounts coa where coa.tenant_id = t.id) as coa_rows,
  (select count(*) from fiscal_years fy where fy.tenant_id = t.id) as fiscal_years
from tenants t
where t.code = 'DEMO';
