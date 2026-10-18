-- M-Core Projects - Public Report Link, phase 3: share a report link through the SAME WhatsApp
-- template/recipient/preview sheet as task reminders (project_task_shares), instead of a direct
-- wa.me redirect. Run after projects_wa_share_01.sql and projects_share_02.sql. Rerun-safe.
--
-- template check: project_task_shares_template_check is the default Postgres name for the
-- unnamed inline "template text ... check (template in (...))" column check created in
-- projects_wa_share_01.sql (same naming convention as project_task_shares_lang_check /
-- project_task_shares_recipient_kind_check, which this file does not touch).
alter table public.project_task_shares drop constraint if exists project_task_shares_template_check;
alter table public.project_task_shares add constraint project_task_shares_template_check
  check (template in ('reminder', 'request_info', 'done', 'client', 'summary', 'daily', 'report'));

-- allow a whole-project report share to log with task_id null (same exception 'daily' already has)
alter table public.project_task_shares drop constraint if exists project_task_shares_task_chk;
alter table public.project_task_shares add constraint project_task_shares_task_chk
  check (task_id is not null or template in ('daily', 'report'));

notify pgrst, 'reload schema';

update public.dev_roadmap_items set stage = 'completed', module = 'projects',
  description = 'Projects public report share: "Share via WhatsApp" now reuses the same template/recipient/preview sheet as task reminders (window.PJW.share) instead of a direct wa.me redirect - staff/client/other recipient picker, editable preview, logged on project_task_shares (template=''report'', excluded from the task-card "Shared Nx" badge). Added a "Download QR" button to the share modal.'
where title = 'Projects: Public report link - WhatsApp share flow (template/recipient/preview)';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Projects: Public report link - WhatsApp share flow (template/recipient/preview)', 'Projects public report share: "Share via WhatsApp" now reuses the same template/recipient/preview sheet as task reminders (window.PJW.share) instead of a direct wa.me redirect - staff/client/other recipient picker, editable preview, logged on project_task_shares (template=''report'', excluded from the task-card "Shared Nx" badge). Added a "Download QR" button to the share modal.', 'projects', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Projects: Public report link - WhatsApp share flow (template/recipient/preview)');
