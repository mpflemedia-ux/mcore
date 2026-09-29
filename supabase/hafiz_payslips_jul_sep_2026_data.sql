-- Hafiz payslips Jul–Sep 2026 — ATAS ANGIN MY SDN. BHD. tenant only.
-- WRITE-ONLY: Mike runs in Supabase SQL Editor AFTER schema migration
--   20260930030000_payslip_statutory_partial.sql
-- Idempotent. No hard delete. Soft-delete aware.
-- Amounts / name / position come from this data SQL (not app hardcode).
-- Employer display name on payslip = tenants.name (company profile), not this file.

DO $$
DECLARE
  tn_id uuid;
  emp_id uuid;
  net_amt numeric(14,2);
  rec record;
BEGIN
  SELECT id INTO tn_id
  FROM public.tenants
  WHERE name ILIKE 'ATAS ANGIN MY SDN. BHD.'
    AND deleted_at IS NULL
  ORDER BY CASE WHEN is_active THEN 0 ELSE 1 END
  LIMIT 1;

  IF tn_id IS NULL THEN
    RAISE EXCEPTION 'Tenant ATAS ANGIN MY SDN. BHD. not found';
  END IF;

  SELECT id INTO emp_id
  FROM public.employees
  WHERE tenant_id = tn_id
    AND deleted_at IS NULL
    AND name ILIKE 'MOHD HAFIZ BIN ABDUL KADIR'
  ORDER BY created_at ASC
  LIMIT 1;

  IF emp_id IS NULL THEN
    INSERT INTO public.employees (
      tenant_id, name, position, basic_salary,
      epf_exempt, skip_employer_contrib,
      zakat_enabled, zakat_amount
    ) VALUES (
      tn_id,
      'MOHD HAFIZ BIN ABDUL KADIR',
      'CTO',
      6000.00,
      true,
      true,
      false,
      0
    )
    RETURNING id INTO emp_id;
  ELSE
    UPDATE public.employees SET
      position = 'CTO',
      basic_salary = 6000.00,
      epf_exempt = true,
      skip_employer_contrib = true
    WHERE id = emp_id AND tenant_id = tn_id AND deleted_at IS NULL;
  END IF;

  FOR rec IN
    SELECT * FROM (VALUES
      (7,  2026, 6000.00::numeric, 3500.00::numeric, 2500.00::numeric, 'Outstanding'::text),
      (8,  2026, 6000.00::numeric, 3000.00::numeric, 3000.00::numeric, 'Outstanding'::text),
      (9,  2026, 6000.00::numeric,    0.00::numeric, 6000.00::numeric, 'Payable 7 Oct 2026'::text)
    ) AS t(month, year, basic_salary, amount_paid, balance_outstanding, payment_note)
  LOOP
    net_amt := rec.basic_salary;

    INSERT INTO public.payroll_records (
      tenant_id, employee_id, month, year,
      basic_salary,
      epf_employee, epf_employer,
      socso_employee, socso_employer,
      eis_employee, eis_employer,
      pcb, zakat, net_pay,
      epf_exempt, skip_employer_contrib,
      amount_paid, balance_outstanding, payment_note,
      generated_at
    ) VALUES (
      tn_id, emp_id, rec.month, rec.year,
      rec.basic_salary,
      0, 0,
      0, 0,
      0, 0,
      0, 0, net_amt,
      true, true,
      rec.amount_paid, rec.balance_outstanding, rec.payment_note,
      now()
    )
    ON CONFLICT (tenant_id, employee_id, month, year) DO UPDATE SET
      basic_salary = EXCLUDED.basic_salary,
      epf_employee = 0,
      epf_employer = 0,
      socso_employee = 0,
      socso_employer = 0,
      eis_employee = 0,
      eis_employer = 0,
      pcb = 0,
      zakat = COALESCE(public.payroll_records.zakat, 0),
      net_pay = EXCLUDED.net_pay,
      epf_exempt = true,
      skip_employer_contrib = true,
      amount_paid = EXCLUDED.amount_paid,
      balance_outstanding = EXCLUDED.balance_outstanding,
      payment_note = EXCLUDED.payment_note,
      generated_at = COALESCE(public.payroll_records.generated_at, now());
  END LOOP;

  RAISE NOTICE 'Hafiz payslips ready: employee_id=%, tenant_id=% (Jul/Aug/Sep 2026)', emp_id, tn_id;
END $$;
