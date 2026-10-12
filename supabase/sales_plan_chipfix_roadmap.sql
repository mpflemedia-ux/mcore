-- Sales Plan fix: product filter chips fit the card (dev roadmap entry, Admin -> System Development).
-- Written by the build, NOT run. Owner runs it in Supabase SQL editor. Idempotent.
DO $$
DECLARE
  v_title text := 'Sales Plan fix: product filter chips fit on mobile';
  v_desc  text := 'Sales Plan setup form: long product names in the Product filter chips overflowed the card on mobile. Chips now wrap inside the card (max-width 100%, full name readable), 40px tap target, selected state unchanged; scoped to .sp-chiprow in sales-plan-css5.js. No schema change.';
BEGIN
  IF EXISTS (SELECT 1 FROM public.dev_roadmap_items WHERE title = v_title) THEN
    UPDATE public.dev_roadmap_items SET stage = 'completed', module = 'core', description = v_desc WHERE title = v_title;
  ELSE
    INSERT INTO public.dev_roadmap_items (title, description, module, stage) VALUES (v_title, v_desc, 'core', 'completed');
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'dev_roadmap schema variant; skip: %', SQLERRM;
END $$;

-- Optional: stamp completed_at when that column exists (separate block so a missing column cannot undo the upsert above).
DO $$
BEGIN
  UPDATE public.dev_roadmap_items SET completed_at = now()
   WHERE title = 'Sales Plan fix: product filter chips fit on mobile' AND completed_at IS NULL;
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'no completed_at column; skip';
END $$;
