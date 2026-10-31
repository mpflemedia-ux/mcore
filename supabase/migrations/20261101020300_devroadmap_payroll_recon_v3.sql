-- Dev roadmap: Payroll Reconciliation v3 R1–R7 -> completed. WRITE-ONLY, rerun-safe.
do $$
declare
  r record;
  pr text := 'https://github.com/mpflemedia-ux/mcore/commits/main';
begin
  for r in select * from (values
    ('Payroll Recon R1: full page like Salary Disbursement', 'HR & Payroll > Reconciliation opens a full page (no modal): back link, month/year selector, stat cards (net, paid, outstanding, staff outstanding, statutory not remitted) and one accordion card per employee with status chip Paid / Partial / Outstanding / Statutory not remitted / Upcoming.'),
    ('Payroll Recon R2: mark month paid + record payment', 'Bulk Mark as paid (only when the month''s SD batch is approved; asks paid date + bank reference once). Per-employee Record payment for partials. Rows paid through a PVD show a read-only Paid via PVD link; a DB trigger syncs PVD line / PV paid-unpaid back to payroll paid fields. RPCs payroll_recon_mark_paid, payroll_recon_record_payment.'),
    ('Payroll Recon R3: statutory auto status', 'A paid KWSP/SOCSO/EIS/PCB (category statutory) PV or PVD line for a month marks that month''s deductions as remitted. Period from new period_month/period_year columns, else parsed from the description text; HR can set the period per item. RPCs payroll_recon_statutory_items, payroll_recon_link_statutory.'),
    ('Payroll Recon R4: arrears repayment plan', 'HR sets an instalment from month X. Run Payroll adds Arrears payment (Bayaran tunggakan) as a separate line (no EPF/SOCSO/PCB), oldest outstanding month first, idempotent on re-run / delete. Shown on the payslip, the SD card and included in the SD PVD salary line. Tables payroll_arrears_plans, payroll_arrears_allocations.'),
    ('Payroll Recon R5: employee reconciliation report + e-sign', 'Per-employee report (summary, monthly table, statutory items, repayment plan, totals, acknowledgement) on the tenant letterhead, EN/BM, Print / Save as PDF. Save stores a snapshot. Share for signature sends a one-time WhatsApp link to a public sign page; locks after signing; Reset voids. Signed reports listed on the employee profile.'),
    ('Payroll Recon R6: alerts', 'Dashboard card staff outstanding / statutory not remitted (taps to the page). Monthly bell + push to HR managers with counts only. Report signed bell to the preparer + HR managers; Reset bell to the preparer; month fully paid bell to HR managers. No amounts in push.')
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
