-- M-Core Service Desk - multi-request groups (SG-YYYYMM-NNNN), drafts, templates, group thread, group rating,
-- public link multi-service (1 quota per group). Run after servicedesk_06_public_link.sql. WRITE ONLY: run manually.
-- Rerun-safe. Plain SQL only (no functions, no dollar quoting, no pgcrypto). Until this runs the app keeps the single-request flow.

-- 1) groups: one per multi-service submission; SRs keep their own SLA / quota / PIC / status
create table if not exists public.service_request_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  ref_no text not null,
  title text not null check (length(title) between 1 and 200),
  source text not null default 'app' check (source in ('app', 'public')),
  pub_group_key text check (pub_group_key is null or length(pub_group_key) between 16 and 64),
  template_id uuid,
  rating smallint check (rating is null or rating between 1 and 5),
  rating_note text check (rating_note is null or length(rating_note) <= 1000),
  rated_by uuid, rated_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz);
alter table public.service_request_groups add column if not exists pub_group_key text;
alter table public.service_request_groups add column if not exists rating smallint;
alter table public.service_request_groups add column if not exists rating_note text;
alter table public.service_request_groups add column if not exists rated_by uuid;
alter table public.service_request_groups add column if not exists rated_at timestamptz;
create unique index if not exists service_request_groups_ref_uq on public.service_request_groups (tenant_id, ref_no);
create unique index if not exists service_request_groups_pub_uq on public.service_request_groups (tenant_id, pub_group_key) where pub_group_key is not null and deleted_at is null;

alter table public.service_requests add column if not exists group_id uuid references public.service_request_groups(id);
create index if not exists service_requests_group_idx on public.service_requests (group_id) where group_id is not null;

-- 2) group thread (shared messages for all SRs in a group; SR thread stays on service_request_events)
create table if not exists public.service_group_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  group_id uuid not null references public.service_request_groups(id),
  body text not null check (length(body) between 1 and 4000),
  actor_id uuid default auth.uid(),
  created_at timestamptz not null default now(), deleted_at timestamptz);
create index if not exists service_group_events_grp_idx on public.service_group_events (group_id, created_at);

-- 3) drafts (one live draft per user, autosaved by the wizard) and templates (saved service combos)
create table if not exists public.service_request_drafts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  user_id uuid not null default auth.uid(),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz);
create unique index if not exists service_request_drafts_user_uq on public.service_request_drafts (user_id) where deleted_at is null;

create table if not exists public.service_request_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  user_id uuid not null default auth.uid(),
  name text not null check (length(btrim(name)) between 1 and 80),
  services text[] not null default '{}',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz);
create index if not exists service_request_templates_tenant_idx on public.service_request_templates (tenant_id) where deleted_at is null;

alter table public.service_request_groups enable row level security;
alter table public.service_group_events enable row level security;
alter table public.service_request_drafts enable row level security;
alter table public.service_request_templates enable row level security;

-- groups: tenant reads/creates/updates own (rating, title); platform admin all. No delete (soft delete only).
drop policy if exists service_request_groups_read on public.service_request_groups;
create policy service_request_groups_read on public.service_request_groups for select to authenticated using (
  (deleted_at is null and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()))
  or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));
drop policy if exists service_request_groups_ins on public.service_request_groups;
create policy service_request_groups_ins on public.service_request_groups for insert to authenticated with check (
  exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin')
  or (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()) and created_by = auth.uid()));
drop policy if exists service_request_groups_upd on public.service_request_groups;
create policy service_request_groups_upd on public.service_request_groups for update to authenticated
  using (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin')
    or (deleted_at is null and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())))
  with check (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin')
    or tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()));

-- group thread: tenant reads + posts own; platform admin all
drop policy if exists service_group_events_read on public.service_group_events;
create policy service_group_events_read on public.service_group_events for select to authenticated using (
  (deleted_at is null and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()))
  or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));
drop policy if exists service_group_events_ins on public.service_group_events;
create policy service_group_events_ins on public.service_group_events for insert to authenticated with check (
  actor_id = auth.uid() and (
    exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin')
    or tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())));

-- drafts: only the user's own, inside their tenant
drop policy if exists service_request_drafts_own on public.service_request_drafts;
create policy service_request_drafts_own on public.service_request_drafts for all to authenticated
  using (user_id = auth.uid() and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()))
  with check (user_id = auth.uid() and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()));

