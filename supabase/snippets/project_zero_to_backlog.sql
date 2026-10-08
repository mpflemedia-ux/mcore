update public.project_tasks
set column_key = 'backlog'
where deleted_at is null
  and column_key = 'progress'
  and coalesce(progress, 0) = 0;
