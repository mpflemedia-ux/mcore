select title, column_key, progress, tag, due_date
from public.project_tasks
where deleted_at is null
  and (
    title ilike '%Eisenhower%'
    or title ilike '%Dates Reflect%'
    or title ilike '%Delete Button%'
    or title ilike '%Service Request%'
  )
order by title;
