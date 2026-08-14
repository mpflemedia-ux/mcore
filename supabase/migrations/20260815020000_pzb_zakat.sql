-- PZB: monthly fixed zakat deduction (employee only) — all tenants
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS zakat_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS zakat_amount numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.payroll_records
  ADD COLUMN IF NOT EXISTS zakat numeric(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.employees.zakat_enabled IS 'Enable monthly zakat (PZB) deduction';
COMMENT ON COLUMN public.employees.zakat_amount IS 'Fixed RM amount deducted each payroll when zakat_enabled';
COMMENT ON COLUMN public.payroll_records.zakat IS 'Employee zakat deduction for the period';
