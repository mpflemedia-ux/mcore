-- M-Core Projects - Public Report Link, phase 2: scope a link to ONE task instead of the whole
-- project (admin chooses per link), WhatsApp share (code-only, no SQL needed for that part), full
-- activity (comments, not just screenshots) on the report. Run after projects_share_01.sql.
-- Rerun-safe. Plain SQL only (no CREATE FUNCTION, no $$, no pgcrypto).
--
-- task_id NULL = whole-project report (unchanged behaviour); task_id set = that one task's report.
-- The old "1 active link per project" unique index is replaced with two: at most 1 active
-- whole-project link, AND at most 1 active link per individual task - both can be active together.
alter table public.project_share_links add column if not exists task_id uuid references public.project_tasks(id);

drop index if exists project_share_links_active_uq;
create unique index if not exists project_share_links_active_project_uq on public.project_share_links (project_id) where task_id is null and revoked_at is null and deleted_at is null;
create unique index if not exists project_share_links_active_task_uq on public.project_share_links (task_id) where task_id is not null and revoked_at is null and deleted_at is null;

notify pgrst, 'reload schema';

update public.dev_roadmap_items set stage = 'completed', module = 'projects',
  description = 'Projects public report link, phase 2: admin can share the WHOLE project or ONE task only (task_id on project_share_links), "Share via WhatsApp" button (auto-fills the task assignee''s phone when set), report shows full activity (comments + screenshots, not just attachments) per task.'
where title = 'Projects: Public report link - task scope + WhatsApp + activity';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Projects: Public report link - task scope + WhatsApp + activity', 'Projects public report link, phase 2: admin can share the WHOLE project or ONE task only (task_id on project_share_links), "Share via WhatsApp" button (auto-fills the task assignee''s phone when set), report shows full activity (comments + screenshots, not just attachments) per task.', 'projects', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Projects: Public report link - task scope + WhatsApp + activity');
