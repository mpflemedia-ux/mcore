-- ============================================================================
-- DEMO TENANT — PART 3c (FINAL): HR + Sales Commission + Projects + Planner
-- + Sales Plan
-- Run AFTER Part 1, Part 2, Part 3a, Part 3b have succeeded.
-- Plain INSERTs only. Idempotent.
--
-- UUID tags used in this file:
--   0301 employees              0309 projects
--   0302 payroll_records        0310 project_tasks
--   0303 attendance             0311 platform_activities (Planner)
--   0304 leave_requests         0312 sales_plans
--   0305 job_applicants         0313 sales_plan_periods
--   0306 sales_commission_rules 0314 sales_plan_weeks
--   0307 sales_commissions      0315 sales_plan_milestones
--   0308 sales_achievements
-- ============================================================================

reset role;

do $$ begin
  if not exists (select 1 from tenants where code = 'DEMO') then
    raise exception 'tenant code DEMO not found — run Part 1 first';
  end if;
end $$;

-- ---------- EMPLOYEES (4) ----------
insert into employees (id, tenant_id, name, ic_no, position, basic_salary, epf_no, socso_no,
  bank_name, bank_account_no, bank_account_name, phone, email, employment_status, join_date,
  probation_start_date, confirmed_at, staff_code)
select v.id, t.id, v.name, v.ic_no, v.position, v.basic_salary, v.epf_no, v.socso_no,
  v.bank_name, v.bank_account_no, v.name, v.phone, v.email, v.employment_status, v.join_date,
  v.join_date, v.confirmed_at, v.staff_code
from tenants t
cross join (values
  ('00000000-0000-0000-0301-000000000001'::uuid,'Siti Noraini binti Kamal','880512-10-5566','Sales Executive',2800::numeric,'EPF10001','SOC10001','Maybank','162001100001','+6012-6001001','siti.noraini@majutrading.my','permanent','2025-03-01'::date,'2025-03-01 10:00:00+08'::timestamptz,'EMP001'),
  ('00000000-0000-0000-0301-000000000002'::uuid,'Mohd Firdaus bin Rashid','900823-08-7711','Warehouse Supervisor',2500::numeric,'EPF10002','SOC10002','CIMB Bank','701234560002','+6012-6001002','firdaus.rashid@majutrading.my','permanent','2024-11-15'::date,'2024-11-15 10:00:00+08'::timestamptz,'EMP002'),
  ('00000000-0000-0000-0301-000000000003'::uuid,'Nurhidayah binti Zainal','970118-14-3322','Admin Executive',2300::numeric,'EPF10003','SOC10003','Maybank','162001100003',null,'nurhidayah.zainal@majutrading.my','probation','2026-08-01'::date,null,'EMP003'),
  ('00000000-0000-0000-0301-000000000004'::uuid,'Azman bin Yusof','850930-06-4455','Delivery Driver',2000::numeric,'EPF10004','SOC10004','Bank Islam','1201000400004',null,'azman.yusof@majutrading.my','permanent','2025-06-01'::date,'2025-06-01 10:00:00+08'::timestamptz,'EMP004')
) as v(id, name, ic_no, position, basic_salary, epf_no, socso_no, bank_name, bank_account_no, phone, email, employment_status, join_date, confirmed_at, staff_code)
where t.code = 'DEMO'
  and not exists (select 1 from employees e where e.id = v.id);

-- ---------- PAYROLL RECORDS (October 2026, 4 employees) ----------
insert into payroll_records (id, tenant_id, employee_id, month, year, basic_salary, epf_employee, epf_employer,
  socso_employee, socso_employer, eis_employee, eis_employer, pcb, net_pay, amount_paid, balance_outstanding, pay_date)
select v.id, t.id, v.employee_id, 10, 2026, v.basic_salary, v.epf_employee, v.epf_employer,
  v.socso_employee, v.socso_employer, v.eis_employee, v.eis_employee, 0, v.net_pay, v.net_pay, 0, '2026-10-28'::date
from tenants t
cross join (values
  ('00000000-0000-0000-0302-000000000001'::uuid,'00000000-0000-0000-0301-000000000001'::uuid,2800::numeric,308::numeric,364::numeric,14::numeric,49::numeric,6::numeric,2472::numeric),
  ('00000000-0000-0000-0302-000000000002'::uuid,'00000000-0000-0000-0301-000000000002'::uuid,2500::numeric,275::numeric,325::numeric,13::numeric,44::numeric,5::numeric,2207::numeric),
  ('00000000-0000-0000-0302-000000000003'::uuid,'00000000-0000-0000-0301-000000000003'::uuid,2300::numeric,253::numeric,299::numeric,12::numeric,40::numeric,5::numeric,2030::numeric),
  ('00000000-0000-0000-0302-000000000004'::uuid,'00000000-0000-0000-0301-000000000004'::uuid,2000::numeric,220::numeric,260::numeric,10::numeric,35::numeric,4::numeric,1766::numeric)
) as v(id, employee_id, basic_salary, epf_employee, epf_employer, socso_employee, socso_employer, eis_employee, net_pay)
where t.code = 'DEMO'
  and not exists (select 1 from payroll_records pr where pr.id = v.id);

