-- ============================================================================
-- DEMO TENANT — PART 3b: Accounting transactions + Payment Vouchers
-- Run AFTER Part 1 and Part 2 have succeeded. Plain INSERTs only. Idempotent.
--
-- NOTE (known simplification): invoices/payments/supplier bills seeded in
-- Part 2/3a do NOT have matching auto-posted journal entries here - the live
-- app's own posting logic normally fires on real transaction creation, which
-- a raw SQL seed bypasses. The journal entries below are standalone manual
-- entries (capital injection, rent, utilities, marketing) purely to populate
-- the Journal Entries screen for the demo, not a full double-entry trail of
-- every Part 2/3a transaction.
--
-- UUID tags used in this file:
--   0201 bank_accounts        0205 expense_claims
--   0202 journal_entries      0206 expense_claim_items
--   0203 journal_lines        0207 payment_voucher_batches
--   0204 fixed_assets         0208 payment_voucher_batch_lines
--   0209 depreciation_schedule
-- ============================================================================

reset role;

do $$ begin
  if not exists (select 1 from tenants where code = 'DEMO') then
    raise exception 'tenant code DEMO not found — run Part 1 first';
  end if;
end $$;

-- ---------- BANK ACCOUNTS (2) ----------
insert into bank_accounts (id, tenant_id, coa_id, account_name, bank_name, account_no, account_type, currency, opening_balance, current_balance, is_default, is_active)
select v.id, t.id, coa.id, v.account_name, v.bank_name, v.account_no, 'current', 'MYR', v.opening_balance, v.current_balance, v.is_default, true
from tenants t
join chart_of_accounts coa on coa.tenant_id = t.id and coa.code = '1120'
cross join (values
  ('00000000-0000-0000-0201-000000000001'::uuid,'Maju Trading Sdn Bhd','Maybank','514012345678',50000::numeric,44850::numeric,true),
  ('00000000-0000-0000-0201-000000000002'::uuid,'Maju Trading Sdn Bhd (Savings)','CIMB Bank','7012345601',8000::numeric,8000::numeric,false)
) as v(id, account_name, bank_name, account_no, opening_balance, current_balance, is_default)
where t.code = 'DEMO'
  and not exists (select 1 from bank_accounts b where b.id = v.id);

-- ---------- JOURNAL ENTRIES (4 manual entries) ----------
insert into journal_entries (id, tenant_id, fiscal_year_id, ref_no, entry_date, entry_type, description, total_debit, total_credit, status, period_month, period_year)
select v.id, t.id, fy.id, v.ref_no, v.entry_date, 'manual', v.description, v.amount, v.amount, 'posted', v.period_month, 2026
from tenants t
join fiscal_years fy on fy.tenant_id = t.id and fy.is_current = true
cross join (values
  ('00000000-0000-0000-0202-000000000001'::uuid,'JNL-2601-0001','2026-01-05'::date,'Suntikan modal awal pemilik',50000::numeric,1),
  ('00000000-0000-0000-0202-000000000002'::uuid,'JNL-2601-0002','2026-10-01'::date,'Sewa pejabat Oktober 2026',3500::numeric,10),
  ('00000000-0000-0000-0202-000000000003'::uuid,'JNL-2601-0003','2026-10-05'::date,'Bil utiliti Oktober 2026',450::numeric,10),
  ('00000000-0000-0000-0202-000000000004'::uuid,'JNL-2601-0004','2026-10-12'::date,'Perbelanjaan pemasaran - kempen media sosial',1200::numeric,10)
) as v(id, ref_no, entry_date, description, amount, period_month)
where t.code = 'DEMO'
  and not exists (select 1 from journal_entries je where je.id = v.id);

insert into journal_lines (id, tenant_id, entry_id, account_id, line_no, description, debit_amt, credit_amt)
select gen_random_uuid(), t.id, v.entry_id, coa.id, v.line_no, v.description, v.debit_amt, v.credit_amt
from tenants t
cross join (values
  ('00000000-0000-0000-0202-000000000001'::uuid,'1120',1,'Suntikan modal awal pemilik',50000::numeric,0::numeric),
  ('00000000-0000-0000-0202-000000000001'::uuid,'3100',2,'Suntikan modal awal pemilik',0::numeric,50000::numeric),
  ('00000000-0000-0000-0202-000000000002'::uuid,'6200',1,'Sewa pejabat Oktober 2026',3500::numeric,0::numeric),
  ('00000000-0000-0000-0202-000000000002'::uuid,'1120',2,'Sewa pejabat Oktober 2026',0::numeric,3500::numeric),
  ('00000000-0000-0000-0202-000000000003'::uuid,'6210',1,'Bil utiliti Oktober 2026',450::numeric,0::numeric),
  ('00000000-0000-0000-0202-000000000003'::uuid,'1120',2,'Bil utiliti Oktober 2026',0::numeric,450::numeric),
  ('00000000-0000-0000-0202-000000000004'::uuid,'6300',1,'Perbelanjaan pemasaran - kempen media sosial',1200::numeric,0::numeric),
  ('00000000-0000-0000-0202-000000000004'::uuid,'1120',2,'Perbelanjaan pemasaran - kempen media sosial',0::numeric,1200::numeric)
) as v(entry_id, coa_code, line_no, description, debit_amt, credit_amt)
join chart_of_accounts coa on coa.tenant_id = t.id and coa.code = v.coa_code
where t.code = 'DEMO'
  and not exists (
    select 1 from journal_lines jl where jl.entry_id = v.entry_id and jl.line_no = v.line_no
  );

