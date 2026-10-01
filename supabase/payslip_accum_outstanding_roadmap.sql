-- Roadmap: Payslip Accumulated Outstanding (Baki Belum Bayar Terkumpul)
-- WRITE-ONLY — Mike runs in Supabase SQL Editor after PR merge.
-- No schema migration — computed on render from payroll_records.balance_outstanding.
-- Definition: Σ period balance for same tenant+employee where (year,month) <= slip
--   AND period is outstanding-tracked (payment_note OR partial amount_paid), matching
--   Payment/Balance gate. Virgin unpaid Run-Payroll rows (paid=0, no note) excluded.
-- Hafiz (live Jul–Sep): 2500+3000+3000 = 8500 on Sep slip.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.dev_roadmap_items
    WHERE title ILIKE '%Accumulated Outstanding%'
       OR title ILIKE '%Baki Belum Bayar Terkumpul%'
       OR title ILIKE '%balance outstanding terkumpul%'
  ) THEN
    UPDATE public.dev_roadmap_items
    SET
      stage = 'completed',
      module = COALESCE(NULLIF(TRIM(module), ''), 'hr'),
      description = 'Overlay payslip-accum-outstanding.js: under Balance Outstanding on print/PDF, show Accumulated Outstanding (BM: Baki Belum Bayar Terkumpul) = sum of tracked per-period balance_outstanding for tenant+employee through current (year,month). Computed on render (cache warm before detail/print); no denormalized column. Only when Payment/Balance section shows. Hafiz Jul–Sep → 8500.',
      pr_url = 'https://github.com/mpflemedia-ux/mcore/pull/PR_NUMBER'
    WHERE title ILIKE '%Accumulated Outstanding%'
       OR title ILIKE '%Baki Belum Bayar Terkumpul%'
       OR title ILIKE '%balance outstanding terkumpul%';
  ELSE
    INSERT INTO public.dev_roadmap_items (
      title, description, module, stage, pr_url
    ) VALUES (
      'HR: Payslip Accumulated Outstanding (Terkumpul)',
      'Overlay payslip-accum-outstanding.js: under Balance Outstanding on print/PDF, show Accumulated Outstanding (BM: Baki Belum Bayar Terkumpul) = sum of tracked per-period balance_outstanding for tenant+employee through current (year,month). Computed on render (cache warm before detail/print); no denormalized column. Only when Payment/Balance section shows. Hafiz Jul–Sep → 8500.',
      'hr',
      'completed',
      'https://github.com/mpflemedia-ux/mcore/pull/PR_NUMBER'
    );
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'dev_roadmap schema variant; skip: %', SQLERRM;
END $$;
