-- WRITE-ONLY. Mike runs in Supabase SQL Editor after accuracy deploy.
-- Doc import: UI language, members → suggested_assignee, no invented hours/matrix.

update public.dev_roadmap_items
set stage = 'completed', module = 'core',
    description = 'Import from doc accuracy: titles/todo/notes follow APP UI language (EN/BM); client sends tenant members; AI suggested_assignee from list only; est_hours/important/urgent only when document implies; Owner preselect if all tasks agree. OCR two-pass unchanged.'
where title = 'Doc import accuracy — UI lang + assignee map';

insert into public.dev_roadmap_items (title, description, module, stage)
select
  'Doc import accuracy — UI lang + assignee map',
  'Import from doc accuracy: titles/todo/notes follow APP UI language (EN/BM); client sends tenant members; AI suggested_assignee from list only; est_hours/important/urgent only when document implies; Owner preselect if all tasks agree. OCR two-pass unchanged.',
  'core',
  'completed'
where not exists (
  select 1 from public.dev_roadmap_items where title = 'Doc import accuracy — UI lang + assignee map'
);
