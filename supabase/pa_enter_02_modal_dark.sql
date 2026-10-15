-- PA big-action confirm modal: dark/light theme fix (write-only; run manually in Supabase SQL Editor)
update public.dev_roadmap_items set stage = 'completed', module = 'admin' where title = 'PA big-action confirm: dark mode readable';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'PA big-action confirm: dark mode readable', 'pa-guard.js confirm dialog now uses app theme vars (--bg-card/--text/--text-2/--border-2) via scoped #pa-big CSS; darker backdrop; action label shown as small pill; Cancel uses btn-outline.', 'admin', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'PA big-action confirm: dark mode readable');
