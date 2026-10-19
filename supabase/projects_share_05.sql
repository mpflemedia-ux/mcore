-- M-Core Projects - Public Report Link, phase 5: let a project-mode (whole-project, no single task)
-- "leave a message" include up to 3 image attachments, same as task-mode links already get via
-- project_task_comments (which already has file_path/file_name/file_size - no change needed there).
-- Run after projects_share_01/02/03/04.sql. Rerun-safe.
--
-- body was NOT NULL + non-empty; a file-only row (no text) needs body nullable. The existing check
-- (length(btrim(body)) between 1 and 2000) still applies but is a no-op for body IS NULL (a CHECK
-- evaluating to NULL, not FALSE, is satisfied in Postgres), so it does not need to be touched.
alter table public.project_share_messages alter column body drop not null;
alter table public.project_share_messages
  add column if not exists file_path text check (file_path is null or length(file_path) <= 300),
  add column if not exists file_name text check (file_name is null or length(file_name) <= 200),
  add column if not exists file_size int check (file_size is null or file_size between 0 and 5242880);
alter table public.project_share_messages drop constraint if exists project_share_messages_body_or_file_chk;
alter table public.project_share_messages add constraint project_share_messages_body_or_file_chk
  check (coalesce(length(btrim(body)), 0) > 0 or file_path is not null);
notify pgrst, 'reload schema';

update public.dev_roadmap_items set stage = 'completed', module = 'projects',
  description = 'Public report link (pj_report=TOKEN): "Leave a message" now accepts up to 3 image attachments (JPG/PNG/WEBP/HEIC/GIF, 5MB each - project-comments bucket limit), on both task-mode links (saved to project_task_comments, shows in that task''s Activity feed) and project-mode links (saved to project_share_messages). Same 5-messages/hour rate limit as before, notifies tenant owner/admin with a 📎 marker when files are attached.'
where title = 'Projects: image attachments on public report link message';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Projects: image attachments on public report link message', 'Public report link (pj_report=TOKEN): "Leave a message" now accepts up to 3 image attachments (JPG/PNG/WEBP/HEIC/GIF, 5MB each - project-comments bucket limit), on both task-mode links (saved to project_task_comments, shows in that task''s Activity feed) and project-mode links (saved to project_share_messages). Same 5-messages/hour rate limit as before, notifies tenant owner/admin with a 📎 marker when files are attached.', 'projects', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Projects: image attachments on public report link message');
