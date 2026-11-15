-- The Brozky Club — Oct 2026 commission-only data (Cizee / Lutfi / Farid) from Mike's Excel (sheets CIZEE, LUTFI, FARID; MAD empty → skipped).
-- WRITE-ONLY: run AFTER 20261115200000_svc_commission_all_services_pv_suite.sql. Rerun-safe.
--
-- >>> STEP 1 — FILL THE 3 EMPLOYEE IDS BELOW (CIZEE / LUTFI / FARID are nicknames, so nothing is matched by name). <<<
--     Find them with:  select e.id, e.name from public.employees e join public.tenants t on t.id = e.tenant_id
--                      where (t.name ilike '%brozky club%' or t.name ilike '%brozkey club%') and t.name not ilike '%empire%'
--                        and e.deleted_at is null order by e.name;
--     The block RAISES EXCEPTION (nothing is written) if any id is still a placeholder, is not a uuid, is duplicated,
--     is soft-deleted, or does not belong to The Brozky Club.
--
-- What it does (inside one DO block = all or nothing):
--   - seeds the Brozky code list (codes only; names only for MOIST = Moisturizer, HM = Hairmask)
--   - sets each scheme: commission_only, all services (svc_all), service 10 %, product 15 %, no cap, no bonus, pay via PV
--   - inserts Oct 2026 service logs + product items (source='import') ONLY when that emp-month has none yet
--   - leaves the month as DRAFT (Mike reviews + approves in the app); skips an emp whose Oct 2026 month is not draft
--   - rows with no code / no name are kept (they count in the totals) and show as "needs review" / PERLU SEMAK
-- Expected after run (calc): Cizee svc 3,263.00 → 326.30, prod 333.00 → 49.95, total 376.25
--                            Lutfi svc 6,926.50 → 692.65, prod 1,058.90 → 158.84, total 851.49
--                            Farid svc 8,358.00 → 835.80, prod 1,096.00 → 164.40, total 1,000.20   (PVD 2,227.94)

do $brozky$
declare
  v_map text[][] := array[
    -- nickname , employee_id (uuid)                       <<< FILL IN >>>
    array['CIZEE', 'PASTE-CIZEE-EMPLOYEE-UUID-HERE'],
    array['LUTFI', 'PASTE-LUTFI-EMPLOYEE-UUID-HERE'],
    array['FARID', 'PASTE-FARID-EMPLOYEE-UUID-HERE']
  ];
  tid uuid; n int; i int; v_nick text; raw text; emp uuid; st text; c jsonb; ok_n int := 0;
  emps uuid[] := '{}'; nicks text[] := '{}';
