-- Editable Pay Date for payslips (all tenants).
-- WRITE-ONLY from agents — run in Supabase SQL Editor as authorised operator.
-- Display source of truth: payroll_records.pay_date (fallback: generated_at::date in app).
-- generated_at remains creation/audit timestamptz; do not repurpose it as Pay Date.

ALTER TABLE public.payroll_records
  ADD COLUMN IF NOT EXISTS pay_date date;

COMMENT ON COLUMN public.payroll_records.pay_date IS
  'Printed Pay Date on payslip (YYYY-MM-DD). Independent of period month/year. Amended on Payslip Detail. Fallback display: generated_at::date.';

-- Default for NEW inserts when app omits the column (Malaysia calendar day).
ALTER TABLE public.payroll_records
  ALTER COLUMN pay_date SET DEFAULT ((now() AT TIME ZONE 'Asia/Kuala_Lumpur')::date);

-- Backfill existing rows once (null only). Prefer KL local date from generated_at.
UPDATE public.payroll_records
SET pay_date = ((generated_at AT TIME ZONE 'Asia/Kuala_Lumpur')::date)
WHERE pay_date IS NULL
  AND generated_at IS NOT NULL;

UPDATE public.payroll_records
SET pay_date = ((now() AT TIME ZONE 'Asia/Kuala_Lumpur')::date)
WHERE pay_date IS NULL;
