-- Projects summary: task activity timestamp for "quiet 7 days". WRITE-ONLY. Rerun-safe.
alter table public.project_tasks add column if not exists updated_at timestamptz default now();
update public.project_tasks set updated_at = coalesce(updated_at, created_at, now()) where updated_at is null;

create or replace function public.project_tasks_touch()
returns trigger language plpgsql as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

drop trigger if exists project_tasks_touch on public.project_tasks;
create trigger project_tasks_touch before update on public.project_tasks
for each row execute function public.project_tasks_touch();

update public.dev_roadmap_items set stage = 'completed', module = 'projects',
  description = 'Projects summary: total projects, active, done, empty, late projects, client/internal, quiet 7 days, assignee load. Same strip on dashboard card.'
  where title = 'Projects: total project summary';
insert into public.dev_roadmap_items (title, description, module, stage)
  select 'Projects: total project summary',
    'Projects summary: total projects, active, done, empty, late projects, client/internal, quiet 7 days, assignee load. Same strip on dashboard card.',
    'projects', 'completed'
  where not exists (select 1 from public.dev_roadmap_items where title = 'Projects: total project summary');
