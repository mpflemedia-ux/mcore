update public.project_tasks
set column_key = case
  when progress >= 100 then 'done'
  when progress > 0 and column_key = 'backlog' then 'progress'
  else column_key
end
where deleted_at is null
  and (
    (coalesce(progress, 0) >= 100 and column_key is distinct from 'done')
    or (coalesce(progress, 0) > 0 and coalesce(progress, 0) < 100 and column_key = 'backlog')
  );