-- ---------- FIXED ASSETS (2) + DEPRECIATION SCHEDULE ----------
insert into fixed_assets (id, tenant_id, coa_id, asset_no, name, category, purchase_date, purchase_price, residual_value,
  useful_life_years, depreciation_method, accumulated_dep, nbv, status, location)
select v.id, t.id, coa.id, v.asset_no, v.name, v.category, v.purchase_date, v.purchase_price, v.residual_value,
  v.useful_life_years, 'straight_line', v.accumulated_dep, v.purchase_price - v.accumulated_dep, 'active', 'Pejabat Shah Alam'
from tenants t
join chart_of_accounts coa on coa.tenant_id = t.id and coa.code = '1510'
cross join (values
  ('00000000-0000-0000-0204-000000000001'::uuid,'AST-2601-0001','Delivery Van - Toyota Hiace','Vehicle','2026-02-01'::date,85000::numeric,5000::numeric,5,12000::numeric),
  ('00000000-0000-0000-0204-000000000002'::uuid,'AST-2601-0002','Office Computer Set (x3)','Office Equipment','2026-03-15'::date,12000::numeric,0::numeric,3,2333::numeric)
) as v(id, asset_no, name, category, purchase_date, purchase_price, residual_value, useful_life_years, accumulated_dep)
where t.code = 'DEMO'
  and not exists (select 1 from fixed_assets fa where fa.id = v.id);

insert into depreciation_schedule (id, tenant_id, asset_id, period_year, period_month, dep_amount, acc_dep, nbv, is_posted)
select gen_random_uuid(), t.id, v.asset_id, 2026, v.period_month, v.dep_amount, v.acc_dep, v.nbv, true
from tenants t
cross join (values
  ('00000000-0000-0000-0204-000000000001'::uuid,9,1333.33::numeric,10666.64::numeric,74333.36::numeric),
  ('00000000-0000-0000-0204-000000000001'::uuid,10,1333.33::numeric,11999.97::numeric,73000.03::numeric),
  ('00000000-0000-0000-0204-000000000002'::uuid,9,333.33::numeric,2000::numeric,10000::numeric),
  ('00000000-0000-0000-0204-000000000002'::uuid,10,333.33::numeric,2333.33::numeric,9666.67::numeric)
) as v(asset_id, period_month, dep_amount, acc_dep, nbv)
where t.code = 'DEMO'
  and not exists (
    select 1 from depreciation_schedule ds where ds.tenant_id = t.id and ds.asset_id = v.asset_id and ds.period_month = v.period_month and ds.period_year = 2026
  );

-- ---------- EXPENSE CLAIMS (3) ----------
insert into expense_claims (id, tenant_id, ref_no, claimed_by, claim_date, description, total_amount, status, approved_by, approved_at)
select v.id, t.id, v.ref_no, claimant.id, v.claim_date, v.description, v.total_amount, v.status, approver.id, v.approved_at
from tenants t
cross join (values
  ('00000000-0000-0000-0205-000000000001'::uuid,'EXP-2601-0001','demo.owner@mpflemedia.my','2026-10-08'::date,'Tuntutan perjalanan & minyak - lawatan client',450::numeric,'approved','demo.owner@mpflemedia.my','2026-10-09 10:00:00+08'::timestamptz),
  ('00000000-0000-0000-0205-000000000002'::uuid,'EXP-2601-0002','demo.staff@mpflemedia.my','2026-10-16'::date,'Tuntutan bekalan pejabat',180::numeric,'draft',null,null),
  ('00000000-0000-0000-0205-000000000003'::uuid,'EXP-2601-0003','demo.staff@mpflemedia.my','2026-10-11'::date,'Tuntutan caj telefon & internet',220::numeric,'approved','demo.owner@mpflemedia.my','2026-10-12 09:30:00+08'::timestamptz)
) as v(id, ref_no, claimed_by_email, claim_date, description, total_amount, status, approved_by_email, approved_at)
join auth.users claimant on claimant.email = v.claimed_by_email
left join auth.users approver on approver.email = v.approved_by_email
where t.code = 'DEMO'
  and not exists (select 1 from expense_claims ec where ec.id = v.id);

