-- ============================================================================
-- DEMO TENANT — PART 1b: FIX for complete_onboarding() "Unauthorized" error
-- Run this AFTER demo_tenant_01_bootstrap.sql (Steps 1-3 already succeeded;
-- Step 4 failed because complete_onboarding() checks auth.uid() = the owner's
-- own session, which doesn't exist when run from the SQL Editor).
--
-- This replaces Steps 4-7 with the SAME effect, done directly instead of via
-- the RPC (no app-session auth check needed for a direct UPDATE/INSERT).
-- Safe to re-run (idempotent).
-- ============================================================================

-- ---------- STEP 4 (fixed): company profile + fiscal year, done directly ----------
do $$
declare
  v_tenant_id uuid;
begin
  select id into v_tenant_id from tenants where code = 'DEMO';
  if v_tenant_id is null then
    raise exception 'tenant code DEMO not found — run demo_tenant_01_bootstrap.sql first';
  end if;

  if exists (select 1 from tenants where id = v_tenant_id and onboarding_done = true) then
    raise notice 'onboarding already completed for DEMO, skipped';
  else
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
  end if;
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
    raise exception 'demo.staff@mpflemedia.my not found in auth.users — run demo_tenant_01_bootstrap.sql Step 1 first';
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
