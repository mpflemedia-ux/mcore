insert into public.dev_roadmap_items (title, description, module, stage)
select 'Timeline matrix filter', 'Project timeline groups and filters by Eisenhower quadrant.', 'projects', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Timeline matrix filter');
