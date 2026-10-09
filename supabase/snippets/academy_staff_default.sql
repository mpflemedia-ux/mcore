UPDATE public.tenants
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{roles,staff}',
  (
    SELECT to_jsonb(array_agg(DISTINCT x))
    FROM (
      SELECT jsonb_array_elements_text(COALESCE(config->'roles'->'staff', '[]'::jsonb)) AS x
      UNION ALL
      SELECT 'sales_academy'
    ) s
  ),
  true
)
WHERE deleted_at IS NULL
  AND jsonb_typeof(COALESCE(config->'roles'->'staff', '[]'::jsonb)) = 'array';

UPDATE public.crm_activities
SET deleted_at = now()
WHERE notes LIKE 'SA-SAMPLE%' AND deleted_at IS NULL;

UPDATE public.crm_stage_history h
SET deleted_at = now()
WHERE h.deleted_at IS NULL
  AND h.from_stage IS NULL
  AND EXISTS (
    SELECT 1 FROM public.crm_activities a
    WHERE a.record_id = h.record_id AND a.notes LIKE 'SA-SAMPLE%'
  );

INSERT INTO public.dev_roadmap_items (title, module, stage)
SELECT 'Sales Academy evidence scoring', 'sales', 'completed'
WHERE NOT EXISTS (
  SELECT 1 FROM public.dev_roadmap_items WHERE title = 'Sales Academy evidence scoring'
);
