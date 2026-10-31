-- Dev roadmap: HR profile completion P0–P7 -> completed. WRITE-ONLY, rerun-safe.
do $$
declare
  r record;
  pr text := 'https://github.com/mpflemedia-ux/mcore/commits/main';
begin
  for r in select * from (values
    ('HR P0: employee profile fields + employer numbers', 'Employees: department, employment type (permanent/contract), contract end date, 3 fixed allowances (type + amount), annual leave days (blank = 14), opening leave balance + year. Allowance-type flags EPF / SOCSO-EIS / PCB in tenant config (Payroll > OT settings card). Tenants: KWSP, PERKESO, LHDN E, HRDF, zakat numbers (masked in Company Settings, RPC update_tenant_statutory_nos), onboarding B1-B6 now apply to them. Salary Disbursement + Run Payroll prefill fixed allowances.'),
    ('HR P1: SOCSO/EIS official bands', 'SOCSO (Cat 1 / Cat 2 at 60+) and EIS use the official PERKESO contribution table bands (64 rows up to RM6,000 ceiling) instead of the percentage approximation. Flagged allowances count as wages.'),
    ('HR P2: import HR data from onboarding E1-E6', 'HR > Employees > Import HR: CSV/Excel files or the latest onboarding uploads E1-E6. Header synonyms EN/BM, IC normalised (12 digits + dashes), bank + account split, date parsing, flags duplicate IC / suspicious dates / name mismatch. Preview with masked IC and account. Upsert by tenant + IC. Owner/admin/HR get one bell + push with counts only.'),
    ('HR P3: data health check before payroll', 'Run Payroll lists employees missing IC, EPF no or bank account with links to fix, and asks to confirm before generating when selected staff are incomplete.'),
    ('HR P4: contract expiry reminder', 'hr_contract_remind(): contract staff ending within 30 days -> one bell + push per employee per end date to owner/admin/HR, deep link to the employee form. Daily pg_cron + on app open.'),
    ('HR P5: department filter + totals', 'Employee list department filter with counts; Salary Disbursement department totals (staff, gross, net, employer contribution, company cost).'),
    ('HR P6: leave carry forward with cap', 'Annual leave balance per year = entitlement + carried forward (capped by tenant leave_carry_cap) - used, starting from join year. In the go-live year the balance at go-live replaces entitlement + carry. Tooltip breakdown.'),
    ('HR P7: employer numbers on payslip', 'Payslip shows employer KWSP, PERKESO and LHDN (E) numbers under the employer contribution note.')
  ) as t(title, descr) loop
    begin
      if exists (select 1 from public.dev_roadmap_items where title = r.title) then
        update public.dev_roadmap_items set stage = 'completed', module = 'hr', description = r.descr, pr_url = pr where title = r.title;
      else
        insert into public.dev_roadmap_items (title, description, module, stage, pr_url) values (r.title, r.descr, 'hr', 'completed', pr);
      end if;
    exception when undefined_column or undefined_table then
      raise notice 'dev_roadmap schema variant; skip: %', sqlerrm;
    end;
  end loop;
end $$;
