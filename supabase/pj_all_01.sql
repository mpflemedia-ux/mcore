-- M-Core Projects: All projects board, Filter & Sort, Group by project/assignee, summary strip.
-- No schema changes. Write-only; run manually in Supabase SQL Editor. Rerun-safe. Plain SQL only.

update public.dev_roadmap_items set stage = 'completed', module = 'core'
where title = 'Projects: All projects board, Filter & Sort, Group by, summary';

insert into public.dev_roadmap_items (title, description, module, stage)
select 'Projects: All projects board, Filter & Sort, Group by, summary',
  'All projects board (tasks across projects with project pills). Mobile compact project selector + ⋯ menu. Filter & Sort sheet (assignee/project/status/tag/due/sort) with chips, localStorage per user+tenant, saved named filters, CSV export. Group board by project or assignee (read-only columns; no drag-reassign). Summary strip: total, overdue, done this week, est hours.',
  'core', 'completed'
where not exists (
  select 1 from public.dev_roadmap_items
  where title = 'Projects: All projects board, Filter & Sort, Group by, summary'
);
