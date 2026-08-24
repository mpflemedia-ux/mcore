-- Allow activity_type = event
ALTER TABLE public.platform_activities DROP CONSTRAINT IF EXISTS platform_activities_type_chk;
ALTER TABLE public.platform_activities ADD CONSTRAINT platform_activities_type_chk
  CHECK (activity_type IN ('appointment', 'todo', 'reminder', 'follow_up', 'event'));