-- ---------- ATTENDANCE (12 rows, 3 days x 4 employees) ----------
insert into attendance (id, tenant_id, employee_id, date, status)
select gen_random_uuid(), t.id, v.employee_id, v.date, v.status
from tenants t
cross join (values
  ('00000000-0000-0000-0301-000000000001'::uuid,'2026-10-13'::date,'present'),
  ('00000000-0000-0000-0301-000000000001'::uuid,'2026-10-14'::date,'present'),
  ('00000000-0000-0000-0301-000000000001'::uuid,'2026-10-15'::date,'late'),
  ('00000000-0000-0000-0301-000000000002'::uuid,'2026-10-13'::date,'present'),
  ('00000000-0000-0000-0301-000000000002'::uuid,'2026-10-14'::date,'present'),
  ('00000000-0000-0000-0301-000000000002'::uuid,'2026-10-15'::date,'present'),
  ('00000000-0000-0000-0301-000000000003'::uuid,'2026-10-13'::date,'present'),
  ('00000000-0000-0000-0301-000000000003'::uuid,'2026-10-14'::date,'on_leave'),
  ('00000000-0000-0000-0301-000000000003'::uuid,'2026-10-15'::date,'on_leave'),
  ('00000000-0000-0000-0301-000000000004'::uuid,'2026-10-13'::date,'present'),
  ('00000000-0000-0000-0301-000000000004'::uuid,'2026-10-14'::date,'present'),
  ('00000000-0000-0000-0301-000000000004'::uuid,'2026-10-15'::date,'present')
) as v(employee_id, date, status)
where t.code = 'DEMO'
  and not exists (select 1 from attendance a where a.tenant_id = t.id and a.employee_id = v.employee_id and a.date = v.date);

-- ---------- LEAVE REQUESTS (2) ----------
insert into leave_requests (id, tenant_id, employee_id, leave_type, start_date, end_date, days_count, status, approved_by)
select v.id, t.id, v.employee_id, v.leave_type, v.start_date, v.end_date, v.days_count, v.status,
  case when v.status = 'approved' then owner.id else null end
from tenants t
join user_profiles owner on owner.tenant_id = t.id and owner.role = 'owner'
cross join (values
  ('00000000-0000-0000-0304-000000000001'::uuid,'00000000-0000-0000-0301-000000000001'::uuid,'annual','2026-11-02'::date,'2026-11-04'::date,3::numeric,'approved'),
  ('00000000-0000-0000-0304-000000000002'::uuid,'00000000-0000-0000-0301-000000000003'::uuid,'medical','2026-10-14'::date,'2026-10-15'::date,2::numeric,'pending')
) as v(id, employee_id, leave_type, start_date, end_date, days_count, status)
where t.code = 'DEMO'
  and not exists (select 1 from leave_requests lr where lr.id = v.id);

-- ---------- JOB APPLICANTS (2) ----------
insert into job_applicants (id, tenant_id, ref_no, position_applied, full_name, gender, marital_status, status)
select v.id, t.id, v.ref_no, v.position_applied, v.full_name, v.gender, v.marital_status, v.status
from tenants t
cross join (values
  ('00000000-0000-0000-0305-000000000001'::uuid,'APP-2601-0001','Sales Executive','Khairul Anwar bin Salleh','male','single','interviewed'),
  ('00000000-0000-0000-0305-000000000002'::uuid,'APP-2601-0002','Admin Executive','Farah Liyana binti Ahmad','female','single','pending')
) as v(id, ref_no, position_applied, full_name, gender, marital_status, status)
where t.code = 'DEMO'
  and not exists (select 1 from job_applicants ja where ja.id = v.id);

-- ---------- SALES COMMISSION: link 2 of Part 2's paid invoices to Siti Noraini ----------
update invoices set sales_person_id = '00000000-0000-0000-0301-000000000001'::uuid
where id in ('00000000-0000-0000-0008-000000000002'::uuid,'00000000-0000-0000-0008-000000000004'::uuid)
  and sales_person_id is null;

insert into sales_commission_rules (id, tenant_id, sales_person_id, channel, rate_percent)
select '00000000-0000-0000-0306-000000000001'::uuid, t.id, '00000000-0000-0000-0301-000000000001'::uuid, 'retail', 3.00
from tenants t
where t.code = 'DEMO'
  and not exists (select 1 from sales_commission_rules r where r.id = '00000000-0000-0000-0306-000000000001'::uuid);

