-- ============================================================================
-- Migration: mark Documents letterhead routing completed in dev_roadmap_items
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
    WHERE title ILIKE '%letterhead%rout%'
       OR title ILIKE '%docs%letterhead%'
       OR title ILIKE '%document%letterhead%'
       OR title ILIKE '%client%letterhead%routing%'
  ) THEN
    UPDATE public.dev_roadmap_items
    SET stage = 'completed',
        description = 'Documents routing locked: Client = letterhead company (not Bill To / description names). No Phion mention -> 05_Clients/{letterhead}/01-08 category; Phion mentioned -> Phion 01-09 paths. New client on Confirm seeds full client 01-08 tree. TNS invoice -> 05_Clients/TNS Consulting/06_Invoices & Payment (not Nuhea, not 02_Finance).',
        pr_url = 'https://github.com/mpflemedia-ux/mcore/pull/770',
        module = COALESCE(module, 'docs')
    WHERE title ILIKE '%letterhead%rout%'
       OR title ILIKE '%docs%letterhead%'
       OR title ILIKE '%document%letterhead%'
       OR title ILIKE '%client%letterhead%routing%';
  ELSE
    INSERT INTO public.dev_roadmap_items (title, description, module, stage, pr_url)
    VALUES (
      'Documents letterhead routing',
      'Documents routing locked: Client = letterhead company (not Bill To / description names). No Phion mention -> 05_Clients/{letterhead}/01-08 category; Phion mentioned -> Phion 01-09 paths. New client on Confirm seeds full client 01-08 tree. TNS invoice -> 05_Clients/TNS Consulting/06_Invoices & Payment (not Nuhea, not 02_Finance).',
      'docs',
      'completed',
      'https://github.com/mpflemedia-ux/mcore/pull/770'
    );
  END IF;
END $$;
