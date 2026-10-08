update public.project_tasks
set column_key = 'backlog'
where deleted_at is null
  and coalesce(progress, 0) = 0
  and column_key is distinct from 'backlog';
