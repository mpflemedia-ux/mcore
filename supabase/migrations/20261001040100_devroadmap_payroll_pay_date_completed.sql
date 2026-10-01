-- Roadmap: editable payslip Pay Date (payroll_records.pay_date)
-- WRITE-ONLY — run in Supabase SQL Editor after PR merge.
-- Columns used: title, description, module, stage, pr_url (schema variant tolerant)

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.dev_roadmap_items
    WHERE title ILIKE '%pay_date%payslip%'
       OR title ILIKE '%editable%Pay Date%'
       OR title ILIKE '%Tarikh Bayaran%pay_date%'
  ) THEN
    UPDATE public.dev_roadmap_items
    SET
      stage = 'completed',
      module = COALESCE(NULLIF(TRIM(module), ''), 'hr'),
      description = 'payroll_records.pay_date (date) + backfill from generated_at (KL). Overlay payslip-pay-date.js: _pdocPayDate prefers pay_date else generated_at; Payslip Detail date editor (HR); new rows DEFAULT Asia/Kuala_Lumpur today. generated_at no longer sole display source.',
      pr_url = 'https://github.com/mpflemedia-ux/mcore/pull/863'
    WHERE title ILIKE '%pay_date%payslip%'
       OR title ILIKE '%editable%Pay Date%'
       OR title ILIKE '%Tarikh Bayaran%pay_date%';
  ELSE
    INSERT INTO public.dev_roadmap_items (
      title, description, module, stage, pr_url
    ) VALUES (
      'HR: Editable payslip Pay Date (pay_date)',
      'payroll_records.pay_date (date) + backfill from generated_at (KL). Overlay payslip-pay-date.js: _pdocPayDate prefers pay_date else generated_at; Payslip Detail date editor (HR); new rows DEFAULT Asia/Kuala_Lumpur today. generated_at no longer sole display source.',
      'hr',
      'completed',
      'https://github.com/mpflemedia-ux/mcore/pull/863'
    );
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'dev_roadmap schema variant; skip: %', SQLERRM;
END $$;
