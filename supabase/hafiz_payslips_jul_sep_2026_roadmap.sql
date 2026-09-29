-- Roadmap: Hafiz payslips statutory/partial (Jul–Sep 2026)
-- Columns only: title, description, module, stage, pr_url
-- Run in Supabase SQL Editor after PR merge.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.dev_roadmap_items
    WHERE title ILIKE '%Hafiz%payslip%Jul%Sep%2026%'
       OR title ILIKE '%payslip statutory%partial%'
       OR title ILIKE '%statutory exempt%amount_paid%payslip%'
  ) THEN
    UPDATE public.dev_roadmap_items
    SET
      stage = 'completed',
      module = COALESCE(NULLIF(TRIM(module), ''), 'hr'),
      description = 'DB-driven employee epf_exempt + skip_employer_contrib; payroll_records amount_paid / balance_outstanding / payment_note + snapshots. Overlay payslip-statutory-partial.js: calc honors flags, payslip hides employer block when skip, shows Net/Amount Paid/Balance; Run Payroll soft-fails missing columns; employee form toggles. Seed Hafiz CTO Jul–Sep 2026 on ATAS ANGIN (EPF 0, no employer, partial pay). No app hardcode of names/amounts.',
      pr_url = 'https://github.com/mpflemedia-ux/mcore/pull/858'
    WHERE title ILIKE '%Hafiz%payslip%Jul%Sep%2026%'
       OR title ILIKE '%payslip statutory%partial%'
       OR title ILIKE '%statutory exempt%amount_paid%payslip%';
  ELSE
    INSERT INTO public.dev_roadmap_items (
      title, description, module, stage, pr_url
    ) VALUES (
      'HR: Payslip statutory exempt + partial payment (Hafiz Jul–Sep 2026)',
      'DB-driven employee epf_exempt + skip_employer_contrib; payroll_records amount_paid / balance_outstanding / payment_note + snapshots. Overlay payslip-statutory-partial.js: calc honors flags, payslip hides employer block when skip, shows Net/Amount Paid/Balance; Run Payroll soft-fails missing columns; employee form toggles. Seed Hafiz CTO Jul–Sep 2026 on ATAS ANGIN (EPF 0, no employer, partial pay). No app hardcode of names/amounts.',
      'hr',
      'completed',
      'https://github.com/mpflemedia-ux/mcore/pull/858'
    );
  END IF;
END $$;
