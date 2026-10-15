-- Projects "Today & overdue tasks" card: tap a row to open that task (write-only; run manually in Supabase SQL Editor)
update public.dev_roadmap_items set stage = 'completed', module = 'core' where title = 'Projects: Today & overdue rows open the task';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Projects: Today & overdue rows open the task', 'pj-wa-daily.js: each row in the Today & overdue tasks card is tappable (click / Enter / Space, min 40px). Opens the task''s project (same path as the ?pj_task= deep link), expands the task Detail and scrolls to it with a short highlight. Counters unchanged.', 'core', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Projects: Today & overdue rows open the task');