begin
  -- tenant: The Brozky Club (also matches the "Brozkey Club" spelling); never Brzky Empire
  select count(*) into n from public.tenants t
   where (t.name ilike '%brozky club%' or t.name ilike '%brozkey club%') and t.name not ilike '%empire%';
  if n <> 1 then raise exception 'Expected exactly 1 tenant named like "The Brozky Club", found %', n; end if;
  select t.id into tid from public.tenants t
   where (t.name ilike '%brozky club%' or t.name ilike '%brozkey club%') and t.name not ilike '%empire%';

  -- validate the mapping before anything is written
  for i in 1 .. array_length(v_map, 1) loop
    v_nick := v_map[i][1]; raw := btrim(coalesce(v_map[i][2], ''));
    if raw !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Employee id for % is not filled in (still "%"). Paste the real employees.id first.', v_nick, raw;
    end if;
    emp := raw::uuid;
    if emp = any(emps) then raise exception 'Employee id % is used for more than one nickname (%)', emp, v_nick; end if;
    if not exists (select 1 from public.employees e where e.id = emp and e.tenant_id = tid) then
      raise exception 'Employee id % (%) does not belong to The Brozky Club', emp, v_nick;
    end if;
    if exists (select 1 from public.employees e where e.id = emp and e.tenant_id = tid and e.deleted_at is not null) then
      raise exception 'Employee id % (%) is soft-deleted', emp, v_nick;
    end if;
    emps := emps || emp; nicks := nicks || v_nick;
  end loop;

  -- code list (codes only; no invented names except Moisturizer / Hairmask)
  insert into public.svc_price_codes (tenant_id, kind, code, name, created_by)
  select tid, v.kind, v.code, v.name, null
  from (values ('service', 'HC', null), ('service', 'KT', null), ('service', 'ST', null), ('service', 'SE', null), ('service', 'SK', null),
               ('service', 'SO', null), ('service', 'HMT', null),
               ('product', 'MOIST', 'Moisturizer'), ('product', 'HM', 'Hairmask'), ('product', 'S.SCALP', null), ('product', 'SEASALT', null),
               ('product', 'SHAMPOO', null), ('product', '90PASS', null), ('product', 'MEMBER', null)) as v(kind, code, name)
  where not exists (select 1 from public.svc_price_codes x where x.tenant_id = tid and x.kind = v.kind and x.code = v.code and x.deleted_at is null);

  drop table if exists _bz_svc; drop table if exists _bz_prod;
  create temp table _bz_svc (nick text, d date, service text, code text, price numeric, notes text) on commit drop;
  insert into _bz_svc values
    ('CIZEE', date '2026-10-06', 'HC', 'HC', 45.00, null),
    ('CIZEE', date '2026-10-07', 'HC', 'HC', 45.00, null),
    ('CIZEE', date '2026-10-08', 'HC', 'HC', 65.00, null),
    ('CIZEE', date '2026-10-10', 'HC', 'HC', 65.00, null),
    ('CIZEE', date '2026-10-10', 'HC', 'HC', 65.00, null),
    ('CIZEE', date '2026-10-11', 'KT', 'KT', 349.00, null),
    ('CIZEE', date '2026-10-13', 'HC', 'HC', 65.00, null),
    ('CIZEE', date '2026-10-13', 'HC', 'HC', 45.00, null),
    ('CIZEE', date '2026-10-16', 'HC', 'HC', 65.00, null),
    ('CIZEE', date '2026-10-16', 'HC', 'HC', 45.00, null),
    ('CIZEE', date '2026-10-16', 'KT', 'KT', 349.00, null),
    ('CIZEE', date '2026-10-17', 'HC', 'HC', 65.00, null),
    ('CIZEE', date '2026-10-17', 'HC', 'HC', 65.00, null),
    ('CIZEE', date '2026-10-17', 'HC', 'HC', 65.00, null),
    ('CIZEE', date '2026-10-18', 'HC', 'HC', 65.00, null),
    ('CIZEE', date '2026-10-20', 'HC', 'HC', 75.00, null),
    ('CIZEE', date '2026-10-21', 'HC', 'HC', 65.00, null),
    ('CIZEE', date '2026-10-22', 'HC', 'HC', 45.00, null),
    ('CIZEE', date '2026-10-23', 'SO', 'SO', 25.00, null),
    ('CIZEE', date '2026-10-24', 'KT', 'KT', 197.00, null),
    ('CIZEE', date '2026-10-24', 'HC', 'HC', 45.00, null),
    ('CIZEE', date '2026-10-25', 'HC', 'HC', 65.00, null),
    ('CIZEE', date '2026-10-25', 'KT', 'KT', 349.00, null),
    ('CIZEE', date '2026-10-25', 'KT', 'KT', 175.00, null),
    ('CIZEE', date '2026-10-29', 'HC', 'HC', 65.00, null),
    ('CIZEE', date '2026-10-31', 'HC', 'HC', 45.00, null),
    ('CIZEE', date '2026-10-31', 'KT', 'KT', 499.00, null),
    ('CIZEE', date '2026-10-31', 'KT', 'KT', 150.00, null),
    ('LUTFI', date '2026-10-01', 'HC', 'HC', 65.00, null),
    ('LUTFI', date '2026-10-02', 'HC', 'HC', 65.00, null),
    ('LUTFI', date '2026-10-03', 'KT', 'KT', 349.00, null),
    ('LUTFI', date '2026-10-03', 'HC', 'HC', 45.00, null),
    ('LUTFI', date '2026-10-03', 'HC', 'HC', 65.00, null),
    ('LUTFI', date '2026-10-04', 'KT', 'KT', 499.00, null),
    ('LUTFI', date '2026-10-04', 'HC', 'HC', 65.00, null),
    ('LUTFI', date '2026-10-06', 'HC', 'HC', 45.00, null),
    ('LUTFI', date '2026-10-06', 'HC', 'HC', 45.00, null),
    ('LUTFI', date '2026-10-06', 'ST', 'ST', 99.00, null),
    ('LUTFI', date '2026-10-07', 'HC', 'HC', 25.00, null),
    ('LUTFI', date '2026-10-09', 'HC', 'HC', 65.00, null),
    ('LUTFI', date '2026-10-09', 'SE', 'SE', 45.00, null),
    ('LUTFI', date '2026-10-09', 'KT', 'KT', 349.00, null),
    ('LUTFI', date '2026-10-09', 'HC', 'HC', 65.00, null),
    ('LUTFI', date '2026-10-10', 'HC', 'HC', 65.00, null),
    ('LUTFI', date '2026-10-10', 'ST', 'ST', 99.00, null),
    ('LUTFI', date '2026-10-11', 'HC', 'HC', 25.00, null),
    ('LUTFI', date '2026-10-13', 'KT', 'KT', 349.00, null),
    ('LUTFI', date '2026-10-13', 'HC', 'HC', 22.50, null),
    ('LUTFI', date '2026-10-13', 'HC', 'HC', 45.00, null),
    ('LUTFI', date '2026-10-13', 'HC', 'HC', 65.00, null),
    ('LUTFI', date '2026-10-14', 'HC', 'HC', 65.00, null),
    ('LUTFI', date '2026-10-15', 'HC', 'HC', 45.00, null),
    ('LUTFI', date '2026-10-15', 'HC', 'HC', 45.00, null),
    ('LUTFI', date '2026-10-15', 'HC', 'HC', 65.00, null),
    ('LUTFI', date '2026-10-16', 'HC', 'HC', 65.00, null),
    ('LUTFI', date '2026-10-16', 'HC', 'HC', 65.00, null),
    ('LUTFI', date '2026-10-17', 'KT', 'KT', 349.00, null),
    ('LUTFI', date '2026-10-17', 'HC', 'HC', 65.00, null),
    ('LUTFI', date '2026-10-17', 'KT', 'KT', 350.00, null),
    ('LUTFI', date '2026-10-18', 'HC', 'HC', 45.00, null),
    ('LUTFI', date '2026-10-18', 'HC', 'HC', 65.00, null),
    ('LUTFI', date '2026-10-18', 'HC', 'HC', 45.00, null),
    ('LUTFI', date '2026-10-18', 'HC', 'HC', 65.00, null),
    ('LUTFI', date '2026-10-20', 'ST', 'ST', 150.00, null),
    ('LUTFI', date '2026-10-20', 'HC', 'HC', 45.00, null),
    ('LUTFI', date '2026-10-20', 'HC', 'HC', 65.00, null),
    ('LUTFI', date '2026-10-21', 'HC', 'HC', 45.00, null),
    ('LUTFI', date '2026-10-21', 'ST', 'ST', 230.00, null),
    ('LUTFI', date '2026-10-21', 'HC', 'HC', 65.00, null),
    ('LUTFI', date '2026-10-22', 'HC', 'HC', 65.00, null),
    ('LUTFI', date '2026-10-22', 'HC', 'HC', 65.00, null),
    ('LUTFI', date '2026-10-23', 'ST', 'ST', 150.00, null),
    ('LUTFI', date '2026-10-23', 'HC', 'HC', 65.00, null),
    ('LUTFI', date '2026-10-23', 'HC', 'HC', 75.00, null),
    ('LUTFI', date '2026-10-23', 'HC', 'HC', 65.00, null),
    ('LUTFI', date '2026-10-24', 'HC', 'HC', 45.00, null),
    ('LUTFI', date '2026-10-24', 'HC', 'HC', 65.00, null),
    ('LUTFI', date '2026-10-24', 'HC', 'HC', 65.00, null),
    ('LUTFI', date '2026-10-24', 'HMT', 'HMT', 199.00, null),
    ('LUTFI', date '2026-10-24', 'HC', 'HC', 45.00, null),
    ('LUTFI', date '2026-10-25', 'HC', 'HC', 65.00, null),
    ('LUTFI', date '2026-10-25', 'HC', 'HC', 45.00, null),
    ('LUTFI', date '2026-10-25', 'KT', 'KT', 349.00, null),
    ('LUTFI', date '2026-10-27', 'HC', 'HC', 65.00, null),
    ('LUTFI', date '2026-10-27', 'KT', 'KT', 174.00, null),
    ('LUTFI', date '2026-10-29', 'HC', 'HC', 65.00, null),
    ('LUTFI', date '2026-10-29', 'KT', 'KT', 349.00, null),
    ('LUTFI', date '2026-10-28', 'HC', 'HC', 65.00, null),
    ('LUTFI', date '2026-10-30', 'HC', 'HC', 65.00, null),
    ('LUTFI', date '2026-10-30', 'HC', 'HC', 65.00, null),
    ('LUTFI', date '2026-10-31', 'HC', 'HC', 45.00, null),
    ('LUTFI', date '2026-10-31', 'HC', 'HC', 45.00, null),
    ('LUTFI', date '2026-10-31', 'HC', 'HC', 65.00, null),
    ('LUTFI', date '2026-10-31', 'HC', 'HC', 65.00, null),
    ('FARID', date '2026-10-01', 'HC', 'HC', 65.00, null),
    ('FARID', date '2026-10-01', 'HC', 'HC', 65.00, null),
    ('FARID', date '2026-10-02', 'ST', 'ST', 150.00, null),
    ('FARID', date '2026-10-03', 'HC', 'HC', 65.00, null),
    ('FARID', date '2026-10-03', 'HC', 'HC', 20.00, null),
    ('FARID', date '2026-10-03', 'KT', 'KT', 349.00, null),
    ('FARID', date '2026-10-03', 'HC', 'HC', 65.00, null),
    ('FARID', date '2026-10-04', 'HC', 'HC', 65.00, null),
    ('FARID', date '2026-10-04', 'HC', 'HC', 65.00, null),
    ('FARID', date '2026-10-04', 'HC', 'HC', 25.00, null),
    ('FARID', date '2026-10-07', 'KT', 'KT', 349.00, null),
    ('FARID', date '2026-10-07', 'HC', 'HC', 45.00, null),
    ('FARID', date '2026-10-08', 'HC', 'HC', 65.00, null),
    ('FARID', date '2026-10-08', 'SE', 'SE', 45.00, null),
    ('FARID', date '2026-10-08', 'HC', 'HC', 45.00, null),
    ('FARID', date '2026-10-09', 'HC', 'HC', 45.00, null),
    ('FARID', date '2026-10-09', 'SK', 'SK', 559.00, null),
    ('FARID', date '2026-10-10', 'KT', 'KT', 349.00, null),
    ('FARID', date '2026-10-10', 'HC', 'HC', 25.00, null),
    ('FARID', date '2026-10-11', 'KT', 'KT', 349.00, null),
    ('FARID', date '2026-10-11', 'HC', 'HC', 45.00, null),
    ('FARID', date '2026-10-11', 'HC', 'HC', 65.00, null),
    ('FARID', date '2026-10-14', 'HC', 'HC', 65.00, null),
    ('FARID', date '2026-10-14', 'HC', 'HC', 65.00, null),
    ('FARID', date '2026-10-17', 'HC', 'HC', 45.00, null),
    ('FARID', date '2026-10-17', 'KT', 'KT', 499.00, null),
    ('FARID', date '2026-10-17', 'HC', 'HC', 65.00, null),
    ('FARID', date '2026-10-17', '—', null, 189.00, 'Tiada kod servis dalam sheet asal — perlu semak'),
    ('FARID', date '2026-10-18', 'HC', 'HC', 25.00, null),
    ('FARID', date '2026-10-18', 'HC', 'HC', 65.00, null),
    ('FARID', date '2026-10-18', 'ST', 'ST', 150.00, null),
    ('FARID', date '2026-10-20', 'KT', 'KT', 349.00, null),
    ('FARID', date '2026-10-20', 'HC', 'HC', 25.00, null),
    ('FARID', date '2026-10-21', 'HC', 'HC', 65.00, null),
    ('FARID', date '2026-10-21', 'HC', 'HC', 70.00, null),
    ('FARID', date '2026-10-21', 'KT', 'KT', 329.00, null),
    ('FARID', date '2026-10-22', 'HC', 'HC', 75.00, null),
    ('FARID', date '2026-10-22', 'HC', 'HC', 45.00, null),
    ('FARID', date '2026-10-23', 'KT', 'KT', 349.00, null),
    ('FARID', date '2026-10-24', 'KT', 'KT', 499.00, null),
    ('FARID', date '2026-10-25', 'KT', 'KT', 349.00, null),
    ('FARID', date '2026-10-25', 'KT', 'KT', 349.00, null),
    ('FARID', date '2026-10-27', 'SK', 'SK', 559.00, null),
    ('FARID', date '2026-10-28', 'HC', 'HC', 65.00, null),
    ('FARID', date '2026-10-29', 'HC', 'HC', 65.00, null),
    ('FARID', date '2026-10-29', 'KT', 'KT', 220.00, null),
    ('FARID', date '2026-10-30', 'HC', 'HC', 65.00, null),
    ('FARID', date '2026-10-30', 'HC', 'HC', 60.00, null),
    ('FARID', date '2026-10-31', 'HMT', 'HMT', 199.00, null),
    ('FARID', date '2026-10-31', 'HC', 'HC', 65.00, null),
    ('FARID', date '2026-10-31', 'HMT', 'HMT', 99.00, null),
    ('FARID', date '2026-10-31', 'HC', 'HC', 45.00, null),
    ('FARID', date '2026-10-31', 'HC', 'HC', 65.00, null),
    ('FARID', date '2026-10-31', 'HC', 'HC', 60.00, null),
    ('FARID', date '2026-10-31', 'KT', 'KT', 199.00, null);
  create temp table _bz_prod (nick text, d date, code text, amount numeric, notes text) on commit drop;
  insert into _bz_prod values
    ('CIZEE', date '2026-10-16', 'HM', 89.00, null),
    ('CIZEE', date '2026-10-29', 'S.SCALP', 49.00, null),
    ('CIZEE', date '2026-10-29', 'MOIST', 65.00, null),
    ('CIZEE', date '2026-10-31', 'HM', 65.00, null),
    ('CIZEE', date '2026-10-31', 'MOIST', 65.00, null),
    ('LUTFI', date '2026-10-06', '90PASS', 150.00, null),
    ('LUTFI', date '2026-10-13', 'MOIST', 65.00, null),
    ('LUTFI', date '2026-10-15', 'MOIST', 65.00, null),
    ('LUTFI', date '2026-10-16', '90PASS', 150.00, null),
    ('LUTFI', date '2026-10-18', 'MOIST', 65.00, null),
    ('LUTFI', date '2026-10-21', 'MEMBER', 19.90, null),
    ('LUTFI', date '2026-10-24', 'MOIST', 65.00, null),
    ('LUTFI', date '2026-10-25', 'MOIST', 65.00, null),
    ('LUTFI', date '2026-10-27', null, 414.00, 'Tiada nama produk dalam sheet asal — perlu semak'),
    ('FARID', date '2026-10-01', 'MOIST', 65.00, null),
    ('FARID', date '2026-10-02', null, 65.00, 'Tiada nama produk dalam sheet asal — perlu semak'),
    ('FARID', date '2026-10-03', null, 65.00, 'Tiada nama produk dalam sheet asal — perlu semak'),
    ('FARID', date '2026-10-03', null, 65.00, 'Tiada nama produk dalam sheet asal — perlu semak'),
    ('FARID', date '2026-10-07', 'MOIST', 65.00, null),
    ('FARID', date '2026-10-07', 'MOIST', 65.00, null),
    ('FARID', date '2026-10-10', 'HM', 65.00, null),
    ('FARID', date '2026-10-17', 'HM', 89.00, null),
    ('FARID', date '2026-10-17', 'MOIST', 65.00, null),
    ('FARID', date '2026-10-20', 'SEASALT', 45.00, null),
    ('FARID', date '2026-10-21', 'MOIST', 65.00, null),
    ('FARID', date '2026-10-27', 'HM', 89.00, null),
    ('FARID', date '2026-10-30', 'SEASALT', 45.00, null),
    ('FARID', date '2026-10-31', 'MOIST', 65.00, null),
    ('FARID', date '2026-10-31', 'SHAMPOO', 89.00, null),
    ('FARID', date '2026-10-31', 'HM', 89.00, null);

  for i in 1 .. array_length(emps, 1) loop
    emp := emps[i]; v_nick := nicks[i];
    select m.status into st from public.svc_comm_months m
     where m.tenant_id = tid and m.employee_id = emp and m.year = 2026 and m.month = 10 and m.deleted_at is null;
    if st is not null and st <> 'draft' then
      raise notice '% (%): Oct 2026 is % — skipped (reopen it in the app first)', v_nick, emp, st;
      continue;
    end if;

    insert into public.svc_comm_settings (tenant_id, employee_id, enabled, pay_basis, svc_all, svc_rate_pct, svc_cap, prod_rate_pct, bonus_amount, pay_via_pv, notes)
    values (tid, emp, true, 'commission_only', true, 10, null, 15, 0, true, 'Commission only · 10% all services · 15% products')
    on conflict (tenant_id, employee_id) do update set enabled = true, pay_basis = 'commission_only', svc_all = true, svc_rate_pct = 10,
      svc_cap = null, prod_rate_pct = 15, bonus_amount = 0, pay_via_pv = true, deleted_at = null;

    if exists (select 1 from public.svc_logs l where l.tenant_id = tid and l.employee_id = emp and l.deleted_at is null
               and l.log_date >= date '2026-10-01' and l.log_date < date '2026-11-01') then
      raise notice '% (%): Oct 2026 service logs already exist — not re-inserted', v_nick, emp;
    else
      insert into public.svc_logs (tenant_id, employee_id, log_date, service, code, price, notes, source, created_by)
      select tid, emp, s.d, s.service, s.code, s.price, s.notes, 'import', null from _bz_svc s where s.nick = v_nick;
    end if;

    if exists (select 1 from public.svc_product_logs p where p.tenant_id = tid and p.employee_id = emp and p.deleted_at is null
               and p.log_date >= date '2026-10-01' and p.log_date < date '2026-11-01') then
      raise notice '% (%): Oct 2026 product items already exist — not re-inserted', v_nick, emp;
    else
      insert into public.svc_product_logs (tenant_id, employee_id, log_date, code, qty, amount, notes, source, created_by)
      select tid, emp, p.d, p.code, 1, p.amount, p.notes, 'import', null from _bz_prod p where p.nick = v_nick;
    end if;

    insert into public.svc_comm_months (tenant_id, employee_id, month, year, status, product_sales, bonus_on, created_by)
    values (tid, emp, 10, 2026, 'draft', 0, false, null)
    on conflict (tenant_id, employee_id, year, month) do nothing;
    perform public.svc__sync_psales((select m.id from public.svc_comm_months m where m.tenant_id = tid and m.employee_id = emp and m.year = 2026 and m.month = 10));
    c := public.svc__calc(tid, emp, 10, 2026);
    update public.svc_comm_months set svc_heads = (c->>'heads')::int, svc_commission = (c->>'svc_commission')::numeric,
      prod_commission = (c->>'prod_commission')::numeric, bonus = (c->>'bonus')::numeric,
      commission_total = (c->>'commission_total')::numeric, flags = (c->>'flags')::int, rates = c->'rates'
    where tenant_id = tid and employee_id = emp and year = 2026 and month = 10 and status = 'draft';
    raise notice '% → svc % · prod % · total % · review %', v_nick, c->>'svc_commission', c->>'prod_commission', c->>'commission_total', c->>'review';
    ok_n := ok_n + 1;
  end loop;
  raise notice 'Brozky Oct 2026: % staff ready (draft) — approve each in Service Commission, then "Create PV for all staff this month".', ok_n;
end
$brozky$;

-- check (read-only): expect 376.25 / 851.49 / 1000.20
select e.name, m.status, m.svc_heads, m.svc_commission, m.product_sales, m.prod_commission, m.commission_total
from public.svc_comm_months m join public.employees e on e.id = m.employee_id
join public.tenants t on t.id = m.tenant_id
where (t.name ilike '%brozky club%' or t.name ilike '%brozkey club%') and t.name not ilike '%empire%'
  and m.year = 2026 and m.month = 10 and m.deleted_at is null
order by e.name;
