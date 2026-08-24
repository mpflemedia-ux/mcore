-- Platform Admin personal planner (appointments / todos / reminders)
CREATE TABLE IF NOT EXISTS public.platform_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  activity_type text NOT NULL DEFAULT 'todo'
    CHECK (activity_type IN ('appointment','todo','reminder','follow_up')),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','done','cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  due_at timestamptz,
  remind_at timestamptz,
  reminded_at timestamptz,
  related_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS platform_activities_owner_idx
  ON public.platform_activities (owner_user_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS platform_activities_remind_idx
  ON public.platform_activities (remind_at)
  WHERE deleted_at IS NULL AND reminded_at IS NULL AND status = 'open';

ALTER TABLE public.platform_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_activities_owner_all ON public.platform_activities;
CREATE POLICY platform_activities_owner_all ON public.platform_activities
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

COMMENT ON TABLE public.platform_activities IS 'SA personal planner — appointments, todos, reminders; not tenant operational data';
