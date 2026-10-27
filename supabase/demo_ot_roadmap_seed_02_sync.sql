reset role;

-- ============================================================================
-- DEMO TENANT — OT roadmap example data v2: SYNCHRONIZED shift + attendance + OT claim
--
-- Replaces public.reseed_demo_ot_data() (from demo_ot_roadmap_seed_01.sql) with a version
-- that fixes a real bug AND makes the 4 ot_claims examples genuinely derived from real
-- shift+attendance rows, instead of free-floating numbers.
--
-- BUG FIXED: reseed_demo_data()'s "current week attendance" block hardcodes clock_in=09:00/
-- clock_out=18:00 for EVERY employee on EVERY day, ignoring the shift roster it seeds in the
-- very same function (which correctly varies: Delivery Driver=closing 16:00-22:00, Warehouse
-- Supervisor=mid 12:00-20:00, everyone else=morning 09:00-17:00). Result: the Dashboard
-- Shifts widget and People/Attendance widget visibly disagree for the exact same employee on
-- the exact same day (reported with a screenshot). Fixed here with a targeted UPDATE that
-- re-syncs every current-week attendance row to its matching shift's actual hours — without
-- touching reseed_demo_data() itself.
--
-- REAL SYNCHRONIZED EXAMPLE (not arbitrary): 4 ot_claims, each tied to an actual shifts row
-- and an actual attendance row this function also writes (upserted for 4 specific, always-
-- in-the-past dates so the story is self-contained and never depends on what reseed_demo_data()
-- happened to seed for "this week"):
--   - Azman (Delivery Driver, shift=closing 16:00-22:00): clocked 16:00-01:00 (9h) ->
--     1h over the 8h/day baseline -> PENDING claim, awaiting approval.
--   - Mohd Firdaus (Warehouse Supervisor, shift=mid 12:00-20:00): clocked 12:00-22:00 (10h)
--     -> 2h claimed -> Owner APPROVES PARTIAL (trims to 1.5h).
--   - Siti Noraini (Sales Executive, shift=off that Saturday): came in anyway 10:00-16:00 (6h)
--     -> rest-day claim -> APPROVED by the Delegate (demo.staff), proving delegate approval
--     works end-to-end for a DIFFERENT employee.
--   - Nurhidayah (Admin Executive, shift=morning 09:00-17:00): clocked 09:00-18:30 (9.5h)
--     -> 1.5h claimed -> Owner REJECTS with a note (no prior authorization).
-- All hours/rates/amounts below are hand-verified against the exact formula in
-- app/index.html's _otComputeClaim() (Ordinary Rate of Pay: daily = salary/26, hourly =
-- daily/8), not invented numbers.
--
-- Write-only, idempotent, self-cleaning, run once in Supabase SQL Editor. Run AFTER
-- demo_ot_roadmap_seed_01.sql (this REPLACES its reseed_demo_ot_data() definition; no need
-- to run that file again after this one, but running it first is required at least once for
-- reset_demo_tenant()'s call to it to already be wired up).
-- ============================================================================

create or replace function public.reseed_demo_ot_data()
returns jsonb
language plpgsql
security definer
as $fn$
declare
  v_tenant_id uuid;
  v_owner_id uuid;
  v_staff_id uuid;
  v_emp_siti uuid := '00000000-0000-0000-0301-000000000001';
  v_emp_firdaus uuid := '00000000-0000-0000-0301-000000000002';
  v_emp_nurhidayah uuid := '00000000-0000-0000-0301-000000000003';
  v_emp_azman uuid := '00000000-0000-0000-0301-000000000004';
  v_wd1 date; -- most recent past weekday (Azman)
  v_wd2 date; -- next most recent past weekday before v_wd1 (Firdaus)
  v_wd3 date; -- next most recent past weekday before v_wd2 (Nurhidayah)
  v_sat date; -- most recent past Saturday (Siti's rest day worked)
begin
  select id into v_tenant_id from tenants where code = 'DEMO' and is_demo = true and deleted_at is null;
  if v_tenant_id is null then
    raise exception 'Demo tenant (code=DEMO, is_demo=true) not found — run demo_tenant_01_bootstrap.sql first';
  end if;

  select id into v_owner_id from user_profiles where tenant_id = v_tenant_id and role = 'owner' limit 1;
  select id into v_staff_id from user_profiles where tenant_id = v_tenant_id and role = 'staff' limit 1;
  if v_owner_id is null or v_staff_id is null then
    raise exception 'DEMO tenant missing owner/staff user_profiles — run demo_tenant_01_bootstrap.sql first';
  end if;

  -- ---------- self-clean (so re-running, or a Reset Demo click, always restores this
  -- exact example state even if the demo account edited/approved/rejected these rows) ----------
  delete from ot_claims where tenant_id = v_tenant_id;
  delete from public_holidays where tenant_id = v_tenant_id; -- tenant-specific only; global (tenant_id IS NULL) untouched

  -- ---------- Phase 3: tenant-specific public holiday ----------
  insert into public_holidays (tenant_id, holiday_date, title_en, title_bm)
  values (v_tenant_id, make_date(extract(year from CURRENT_DATE)::int, 12, 11),
    'Sultan of Selangor''s Birthday', 'Hari Keputeraan Sultan Selangor');

  -- ---------- Phase 4: Tetapan Gaji & OT — threshold deliberately non-default (RM3,500,
  -- not the RM4,000 JS fallback) so the settings page visibly proves it reads the DB ----------
  insert into tenant_ot_settings (tenant_id, ot_eligible_wage_threshold)
  values (v_tenant_id, 3500)
  on conflict (tenant_id) do update set ot_eligible_wage_threshold = excluded.ot_eligible_wage_threshold;

  -- Per-employee override worked example: Nurhidayah is on probation — business rule is OT
  -- is not auto-approved during probation, despite her wage otherwise qualifying.
  update employees set ot_eligible = false where id = v_emp_nurhidayah and tenant_id = v_tenant_id;
  update employees set ot_eligible = null where tenant_id = v_tenant_id and id not in (v_emp_nurhidayah); -- Auto (wage-threshold) for the rest

  -- ---------- Phase 5-6 setup: OT delegate ----------
  update tenants set config = coalesce(config, '{}'::jsonb) || jsonb_build_object('ot_delegates', jsonb_build_array(v_staff_id::text))
  where id = v_tenant_id;

  -- ---------- BUG FIX: re-sync every current-week attendance row to its matching shift's
  -- actual hours (reseed_demo_data() hardcodes 09:00-18:00 for everyone regardless of shift
  -- kind — this is why the Dashboard Shifts and People widgets disagreed). Times match
  -- app/index.html's _ATT_SHIFT_TIMES_DEFAULT exactly. ----------
  update attendance a
  set clock_in = (case s.kind when 'morning' then time '09:00' when 'mid' then time '12:00' when 'closing' then time '16:00' else a.clock_in end),
    clock_out = (case s.kind when 'morning' then time '17:00' when 'mid' then time '20:00' when 'closing' then time '22:00' else a.clock_out end)
  from shifts s
  where a.tenant_id = v_tenant_id and s.tenant_id = v_tenant_id
    and s.employee_id = a.employee_id and s.shift_date = a.date
    and s.deleted_at is null and s.kind in ('morning', 'mid', 'closing');

  -- ---------- resolve 4 real, always-in-the-past dates for the synchronized example ----------
  v_wd1 := CURRENT_DATE - 1;
  while extract(isodow from v_wd1) >= 6 loop v_wd1 := v_wd1 - 1; end loop;
  v_wd2 := v_wd1 - 1;
  while extract(isodow from v_wd2) >= 6 loop v_wd2 := v_wd2 - 1; end loop;
  v_wd3 := v_wd2 - 1;
  while extract(isodow from v_wd3) >= 6 loop v_wd3 := v_wd3 - 1; end loop;
  v_sat := CURRENT_DATE - 1;
  while extract(isodow from v_sat) <> 6 loop v_sat := v_sat - 1; end loop;

  -- ---------- real shift + attendance rows backing each claim (delete-then-insert for a
  -- guaranteed clean, consistent state regardless of what reseed_demo_data() already seeded
  -- for these dates) — exact (employee, date) pairs only, so a sibling's own roster entry
  -- on one of these dates is never accidentally touched ----------
  delete from shifts where tenant_id = v_tenant_id and (employee_id, shift_date) in (
    (v_emp_azman, v_wd1), (v_emp_firdaus, v_wd2), (v_emp_nurhidayah, v_wd3), (v_emp_siti, v_sat)
  );
  insert into shifts (tenant_id, employee_id, shift_date, kind) values
    (v_tenant_id, v_emp_azman, v_wd1, 'closing'),
    (v_tenant_id, v_emp_firdaus, v_wd2, 'mid'),
    (v_tenant_id, v_emp_nurhidayah, v_wd3, 'morning'),
    (v_tenant_id, v_emp_siti, v_sat, 'off');

  delete from attendance where tenant_id = v_tenant_id and (employee_id, date) in (
    (v_emp_azman, v_wd1), (v_emp_firdaus, v_wd2), (v_emp_nurhidayah, v_wd3), (v_emp_siti, v_sat)
  );
  insert into attendance (tenant_id, employee_id, date, status, clock_in, clock_out) values
    (v_tenant_id, v_emp_azman, v_wd1, 'present', '16:00', '01:00'),       -- closing shift, worked till 1am
    (v_tenant_id, v_emp_firdaus, v_wd2, 'present', '12:00', '22:00'),     -- mid shift, worked till 10pm
    (v_tenant_id, v_emp_nurhidayah, v_wd3, 'present', '09:00', '18:30'),  -- morning shift, worked till 6:30pm
    (v_tenant_id, v_emp_siti, v_sat, 'present', '10:00', '16:00');        -- came in on her off day

  -- ---------- Phase 5-6: the 4 ot_claims, each a direct consequence of the attendance+shift
  -- rows above (Ordinary Rate of Pay: daily=salary/26, hourly=daily/8 — see app/index.html
  -- _otComputeClaim()) ----------
  insert into ot_claims (tenant_id, employee_id, claim_date, day_type, hours_worked, ot_hours,
    hourly_rate, daily_rate, amount, status, approved_hours, approved_amount, approved_by, approved_at, note)
  values
    -- Azman: closing shift 16:00-22:00, clocked out 01:00 -> 9h worked, 1h over the 8h/day
    -- baseline. basic 2000/26=76.92 daily, /8=9.62 hourly. 1 x 9.62 x 1.5 = 14.42. PENDING.
    (v_tenant_id, v_emp_azman, v_wd1, 'normal', 9, 1, 9.62, 76.92, 14.42, 'pending', null, null, null, null, null),
    -- Firdaus: mid shift 12:00-20:00, clocked out 22:00 -> 10h worked, 2h over baseline.
    -- basic 2500/26=96.15 daily, /8=12.02 hourly. 2 x 12.02 x 1.5 = 36.06 claimed. Owner
    -- APPROVES PARTIAL: trims to 1.5h -> 36.06 x (1.5/2) = 27.04.
    (v_tenant_id, v_emp_firdaus, v_wd2, 'normal', 10, 2, 12.02, 96.15, 36.06, 'approved', 1.5, 27.04, v_owner_id, (v_wd2 + 1)::timestamptz, null),
    -- Siti: shift was OFF that Saturday, came in anyway 10:00-16:00 (6h). Rest-day tier
    -- (>half-day, <=normal day) = 1.0x daily wage. basic 2800/26=107.69. Approved by the
    -- DELEGATE (demo.staff) for a DIFFERENT employee — proves delegate approval works.
    (v_tenant_id, v_emp_siti, v_sat, 'restday', 6, 6, 13.46, 107.69, 107.69, 'approved', 6, 107.69, v_staff_id, (v_sat + 1)::timestamptz, null),
    -- Nurhidayah: morning shift 09:00-17:00, clocked out 18:30 -> 9.5h worked, 1.5h over
    -- baseline. basic 2300/26=88.46 daily, /8=11.06 hourly. 1.5 x 11.06 x 1.5 = 24.88.
    -- Owner REJECTS — no prior authorization for the extra hours.
    (v_tenant_id, v_emp_nurhidayah, v_wd3, 'normal', 9.5, 1.5, 11.06, 88.46, 24.88, 'rejected', null, null, v_owner_id, (v_wd3 + 1)::timestamptz, 'Tiada arahan kerja lebih masa daripada penyelia — sila dapatkan kelulusan dahulu sebelum OT.');

  return jsonb_build_object(
    'success', true, 'tenant_id', v_tenant_id,
    'public_holidays_added', 1, 'ot_claims_added', 4, 'ot_delegate', v_staff_id,
    'synced_dates', jsonb_build_array(v_wd1, v_wd2, v_wd3, v_sat)
  );
end;
$fn$;

grant execute on function public.reseed_demo_ot_data() to authenticated;

-- ---------- run once now so the demo is fixed immediately, without waiting for the next
-- "Reset Demo Data" click ----------
select public.reseed_demo_ot_data();

-- Roadmap (write-only; Admin → System Development)
update public.dev_roadmap_items set stage = 'completed', module = 'platform',
  description = 'Fixed a real demo bug: reseed_demo_data()''s current-week attendance was hardcoded 09:00-18:00 for every employee, ignoring the shift roster it seeds in the same function, so Dashboard Shifts vs People widgets visibly disagreed for the same employee/day. reseed_demo_ot_data() now re-syncs current-week attendance to match each shift''s real hours, and its 4 OT-claims example is now derived from real shifts+attendance rows it also writes for 4 specific past dates (not arbitrary numbers) — a genuinely synchronized shift -> attendance -> OT claim story for Azman (pending), Firdaus (partial-approved), Siti (rest-day, delegate-approved), Nurhidayah (rejected).'
where title = 'Demo: OT roadmap worked examples in Reset Demo Data';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Demo: OT roadmap worked examples in Reset Demo Data',
  'Fixed a real demo bug: reseed_demo_data()''s current-week attendance was hardcoded 09:00-18:00 for every employee, ignoring the shift roster it seeds in the same function, so Dashboard Shifts vs People widgets visibly disagreed for the same employee/day. reseed_demo_ot_data() now re-syncs current-week attendance to match each shift''s real hours, and its 4 OT-claims example is now derived from real shifts+attendance rows it also writes for 4 specific past dates (not arbitrary numbers) — a genuinely synchronized shift -> attendance -> OT claim story for Azman (pending), Firdaus (partial-approved), Siti (rest-day, delegate-approved), Nurhidayah (rejected).',
  'platform', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Demo: OT roadmap worked examples in Reset Demo Data');
