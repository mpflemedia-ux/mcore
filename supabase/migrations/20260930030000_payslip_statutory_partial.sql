-- Payslip statutory overrides + partial payment tracking (all tenants).
-- DB-driven: never hardcode employee/company names or amounts in app code.
-- Run manually in Supabase SQL Editor (write-only from agents).

-- Employee-level statutory settings (default = normal MY payroll behaviour)
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS epf_exempt boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS skip_employer_contrib boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.employees.epf_exempt IS
  'When true, payroll sets employee EPF to 0 (no auto-calc). SOCSO/EIS/PCB still follow normal calc unless separately overridden on the payslip.';
COMMENT ON COLUMN public.employees.skip_employer_contrib IS
  'When true, payroll stores employer EPF/SOCSO/EIS as 0 and payslip hides employer contribution lines.';

-- Per-payslip snapshot + partial payment (Net entitlement ≠ Amount Paid)
ALTER TABLE public.payroll_records
  ADD COLUMN IF NOT EXISTS epf_exempt boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS skip_employer_contrib boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS amount_paid numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_outstanding numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_note text;

COMMENT ON COLUMN public.payroll_records.epf_exempt IS
  'Snapshot of employee.epf_exempt (or per-payslip override) at generation/save time.';
COMMENT ON COLUMN public.payroll_records.skip_employer_contrib IS
  'When true, do not display employer contribution block on this payslip.';
COMMENT ON COLUMN public.payroll_records.amount_paid IS
  'Cash/bank amount actually paid for this period. Independent of net_pay (supports partial payment).';
COMMENT ON COLUMN public.payroll_records.balance_outstanding IS
  'net_pay - amount_paid (can be set explicitly; UI recalculates from net - paid when saving).';
COMMENT ON COLUMN public.payroll_records.payment_note IS
  'Free-text note e.g. Outstanding / Payable 7 Oct 2026 (bilingual content from operator).';
