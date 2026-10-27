reset role;

-- OT automation roadmap Phase 7: Payroll Run integration.
--
-- payroll_records.ot_amount — the sum of APPROVED, not-yet-paid ot_claims for an employee
-- within the payroll period, added as a gross top-up to net_pay (same precedent as
-- allowance_1/2/3 and commission in _postPayrollJournal/_sdRowValues) — NOT run through the
-- EPF/SOCSO/PCB formulas, which are hardcoded to basic_salary only. Running Payroll marks the
-- claims it paid (ot_claims.payroll_record_id) so a claim is never paid twice and a pending
-- claim rolls to the next cycle instead of blocking this period's payroll for everyone else.
--
-- The GL side reuses the existing "dedicated account or fold into Salary Expense" fallback
-- (see DEFAULT_ACCOUNT_MAPPING_KEYS 'ot_expense' in app/index.html, Settings > Default
-- Accounts) — if the tenant hasn't configured an OT Expense account yet, the amount is
-- folded into Salary Expense instead of posting an unbalanced journal.
--
-- Write-only, idempotent, run once in Supabase SQL Editor. Run AFTER hr_ot_claims_01.sql.

ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS ot_amount numeric DEFAULT 0;
COMMENT ON COLUMN public.payroll_records.ot_amount IS 'Sum of approved ot_claims for this employee+period at the time Payroll Run generated this record. Gross top-up on net_pay, NOT run through EPF/SOCSO/PCB.';

-- System Development
update public.dev_roadmap_items set stage = 'completed', module = 'hr',
  description = 'OT automation roadmap Phase 7 (final phase): Payroll Run now sums approved, unpaid ot_claims for each employee in the period and adds it to payroll_records.ot_amount as a gross top-up on net_pay — never recalculated through EPF/SOCSO/PCB (those stay basic_salary-only, same as the existing PCB disclaimer). Claims get payroll_record_id set once paid so they are never double-paid; a still-pending claim simply rolls to the next payroll cycle without blocking anyone else''s pay. _postPayrollJournal posts the OT amount to a dedicated OT Expense account if configured, else folds it into Salary Expense (same fallback already used for commission/advance). Salary Disbursement (_sdRowValues) shows ot_amount read-only alongside Commission. This completes the full OT automation roadmap: auto clock-out -> shift-aware attendance -> tenant public holidays -> Tetapan Gaji & OT settings -> OT claim detection -> Owner/Delegate approval -> Payroll Run.'
  where title = 'HR: Payroll Run OT Integration (OT roadmap Phase 7 — final)';
insert into public.dev_roadmap_items (title, description, module, stage)
  select 'HR: Payroll Run OT Integration (OT roadmap Phase 7 — final)', 'OT automation roadmap Phase 7 (final phase): Payroll Run now sums approved, unpaid ot_claims for each employee in the period and adds it to payroll_records.ot_amount as a gross top-up on net_pay — never recalculated through EPF/SOCSO/PCB (those stay basic_salary-only, same as the existing PCB disclaimer). Claims get payroll_record_id set once paid so they are never double-paid; a still-pending claim simply rolls to the next payroll cycle without blocking anyone else''s pay. _postPayrollJournal posts the OT amount to a dedicated OT Expense account if configured, else folds it into Salary Expense (same fallback already used for commission/advance). Salary Disbursement (_sdRowValues) shows ot_amount read-only alongside Commission. This completes the full OT automation roadmap: auto clock-out -> shift-aware attendance -> tenant public holidays -> Tetapan Gaji & OT settings -> OT claim detection -> Owner/Delegate approval -> Payroll Run.', 'hr', 'completed'
  where not exists (select 1 from public.dev_roadmap_items where title = 'HR: Payroll Run OT Integration (OT roadmap Phase 7 — final)');
