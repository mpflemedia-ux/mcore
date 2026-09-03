-- ============================================================================
-- Migration: mark a "landing copy" dev_roadmap_items entry completed, IF
-- one exists — unlike prior dev_roadmap_items migrations in this repo, no
-- INSERT fallback here (task explicitly said "jika ada", only update an
-- existing item, don't create one). Data-only, no schema change, safe to
-- re-run.
-- ============================================================================

UPDATE public.dev_roadmap_items
SET stage = 'completed'
WHERE title ILIKE '%landing%' AND title ILIKE '%copy%'
  AND stage <> 'completed';