insert into expense_claim_items (id, tenant_id, claim_id, account_id, date, description, amount)
select gen_random_uuid(), t.id, v.claim_id, coa.id, v.date, v.description, v.amount
from tenants t
cross join (values
  ('00000000-0000-0000-0205-000000000001'::uuid,'6500','2026-10-08'::date,'Minyak kenderaan - lawatan Koperasi Warga Maju',450::numeric),
  ('00000000-0000-0000-0205-000000000002'::uuid,'6400','2026-10-16'::date,'Bekalan pejabat pelbagai',180::numeric),
  ('00000000-0000-0000-0205-000000000003'::uuid,'6220','2026-10-11'::date,'Bil telefon & internet bulanan',220::numeric)
) as v(claim_id, coa_code, date, description, amount)
join chart_of_accounts coa on coa.tenant_id = t.id and coa.code = v.coa_code
where t.code = 'DEMO'
  and not exists (
    select 1 from expense_claim_items ei where ei.claim_id = v.claim_id and ei.description = v.description
  );

-- ---------- PAYMENT VOUCHER BATCHES (2) ----------
insert into payment_voucher_batches (id, tenant_id, ref_no, batch_date, title, status, total_amount, line_count, prepared_by, checked_by, approved_by)
select v.id, t.id, v.ref_no, v.batch_date, v.title, v.status, v.total_amount, v.line_count, v.prepared_by, v.checked_by, v.approved_by
from tenants t
cross join (values
  ('00000000-0000-0000-0207-000000000001'::uuid,'PV-2601-0001','2026-10-20'::date,'Bayaran Pembekal - Bil Oktober','approved',4800::numeric,1,'Demo Staff','Demo Owner','Demo Owner'),
  ('00000000-0000-0000-0207-000000000002'::uuid,'PV-2601-0002','2026-10-21'::date,'Bayaran Tuntutan Perbelanjaan','draft',450::numeric,1,'Demo Staff',null,null)
) as v(id, ref_no, batch_date, title, status, total_amount, line_count, prepared_by, checked_by, approved_by)
where t.code = 'DEMO'
  and not exists (select 1 from payment_voucher_batches pvb where pvb.id = v.id);

insert into payment_voucher_batch_lines (id, tenant_id, batch_id, sort_order, payee_name, amount, payment_method, bill_id, description)
select v.id, t.id, v.batch_id, v.sort_order, v.payee_name, v.amount, v.payment_method, v.bill_id, v.description
from tenants t
cross join (values
  (gen_random_uuid(),'00000000-0000-0000-0207-000000000001'::uuid,1,'Supplier Elektronik Prima Sdn Bhd',4800::numeric,'bank_transfer','00000000-0000-0000-0106-000000000001'::uuid,'Bayaran bil BILL-2601-0001'),
  (gen_random_uuid(),'00000000-0000-0000-0207-000000000002'::uuid,1,'Demo Owner',450::numeric,'bank_transfer',null,'Tuntutan perjalanan & minyak EXP-2601-0001')
) as v(id, batch_id, sort_order, payee_name, amount, payment_method, bill_id, description)
where t.code = 'DEMO'
  and not exists (
    select 1 from payment_voucher_batch_lines pvl where pvl.batch_id = v.batch_id and pvl.sort_order = v.sort_order
  );

-- ---------- SANITY CHECK ----------
select
  (select count(*) from bank_accounts where tenant_id = t.id) as bank_accounts,
  (select count(*) from journal_entries where tenant_id = t.id) as journal_entries,
  (select count(*) from journal_lines jl join journal_entries je on je.id = jl.entry_id where je.tenant_id = t.id) as journal_lines,
  (select count(*) from fixed_assets where tenant_id = t.id) as fixed_assets,
  (select count(*) from depreciation_schedule where tenant_id = t.id) as depreciation_schedule,
  (select count(*) from expense_claims where tenant_id = t.id) as expense_claims,
  (select count(*) from expense_claim_items where tenant_id = t.id) as expense_claim_items,
  (select count(*) from payment_voucher_batches where tenant_id = t.id) as payment_voucher_batches,
  (select count(*) from payment_voucher_batch_lines where tenant_id = t.id) as payment_voucher_batch_lines
from tenants t
where t.code = 'DEMO';
