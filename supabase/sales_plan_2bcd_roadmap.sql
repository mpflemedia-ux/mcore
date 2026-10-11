-- Sales Plan phase 2b: dev roadmap entry (Admin -> System Development).
-- Written by the build, NOT run. Owner runs it in Supabase SQL editor.
-- Stages used by app: 'idea' | 'planned' | 'in_progress' | 'completed'.
DO $$
DECLARE
  v_title text := 'Sales Plan module (phase 2b: overview, weekly update, milestones)';
  v_desc  text := 'Sales Plan phase 2b: Overview tab (KPI cards, SVG monthly target vs actual chart, monthly KPI table with statuses, milestones, computed alerts), Weekly Update tab (Manual/Auto source with confirm, editable PIC cells, live Ach%/AOV/status, auto actuals via sales_plan_auto_actuals, summary cards, save), Milestones tab (admin CRUD, PIC actual/notes, Achieved/At Risk/Overdue/Pending, links to period GMV/units/orders, batch, rolling 30d, plan GMV). No schema change.';
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
   WHERE title = 'Sales Plan module (phase 2b: overview, weekly update, milestones)' AND completed_at IS NULL;
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'no completed_at column; skip';
END $$;
-- Sales Plan phase 2c: dev roadmap entry (Admin -> System Development).
-- Written by the build, NOT run. Owner runs it in Supabase SQL editor.
-- Stages used by app: 'idea' | 'planned' | 'in_progress' | 'completed'.
DO $$
DECLARE
  v_title text := 'Sales Plan module (phase 2c: stock and financing)';
  v_desc  text := 'Sales Plan phase 2c: Stock and Financing tab (batch cards, batch CRUD, funding draw with auto journal Dr inventory/bank Cr financier loan, repayment sheet with pro-rata principal/fee split, bank account from COA, journal preview, reversal on delete, locked-period and FX handling). No schema change.';
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
   WHERE title = 'Sales Plan module (phase 2c: stock and financing)' AND completed_at IS NULL;
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'no completed_at column; skip';
END $$;
-- Sales Plan phase 2d: dev roadmap entry (Admin -> System Development).
-- Written by the build, NOT run. Owner runs it in Supabase SQL editor.
-- Stages used by app: 'idea' | 'planned' | 'in_progress' | 'completed'.
DO $$
DECLARE
  v_title text := 'Sales Plan module (phase 2d: alerts, import, weekly report)';
  v_desc  text := 'Sales Plan phase 2d: alerts on module open (off-track weeks, milestones at risk/overdue, repayments due/overdue) deduped in sales_plan_alerts and sent to bell + Telegram; Excel/CSV import (KeraPlus format + simple CSV template, SheetJS lazy-loaded, preview before save); bilingual print-friendly weekly report. No schema change.';
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
   WHERE title = 'Sales Plan module (phase 2d: alerts, import, weekly report)' AND completed_at IS NULL;
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'no completed_at column; skip';
END $$;
