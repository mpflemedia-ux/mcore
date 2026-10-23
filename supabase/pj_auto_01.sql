-- M-Core Projects automation: checklist steps, repeating tasks, import log (doc / Telegram), scheduler for daily summary + repeats,
-- System Development entries. WRITE-ONLY: run manually in Supabase SQL Editor. Rerun-safe. Plain SQL only (no functions, no dollar quoting).
-- Order: 1) deploy Edge Functions ai-proxy, pj-auto (--no-verify-jwt), telegram-webhook  2) run this file.
-- Needs: pj_multi_01.sql (project_task_assignees) and push_02.sql (pg_cron + pg_net + Vault secret 'push_cron_secret').

-- 1) Checklist steps per task (task progress follows done / total when a task has steps)
create table if not exists public.project_task_checklist (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  task_id uuid not null references public.project_tasks(id),
  label text not null,
  done boolean not null default false,
  done_at timestamptz,
  done_by uuid,
  sort_order int not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  deleted_at timestamptz);
alter table public.project_task_checklist drop constraint if exists project_task_checklist_label_chk;
alter table public.project_task_checklist add constraint project_task_checklist_label_chk check (char_length(label) between 1 and 300);
create index if not exists project_task_checklist_task_idx on public.project_task_checklist (tenant_id, task_id) where deleted_at is null;

alter table public.project_task_checklist enable row level security;
drop policy if exists project_task_checklist_read on public.project_task_checklist;
create policy project_task_checklist_read on public.project_task_checklist for select to authenticated using (
  tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
  or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));
drop policy if exists project_task_checklist_ins on public.project_task_checklist;
create policy project_task_checklist_ins on public.project_task_checklist for insert to authenticated with check (
  deleted_at is null and (
    tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
    or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'))
  and exists (select 1 from public.project_tasks k where k.id = task_id and k.tenant_id = project_task_checklist.tenant_id));
drop policy if exists project_task_checklist_upd on public.project_task_checklist;
create policy project_task_checklist_upd on public.project_task_checklist for update to authenticated using (
  tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
  or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'))
  with check (
  tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
  or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));
grant select, insert, update on public.project_task_checklist to authenticated;
revoke all on public.project_task_checklist from anon;

-- 2) Repeating tasks (the next copy is made by Edge Function pj-auto; recur_spawned_at marks "copy already made / series ended")
alter table public.project_tasks add column if not exists recur_rule text;
alter table public.project_tasks add column if not exists recur_until date;
alter table public.project_tasks add column if not exists recur_parent_id uuid references public.project_tasks(id);
alter table public.project_tasks add column if not exists recur_spawned_at timestamptz;
alter table public.project_tasks drop constraint if exists project_tasks_recur_rule_chk;
alter table public.project_tasks add constraint project_tasks_recur_rule_chk
  check (recur_rule is null or recur_rule in ('daily', 'weekdays', 'weekly', 'monthly'));
create index if not exists project_tasks_recur_due_idx on public.project_tasks (due_date)
  where recur_rule is not null and recur_spawned_at is null and deleted_at is null;

-- 3) Automation log: once-only keys for daily summary (pjd:user:day), Telegram updates (tgu:id) and photo albums (tgmg:id).
--    Service role only (Edge Functions); no policies = no access for app users.
create table if not exists public.pj_auto_log (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null,
  tenant_id uuid,
  user_id uuid,
  kind text not null,
  project_id uuid,
  ref text,
  created_at timestamptz not null default now());
create unique index if not exists pj_auto_log_key_uq on public.pj_auto_log (dedupe_key);
alter table public.pj_auto_log enable row level security;
revoke all on public.pj_auto_log from anon, authenticated;

-- 4) Scheduler: every 15 minutes call pj-auto {"action":"tick"} with the same Vault secret push-send uses (push_cron_secret).
--    Daily summary goes out only for tenants that switch it on (Projects -> Today & overdue -> "Daily summary at 9:00 AM").
select cron.unschedule(jobid) from cron.job where jobname = 'mcore-pj-auto';
select cron.schedule(
  'mcore-pj-auto',
  '*/15 * * * *',
  'select net.http_post(url := ''https://wjqhhnjlgoigoagsnsen.supabase.co/functions/v1/pj-auto'', headers := jsonb_build_object(''Content-Type'', ''application/json'', ''x-push-secret'', (select decrypted_secret from vault.decrypted_secrets where name = ''push_cron_secret'')), body := ''{"action":"tick"}''::jsonb, timeout_milliseconds := 30000)'
);

-- 5) System Development entries
update public.dev_roadmap_items set stage = 'completed', module = 'core' where title = 'Projects: Import from doc (AI)';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Projects: Import from doc (AI)', 'Projects -> Import from doc (tools button + mobile menu): upload PDF/photos or take a photo; ai-proxy doc_to_project_tasks drafts project + tasks (sentence-case titles, working-day due dates moved off weekends/public holidays, hours, matrix, checklist steps); preview to tick/edit, pick existing or new project and owner (default = me), duplicate warning, owner workload this week; Create writes tasks, owner row, checklist, uploads the source file to project Files.', 'core', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Projects: Import from doc (AI)');

update public.dev_roadmap_items set stage = 'completed', module = 'core' where title = 'Projects: task checklist with auto progress';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Projects: task checklist with auto progress', 'Task Detail checklist (add / tick / remove steps, "use To do lines from Update"); task progress = done/total, written to the task and every assignee row; card badge 2/4. Table project_task_checklist.', 'core', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Projects: task checklist with auto progress');

update public.dev_roadmap_items set stage = 'completed', module = 'core' where title = 'Projects: default reminder and start date';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Projects: default reminder and start date', 'Picking a due date with Reminder = None pre-selects 1 day before and fills an empty Start with today (visible before Save). New tasks start today. AI import uses sentence-case titles.', 'core', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Projects: default reminder and start date');

update public.dev_roadmap_items set stage = 'completed', module = 'core' where title = 'Projects: daily 9 AM summary';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Projects: daily 9 AM summary', 'Tenant switch on the Today & overdue card (push_settings.settings.pj_digest). Edge Function pj-auto (cron every 15 min) sends each person one notification with tasks due today + overdue; push-send delivers to phone/Telegram. "Send mine now" test button.', 'core', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Projects: daily 9 AM summary');

update public.dev_roadmap_items set stage = 'completed', module = 'core' where title = 'Projects: repeating tasks';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Projects: repeating tasks', 'Task Detail Repeat: every day / weekday / week / month + optional until date. pj-auto makes one next copy after Done or when the due date passes (assignees + checklist copied, missed periods skipped). Columns recur_rule, recur_until, recur_parent_id, recur_spawned_at.', 'core', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Projects: repeating tasks');

update public.dev_roadmap_items set stage = 'completed', module = 'core' where title = 'Projects: import from Telegram';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Projects: import from Telegram', 'Send a PDF or photo to the M-Core bot (linked account): telegram-webhook reads it, AI drafts tasks, creates them in Backlog with tag AI Import, owner = your staff record, duplicates skipped, caption picks the project, bot replies with a link. Needs TELEGRAM_WEBHOOK_SECRET + webhook secret_token.', 'core', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Projects: import from Telegram');

notify pgrst, 'reload schema';

-- 6) Checks (read-only)
select jobid, jobname, schedule, active from cron.job where jobname = 'mcore-pj-auto';
select count(*) as checklist_table_ok from public.project_task_checklist;
select column_name from information_schema.columns where table_schema = 'public' and table_name = 'project_tasks' and column_name like 'recur_%' order by 1;
