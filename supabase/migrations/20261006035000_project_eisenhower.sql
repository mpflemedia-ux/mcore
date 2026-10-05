-- Eisenhower flags on project tasks. Run in Supabase SQL Editor.
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS is_important boolean NOT NULL DEFAULT false;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS is_urgent boolean NOT NULL DEFAULT false;
