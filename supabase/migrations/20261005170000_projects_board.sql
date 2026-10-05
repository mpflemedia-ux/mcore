-- Projects board (client + internal). Run in Supabase SQL Editor. Do not auto-run.
-- Tenant isolation matches get_my_tenant_id(); platform admin keeps full access.

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'internal' CHECK (kind IN ('client', 'internal')),
  customer_id uuid NULL,
  color text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

CREATE TABLE IF NOT EXISTS public.project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id),
  title text NOT NULL,
  column_key text NOT NULL DEFAULT 'backlog' CHECK (column_key IN ('backlog', 'progress', 'review', 'done')),
  tag text NULL,
  assignee_employee_id uuid NULL,
  start_date date NULL,
  due_date date NULL,
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  notes text NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS projects_tenant_idx ON public.projects (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS project_tasks_project_idx ON public.project_tasks (project_id) WHERE deleted_at IS NULL;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS projects_tenant_all ON public.projects;
CREATE POLICY projects_tenant_all ON public.projects
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id() OR public.is_platform_admin())
  WITH CHECK (tenant_id = public.get_my_tenant_id() OR public.is_platform_admin());

DROP POLICY IF EXISTS project_tasks_tenant_all ON public.project_tasks;
CREATE POLICY project_tasks_tenant_all ON public.project_tasks
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id() OR public.is_platform_admin())
  WITH CHECK (tenant_id = public.get_my_tenant_id() OR public.is_platform_admin());

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.dev_roadmap_items
    WHERE title ILIKE '%project task board%'
  ) THEN
    UPDATE public.dev_roadmap_items
    SET stage = 'completed',
        module = 'core',
        description = 'Projects page: client + internal boards, 4 columns, list, timeline, stats. Tables projects + project_tasks.'
    WHERE title ILIKE '%project task board%';
  ELSE
    INSERT INTO public.dev_roadmap_items (title, description, module, stage)
    VALUES (
      'Projects task board',
      'Projects page: client + internal boards, 4 columns, list, timeline, stats. Tables projects + project_tasks.',
      'core',
      'completed'
    );
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'dev_roadmap schema variant; skip: %', SQLERRM;
END $$;
