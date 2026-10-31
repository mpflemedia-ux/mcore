-- DK mobile cards: icon-only action buttons (e.g. Employees pencil edit) did nothing on tap.
-- Code-only fix in app/dk-cards.js?v=5 (sw mcore-shell-v55). Roadmap record only. Idempotent.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.dev_roadmap_items WHERE title = 'Mobile cards: icon-only action buttons tap fix') THEN
    UPDATE public.dev_roadmap_items
    SET stage = 'completed',
        module = 'core',
        description = 'Mobile card lists (dk-cards.js): tapping an icon-only button (pencil edit on HR > Employees and other card lists) did nothing because a capture-phase stopPropagation on the cloned button blocked the click before it reached the icon. Moved to bubble phase. dk-cards.js?v=5, sw v55.'
    WHERE title = 'Mobile cards: icon-only action buttons tap fix';
  ELSE
    INSERT INTO public.dev_roadmap_items (title, description, module, stage)
    VALUES (
      'Mobile cards: icon-only action buttons tap fix',
      'Mobile card lists (dk-cards.js): tapping an icon-only button (pencil edit on HR > Employees and other card lists) did nothing because a capture-phase stopPropagation on the cloned button blocked the click before it reached the icon. Moved to bubble phase. dk-cards.js?v=5, sw v55.',
      'core',
      'completed'
    );
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'dev_roadmap schema variant; skip: %', SQLERRM;
END $$;
