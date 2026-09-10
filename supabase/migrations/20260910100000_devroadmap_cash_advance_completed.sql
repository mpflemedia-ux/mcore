-- ============================================================================
-- Migration: mark "Cash Advance / Panjar" completed in dev_roadmap_items
-- (Admin -> System Development).
--
-- Data-only. Safe to re-run. completed_at is set by the existing DB trigger
-- when stage changes to 'completed'.
--
-- NOTE: Supabase migrations do NOT auto-run from GitHub — run this in
-- Supabase Dashboard -> SQL Editor.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.dev_roadmap_items
    WHERE title ILIKE '%cash advance%' OR title ILIKE '%panjar%'
  ) THEN
    UPDATE public.dev_roadmap_items
    SET stage = 'completed',
        description = 'Cash Advance / Panjar — apply → approve/reject, journal on approval (Dr Employee Advance / Cr Cash), payroll recovery via Salary Disbursement picker + correcting entry. Table + RLS live on wjqhhnjlgoigoagsnsen. PR #564 merged.',
        pr_url = 'https://github.com/mpflemedia-ux/mcore/pull/564',
        module = COALESCE(module, 'hr')
    WHERE title ILIKE '%cash advance%' OR title ILIKE '%panjar%';
  ELSE
    INSERT INTO public.dev_roadmap_items (title, description, module, stage, pr_url)
    VALUES (
      'Cash Advance / Panjar',
      'Cash Advance / Panjar — apply → approve/reject, journal on approval (Dr Employee Advance / Cr Cash), payroll recovery via Salary Disbursement picker + correcting entry. Table + RLS live on wjqhhnjlgoigoagsnsen. PR #564 merged.',
      'hr',
      'completed',
      'https://github.com/mpflemedia-ux/mcore/pull/564'
    );
  END IF;
END $$;