insert into sales_commissions (id, tenant_id, sales_person_id, source_type, source_id, source_item_id, channel,
  sale_amount, rate_applied, commission_amount, earned_month, earned_year, payout_month, payout_year, status)
select v.id, t.id, '00000000-0000-0000-0301-000000000001'::uuid, 'invoice', v.source_id, v.source_item_id, 'retail',
  v.sale_amount, 3.00, v.commission_amount, 9, 2026, 10, 2026, 'confirmed'
from tenants t
cross join (values
  ('00000000-0000-0000-0307-000000000001'::uuid,'00000000-0000-0000-0008-000000000002'::uuid,'00000000-0000-0000-0009-000000000003'::uuid,3200::numeric,96::numeric),
  ('00000000-0000-0000-0307-000000000002'::uuid,'00000000-0000-0000-0008-000000000004'::uuid,'00000000-0000-0000-0009-000000000009'::uuid,1800::numeric,54::numeric)
) as v(id, source_id, source_item_id, sale_amount, commission_amount)
where t.code = 'DEMO'
  and not exists (select 1 from sales_commissions sc where sc.id = v.id);

insert into sales_achievements (id, tenant_id, sales_person_id, badge_key, period_month, period_year)
select '00000000-0000-0000-0308-000000000001'::uuid, t.id, '00000000-0000-0000-0301-000000000001'::uuid, 'first_sale', 9, 2026
from tenants t
where t.code = 'DEMO'
  and not exists (select 1 from sales_achievements sa where sa.id = '00000000-0000-0000-0308-000000000001'::uuid);

-- ---------- PROJECTS (2) + TASKS (4) ----------
insert into projects (id, tenant_id, name, kind, customer_id, color)
select v.id, t.id, v.name, v.kind, v.customer_id, v.color
from tenants t
cross join (values
  ('00000000-0000-0000-0309-000000000001'::uuid,'Projek Pembekalan Tapak - Teguh Bina','client','00000000-0000-0000-0001-000000000007'::uuid,'#2563EB'),
  ('00000000-0000-0000-0309-000000000002'::uuid,'Peningkatan Proses Dalaman Q4','internal',null::uuid,'#7C3AED')
) as v(id, name, kind, customer_id, color)
where t.code = 'DEMO'
  and not exists (select 1 from projects p where p.id = v.id);

insert into project_tasks (id, tenant_id, project_id, title, column_key, assignee_employee_id, due_date, progress, sort_order)
select v.id, t.id, v.project_id, v.title, v.column_key, v.assignee_employee_id, v.due_date, v.progress, v.sort_order
from tenants t
cross join (values
  ('00000000-0000-0000-0310-000000000001'::uuid,'00000000-0000-0000-0309-000000000001'::uuid,'Sediakan senarai peralatan','done','00000000-0000-0000-0301-000000000002'::uuid,'2026-10-10'::date,100,1),
  ('00000000-0000-0000-0310-000000000002'::uuid,'00000000-0000-0000-0309-000000000001'::uuid,'Hantar & pasang di tapak','progress','00000000-0000-0000-0301-000000000004'::uuid,'2026-10-27'::date,60,2),
  ('00000000-0000-0000-0310-000000000003'::uuid,'00000000-0000-0000-0309-000000000002'::uuid,'Semak proses invois','backlog',null::uuid,'2026-11-05'::date,0,1),
  ('00000000-0000-0000-0310-000000000004'::uuid,'00000000-0000-0000-0309-000000000002'::uuid,'Automasi laporan jualan mingguan','review','00000000-0000-0000-0301-000000000003'::uuid,'2026-10-24'::date,80,2)
) as v(id, project_id, title, column_key, assignee_employee_id, due_date, progress, sort_order)
where t.code = 'DEMO'
  and not exists (select 1 from project_tasks pt where pt.id = v.id);

-- ---------- PLANNER (platform_activities, 2 entries for the demo owner) ----------
insert into platform_activities (id, owner_user_id, tenant_id, related_tenant_id, title, activity_type, status, due_at, starts_at, ends_at, notes)
select v.id, u.id, t.id, t.id, v.title, v.activity_type, 'open', v.due_at, v.starts_at, v.ends_at, v.notes
from tenants t
join auth.users u on u.email = 'demo.owner@mpflemedia.my'
cross join (values
  ('00000000-0000-0000-0311-000000000001'::uuid,'Panggilan susulan - invois tertunggak Koperasi Warga Maju','follow_up','2026-10-22 10:00:00+08'::timestamptz,null::timestamptz,null::timestamptz,'Baki belum jelas RM12,500 - INV-2601-0001'),
  ('00000000-0000-0000-0311-000000000002'::uuid,'Mesyuarat semakan jualan bulanan','appointment',null::timestamptz,'2026-10-25 14:00:00+08'::timestamptz,'2026-10-25 15:00:00+08'::timestamptz,'Semak prestasi jualan Oktober dengan pasukan')
) as v(id, title, activity_type, due_at, starts_at, ends_at, notes)
where t.code = 'DEMO'
  and not exists (select 1 from platform_activities pa where pa.id = v.id);

