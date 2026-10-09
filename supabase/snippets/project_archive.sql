ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS archived_at timestamptz;
INSERT INTO public.dev_roadmap_items (title, module, stage)
SELECT 'Project archive', 'projects', 'completed'
WHERE NOT EXISTS (SELECT 1 FROM public.dev_roadmap_items WHERE title = 'Project archive');
