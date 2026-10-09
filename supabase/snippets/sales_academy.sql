-- Sales Academy layer on customers. Run once in Supabase SQL Editor.
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS pipeline_stage text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS next_follow_up_at date;

CREATE TABLE IF NOT EXISTS public.crm_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  record_id uuid NOT NULL,
  from_stage text,
  to_stage text,
  changed_by uuid,
  changed_at timestamptz DEFAULT now(),
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.crm_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  record_id uuid NOT NULL,
  type text,
  notes text,
  occurred_at timestamptz DEFAULT now(),
  user_id uuid,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.academy_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  day int,
  sort int,
  title_en text,
  title_bm text,
  desc_en text,
  desc_bm text,
  xp int DEFAULT 0,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.academy_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  sort int,
  title_en text,
  title_bm text,
  content_en text,
  content_bm text,
  before_en text,
  before_bm text,
  after_en text,
  after_bm text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.academy_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid,
  item_type text,
  item_id uuid,
  completed_at timestamptz DEFAULT now(),
  xp_awarded int DEFAULT 0,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS academy_progress_once
  ON public.academy_progress (tenant_id, user_id, item_type, item_id)
  WHERE deleted_at IS NULL;

ALTER TABLE public.crm_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_stage_history_tenant ON public.crm_stage_history;
CREATE POLICY crm_stage_history_tenant ON public.crm_stage_history
  USING (tenant_id = (select tenant_id from public.user_profiles where id = auth.uid()))
  WITH CHECK (tenant_id = (select tenant_id from public.user_profiles where id = auth.uid()));
DROP POLICY IF EXISTS crm_activities_tenant ON public.crm_activities;
CREATE POLICY crm_activities_tenant ON public.crm_activities
  USING (tenant_id = (select tenant_id from public.user_profiles where id = auth.uid()))
  WITH CHECK (tenant_id = (select tenant_id from public.user_profiles where id = auth.uid()));
DROP POLICY IF EXISTS academy_missions_tenant ON public.academy_missions;
CREATE POLICY academy_missions_tenant ON public.academy_missions
  USING (tenant_id = (select tenant_id from public.user_profiles where id = auth.uid()))
  WITH CHECK (tenant_id = (select tenant_id from public.user_profiles where id = auth.uid()));
DROP POLICY IF EXISTS academy_modules_tenant ON public.academy_modules;
CREATE POLICY academy_modules_tenant ON public.academy_modules
  USING (tenant_id = (select tenant_id from public.user_profiles where id = auth.uid()))
  WITH CHECK (tenant_id = (select tenant_id from public.user_profiles where id = auth.uid()));
DROP POLICY IF EXISTS academy_progress_tenant ON public.academy_progress;
CREATE POLICY academy_progress_tenant ON public.academy_progress
  USING (tenant_id = (select tenant_id from public.user_profiles where id = auth.uid()))
  WITH CHECK (tenant_id = (select tenant_id from public.user_profiles where id = auth.uid()));

INSERT INTO public.dev_roadmap_items (title, module, stage)
SELECT 'Sales Academy on CRM', 'sales', 'completed'
WHERE NOT EXISTS (
  SELECT 1 FROM public.dev_roadmap_items WHERE title = 'Sales Academy on CRM'
);
