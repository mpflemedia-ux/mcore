alter table public.platform_activities
  add column if not exists project_task_id uuid;

create unique index if not exists platform_activities_project_task_idx
  on public.platform_activities (project_task_id)
  where project_task_id is not null and deleted_at is null;

insert into public.dev_roadmap_items (title, description, module, stage)
select 'Project tasks on planner',
       'Saving a project task mirrors one planner todo linked by project_task_id.',
       'projects', 'completed'
where not exists (
  select 1 from public.dev_roadmap_items where title = 'Project tasks on planner'
);
