-- Nurbella Empire: HR profile data (department, type, leave, fixed allowance) + employer numbers.
-- WRITE-ONLY. Run AFTER 20261031100000_hr_profile_completion.sql. Rerun-safe (plain updates, matched by IC digits).
-- LEAVE = annual_leave_days, LEAVE BALANCE = leave_opening_balance for 2026. zakat_no left NULL.
do $$
declare
  t uuid;
  n int;
begin
  select id into t from public.tenants where name ilike '%nurbella%empire%' order by name limit 1;
  if t is null then raise notice 'Nurbella Empire tenant not found; nothing done'; return; end if;

  update public.employees e set
    department = v.dept,
    employment_type = v.etype,
    annual_leave_days = v.leave_days,
    leave_opening_balance = v.leave_bal,
    leave_opening_year = 2026,
    fixed_allowance_type_1 = case when v.allow > 0 then 'other' else e.fixed_allowance_type_1 end,
    fixed_allowance_1 = case when v.allow > 0 then v.allow else e.fixed_allowance_1 end
  from (values
    ('910926025360', 'MANAGEMENT', 'permanent', 16::numeric,   0::numeric,   4500::numeric),
    ('871225035081', 'MANAGEMENT', 'permanent', 16,     0,    4500),
    ('950715025236', 'MANAGEMENT', 'contract',  16,     6.34, 0),
    ('930303025864', 'MANAGEMENT', 'contract',  16,     8.1,  0),
    ('980328026172', 'MARKETING',  'contract',  14.9,   5.4,  0),
    ('981208026674', 'MARKETING',  'contract',  12,     6.25, 0),
    ('050916020112', 'MARKETING',  'contract',  8,      5.69, 0),
    ('990707025232', 'MARKETING',  'contract',  8,      1.56, 0),
    ('031020070092', 'MARKETING',  'contract',  8,      3,    0),
    ('041222020228', 'MARKETING',  'contract',  8,      1.56, 0),
    ('890917035481', 'MARKETING',  'contract',  7,      0,    0),
    ('920306025238', 'OPERATION',  'contract',  16,     4.03, 0),
    ('970516025872', 'OPERATION',  'contract',  16,     6.38, 100),
    ('920528025292', 'OPERATION',  'contract',  15.4,   3.61, 0),
    ('810318025932', 'PRODUCTION', 'contract',  8,      8,    0)
  ) as v(ic, dept, etype, leave_days, leave_bal, allow)
  where e.tenant_id = t and e.deleted_at is null
    and regexp_replace(coalesce(e.ic_no, ''), '\D', '', 'g') = v.ic;
  get diagnostics n = row_count;
  raise notice 'Nurbella employees updated: % (expected 15)', n;

  update public.tenants set kwsp_no = '21235954', perkeso_no = 'D6202045842V', lhdn_e_no = 'C 25451100070', hrdf_no = '1275665A'
  where id = t;
end $$;

-- check
select e.name, e.department, e.employment_type, e.annual_leave_days, e.leave_opening_balance, e.fixed_allowance_type_1, e.fixed_allowance_1
from public.employees e join public.tenants t on t.id = e.tenant_id
where t.name ilike '%nurbella%empire%' and e.deleted_at is null order by e.department, e.name;