-- templates: tenant reads; creator or tenant owner/admin writes
drop policy if exists service_request_templates_read on public.service_request_templates;
create policy service_request_templates_read on public.service_request_templates for select to authenticated using (
  deleted_at is null and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()));
drop policy if exists service_request_templates_ins on public.service_request_templates;
create policy service_request_templates_ins on public.service_request_templates for insert to authenticated with check (
  user_id = auth.uid() and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()));
drop policy if exists service_request_templates_upd on public.service_request_templates;
create policy service_request_templates_upd on public.service_request_templates for update to authenticated
  using (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
    and (user_id = auth.uid() or exists (select 1 from public.user_profiles p where p.id = auth.uid() and lower(coalesce(p.role, '')) in ('owner', 'admin'))))
  with check (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()));

grant select, insert, update on public.service_request_groups, public.service_group_events, public.service_request_drafts, public.service_request_templates to authenticated;
revoke all on public.service_request_groups, public.service_group_events, public.service_request_drafts, public.service_request_templates from anon;

-- 4) public link multi-service: rows of one submission share group_key; monthly quota and burst count GROUPS, max 5 rows per group
alter table public.service_public_requests add column if not exists group_key text;
alter table public.service_public_requests drop constraint if exists service_public_requests_group_key_chk;
alter table public.service_public_requests add constraint service_public_requests_group_key_chk check (group_key is null or length(group_key) between 16 and 64);
create index if not exists service_public_requests_group_idx on public.service_public_requests (link_id, group_key) where group_key is not null;
grant insert (group_key) on public.service_public_requests to anon;
grant select (group_key) on public.service_public_requests to anon;

drop policy if exists service_public_requests_anon_ins on public.service_public_requests;
create policy service_public_requests_anon_ins on public.service_public_requests for insert to anon with check (
  status = 'pending' and decided_by is null and decided_at is null and request_id is null and decision_note is null and deleted_at is null
  and (file_path is null or split_part(file_path, '/', 1) = link_token)
  and exists (select 1 from public.service_public_links l
    where l.id = link_id and l.tenant_id = service_public_requests.tenant_id and l.enabled and l.deleted_at is null
      and l.token_hash = encode(sha256(convert_to(link_token, 'UTF8')), 'hex')
      and (l.expires_on is null or l.expires_on >= (now() at time zone 'Asia/Kuala_Lumpur')::date)
      and service_code = any (l.services)
      and (
        -- 2nd..5th service of a submission started in the last 10 minutes: no extra quota
        (group_key is not null
          and exists (select 1 from public.service_public_requests g where g.link_id = l.id and g.group_key = service_public_requests.group_key
                      and g.created_at > now() - interval '10 minutes')
          and (select count(*) from public.service_public_requests g where g.link_id = l.id and g.group_key = service_public_requests.group_key) < 5)
        or (
          -- new submission: monthly quota and burst counted per group (rows without group_key count 1 each)
          (select count(distinct coalesce(q.group_key, q.id::text)) from public.service_public_requests q where q.link_id = l.id
             and q.created_at >= date_trunc('month', now() at time zone 'Asia/Kuala_Lumpur') at time zone 'Asia/Kuala_Lumpur') < l.monthly_quota
          and (select count(distinct coalesce(q.group_key, q.id::text)) from public.service_public_requests q where q.link_id = l.id
             and q.created_at > now() - interval '10 minutes') < 5))));

notify pgrst, 'reload schema';

update public.dev_roadmap_items set stage = 'completed', module = 'service_desk'
where title = 'Service Desk: multi-request groups';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Service Desk: multi-request groups', 'Pick up to 5 services in one request (group SG-YYYYMM-NNNN, one SR per service with own SLA/quota/PIC/status), same-details toggle, shared attachments, quota-full services skipped with warning, duplicate open SR -> add note, DB draft autosave, templates, group card with progress, one bell per group (all platform admins + tenant owner), admin Group/Flat view with bulk PIC, split/move SR, group thread, group rating, public link multi-service (1 quota per group), monthly report group summary, CSV group column.', 'service_desk', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Service Desk: multi-request groups');