-- ---------- SALES PLAN (lightweight, financing disabled) ----------
insert into sales_plans (id, tenant_id, name, start_date, end_date, pic_employee_id, pic_name)
select '00000000-0000-0000-0312-000000000001'::uuid, t.id, 'Pelan Jualan Q4 2026', '2026-10-01'::date, '2026-12-31'::date,
  '00000000-0000-0000-0301-000000000001'::uuid, 'Siti Noraini binti Kamal'
from tenants t
where t.code = 'DEMO'
  and not exists (select 1 from sales_plans sp where sp.id = '00000000-0000-0000-0312-000000000001'::uuid);

insert into sales_plan_periods (id, tenant_id, plan_id, kind, label, start_date, end_date, gmv_target, units_target, orders_target)
select '00000000-0000-0000-0313-000000000001'::uuid, t.id, '00000000-0000-0000-0312-000000000001'::uuid, 'month', 'Oktober 2026', '2026-10-01'::date, '2026-10-31'::date, 50000::numeric, 500::numeric, 50::numeric
from tenants t
where t.code = 'DEMO'
  and not exists (select 1 from sales_plan_periods p where p.id = '00000000-0000-0000-0313-000000000001'::uuid);

insert into sales_plan_weeks (id, tenant_id, plan_id, period_id, code, start_date, end_date, gmv_target, units_target, orders_target)
select v.id, t.id, '00000000-0000-0000-0312-000000000001'::uuid, '00000000-0000-0000-0313-000000000001'::uuid, v.code, v.start_date, v.end_date, v.gmv_target, v.units_target, v.orders_target
from tenants t
cross join (values
  ('00000000-0000-0000-0314-000000000001'::uuid,'W01','2026-10-01'::date,'2026-10-07'::date,12500::numeric,125::numeric,12::numeric),
  ('00000000-0000-0000-0314-000000000002'::uuid,'W02','2026-10-08'::date,'2026-10-14'::date,12500::numeric,125::numeric,12::numeric)
) as v(id, code, start_date, end_date, gmv_target, units_target, orders_target)
where t.code = 'DEMO'
  and not exists (select 1 from sales_plan_weeks w where w.id = v.id);

insert into sales_plan_milestones (id, tenant_id, plan_id, code, title, due_date, metric, target)
select v.id, t.id, '00000000-0000-0000-0312-000000000001'::uuid, v.code, v.title, v.due_date, v.metric, v.target
from tenants t
cross join (values
  ('00000000-0000-0000-0315-000000000001'::uuid,'M1','Capai RM50,000 GMV Oktober','2026-10-31'::date,'rm',50000::numeric),
  ('00000000-0000-0000-0315-000000000002'::uuid,'M2','Capai 500 unit terjual Oktober','2026-10-31'::date,'units',500::numeric)
) as v(id, code, title, due_date, metric, target)
where t.code = 'DEMO'
  and not exists (select 1 from sales_plan_milestones m where m.id = v.id);

-- ---------- SANITY CHECK ----------
select
  (select count(*) from employees where tenant_id = t.id) as employees,
  (select count(*) from payroll_records pr join employees e on e.id = pr.employee_id where e.tenant_id = t.id) as payroll_records,
  (select count(*) from attendance where tenant_id = t.id) as attendance,
  (select count(*) from leave_requests where tenant_id = t.id) as leave_requests,
  (select count(*) from job_applicants where tenant_id = t.id) as job_applicants,
  (select count(*) from sales_commission_rules where tenant_id = t.id) as sales_commission_rules,
  (select count(*) from sales_commissions where tenant_id = t.id) as sales_commissions,
  (select count(*) from sales_achievements where tenant_id = t.id) as sales_achievements,
  (select count(*) from projects where tenant_id = t.id) as projects,
  (select count(*) from project_tasks pt join projects p on p.id = pt.project_id where p.tenant_id = t.id) as project_tasks,
  (select count(*) from platform_activities where tenant_id = t.id) as planner_activities,
  (select count(*) from sales_plans where tenant_id = t.id) as sales_plans,
  (select count(*) from sales_plan_periods where tenant_id = t.id) as sales_plan_periods,
  (select count(*) from sales_plan_weeks where tenant_id = t.id) as sales_plan_weeks,
  (select count(*) from sales_plan_milestones where tenant_id = t.id) as sales_plan_milestones
from tenants t
where t.code = 'DEMO';
