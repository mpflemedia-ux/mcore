-- ============================================================================
-- Migration: mark Documents interval-loop fix completed in dev_roadmap_items
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
    WHERE title ILIKE '%docs%loop%' OR title ILIKE '%document%interval%' OR title ILIKE '%docs-slot-fix%'
  ) THEN
    UPDATE public.dev_roadmap_items
    SET stage = 'completed',
        description = 'Documents review thrash/loop — docs-slot-fix was overwriting _docsAiClass.folder every 300ms; docs-ai-apply repainted DOM every 350ms without dirty-check. Fixed early-return + dirty paints. PR #767 merged.',
        pr_url = 'https://github.com/mpflemedia-ux/mcore/pull/767',
        module = COALESCE(module, 'docs')
    WHERE title ILIKE '%docs%loop%' OR title ILIKE '%document%interval%' OR title ILIKE '%docs-slot-fix%';
  ELSE
    INSERT INTO public.dev_roadmap_items (title, description, module, stage, pr_url)
    VALUES (
      'Documents review interval loop',
      'Documents review thrash/loop — docs-slot-fix was overwriting _docsAiClass.folder every 300ms; docs-ai-apply repainted DOM every 350ms without dirty-check. Fixed early-return + dirty paints. PR #767 merged.',
      'docs',
      'completed',
      'https://github.com/mpflemedia-ux/mcore/pull/767'
    );
  END IF;
END $$;
