-- M-Core Service Desk - phase 5: Public Link (no-login request form). Run after servicedesk_all_v2.sql. Rerun-safe. Plain SQL only
-- (no new functions, no dollar quoting, no pgcrypto; sha256() is built into Postgres 11+).
-- Security model (anon = not logged in):
--  * anon never sees link tokens: it reads only token_hash (+ display name, allowed services, quota, expiry) of ENABLED links.
--  * anon inserts a request only if the plaintext token in the row hashes to an enabled, unexpired link, the service is allowed,
--    the link's monthly quota and a 5-per-10-minutes burst limit are not exceeded, and all lengths are within CHECK limits.
--  * anon status page reads only ref/status/service/dates by status_hash (secret kept by the sender); no names, contacts or notes.
--  * owner/admin of the tenant manage links and approve/reject; platform admin reads all.
create table if not exists public.service_public_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  token text not null check (length(token) between 16 and 64),
  token_hash text not null,
  display_name text not null default '' check (length(display_name) <= 200),
  enabled boolean not null default false,
  services text[] not null default '{}',
  monthly_quota int not null default 10 check (monthly_quota between 0 and 1000),
  expires_on date,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  constraint service_public_links_hash_chk check (token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex')));
create unique index if not exists service_public_links_tenant_uq on public.service_public_links (tenant_id) where deleted_at is null;
create unique index if not exists service_public_links_hash_uq on public.service_public_links (token_hash);

create table if not exists public.service_public_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  link_id uuid not null references public.service_public_links(id),
  link_token text not null,
  ref_no text not null check (ref_no ~ '^SR-PUB-[0-9]{4,6}$'),
  status_hash text not null check (length(status_hash) = 64),
  service_code text not null check (length(service_code) <= 40),
  sender_name text not null check (length(btrim(sender_name)) between 2 and 120),
  sender_contact text not null check (length(btrim(sender_contact)) between 5 and 160),
  title text not null check (length(btrim(title)) between 3 and 200),
  description text check (description is null or length(description) <= 4000),
  file_path text check (file_path is null or length(file_path) <= 300),
  file_name text check (file_name is null or length(file_name) <= 200),
  file_size int check (file_size is null or file_size between 0 and 10485760),
  lang text not null default 'bm' check (lang in ('bm', 'en')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid, decided_at timestamptz, decision_note text check (decision_note is null or length(decision_note) <= 1000),
  request_id uuid references public.service_requests(id),
  created_at timestamptz not null default now(), deleted_at timestamptz);
create unique index if not exists service_public_requests_ref_uq on public.service_public_requests (tenant_id, ref_no);
create unique index if not exists service_public_requests_status_uq on public.service_public_requests (status_hash);
create index if not exists service_public_requests_link_idx on public.service_public_requests (link_id, created_at);

alter table public.service_public_links enable row level security;
alter table public.service_public_requests enable row level security;

-- Links: tenant owner/admin manage own; platform admin reads; anon reads enabled links (column grants below hide the token).
drop policy if exists service_public_links_read on public.service_public_links;
create policy service_public_links_read on public.service_public_links for select to authenticated using (
  (deleted_at is null and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid() and lower(coalesce(p.role, '')) in ('owner', 'admin')))
  or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));
drop policy if exists service_public_links_ins on public.service_public_links;
create policy service_public_links_ins on public.service_public_links for insert to authenticated with check (
  tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid() and lower(coalesce(p.role, '')) in ('owner', 'admin')));
drop policy if exists service_public_links_upd on public.service_public_links;
create policy service_public_links_upd on public.service_public_links for update to authenticated
  using (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid() and lower(coalesce(p.role, '')) in ('owner', 'admin')))
  with check (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid() and lower(coalesce(p.role, '')) in ('owner', 'admin')));
drop policy if exists service_public_links_anon on public.service_public_links;
create policy service_public_links_anon on public.service_public_links for select to anon using (enabled and deleted_at is null);

-- Public requests: owner/admin of the tenant read + decide; platform admin reads; anon inserts with tight checks, reads status columns.
drop policy if exists service_public_requests_read on public.service_public_requests;
create policy service_public_requests_read on public.service_public_requests for select to authenticated using (
  (deleted_at is null and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid() and lower(coalesce(p.role, '')) in ('owner', 'admin')))
  or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));
drop policy if exists service_public_requests_upd on public.service_public_requests;
create policy service_public_requests_upd on public.service_public_requests for update to authenticated
  using (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid() and lower(coalesce(p.role, '')) in ('owner', 'admin')))
  with check (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid() and lower(coalesce(p.role, '')) in ('owner', 'admin'))
    and status in ('pending', 'approved', 'rejected'));
drop policy if exists service_public_requests_anon_read on public.service_public_requests;
create policy service_public_requests_anon_read on public.service_public_requests for select to anon using (deleted_at is null);
drop policy if exists service_public_requests_anon_ins on public.service_public_requests;
create policy service_public_requests_anon_ins on public.service_public_requests for insert to anon with check (
  status = 'pending' and decided_by is null and decided_at is null and request_id is null and decision_note is null and deleted_at is null
  and (file_path is null or split_part(file_path, '/', 1) = link_token)
  and exists (select 1 from public.service_public_links l
    where l.id = link_id and l.tenant_id = service_public_requests.tenant_id and l.enabled and l.deleted_at is null
      and l.token_hash = encode(sha256(convert_to(link_token, 'UTF8')), 'hex')
      and (l.expires_on is null or l.expires_on >= (now() at time zone 'Asia/Kuala_Lumpur')::date)
      and service_code = any (l.services)
      and (select count(*) from public.service_public_requests q where q.link_id = l.id
           and q.created_at >= date_trunc('month', now() at time zone 'Asia/Kuala_Lumpur') at time zone 'Asia/Kuala_Lumpur') < l.monthly_quota
      and (select count(*) from public.service_public_requests q where q.link_id = l.id and q.created_at > now() - interval '10 minutes') < 5));

-- Column privileges: anon sees no token, no sender details, no notes.
revoke all on public.service_public_links, public.service_public_requests from anon;
grant select (id, tenant_id, token_hash, display_name, enabled, services, monthly_quota, expires_on, deleted_at) on public.service_public_links to anon;
grant select (id, tenant_id, link_id, ref_no, status_hash, service_code, status, created_at, decided_at, deleted_at) on public.service_public_requests to anon;
grant insert (tenant_id, link_id, link_token, ref_no, status_hash, service_code, sender_name, sender_contact, title, description, file_path, file_name, file_size, lang) on public.service_public_requests to anon;
grant select, insert, update on public.service_public_links, public.service_public_requests to authenticated;

-- Service names for the public form (names only, harmless).
drop policy if exists service_catalog_anon on public.service_catalog;
create policy service_catalog_anon on public.service_catalog for select to anon using (active and deleted_at is null);
grant select (code, name_en, name_bm, sort, active, deleted_at) on public.service_catalog to anon;

-- Private bucket for public attachments: service-public/{link token}/{file}. 10 MB, PDF/images/Office/text only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('service-public', 'service-public', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv', 'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists service_public_files_anon_ins on storage.objects;
create policy service_public_files_anon_ins on storage.objects for insert to anon with check (
  bucket_id = 'service-public' and exists (select 1 from public.service_public_links l where l.enabled and l.deleted_at is null
    and l.token_hash = encode(sha256(convert_to((storage.foldername(name))[1], 'UTF8')), 'hex')));
drop policy if exists service_public_files_read on storage.objects;
create policy service_public_files_read on storage.objects for select to authenticated using (
  bucket_id = 'service-public' and (
    exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin')
    or exists (select 1 from public.service_public_requests r where r.file_path = name and r.deleted_at is null
      and r.tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid() and lower(coalesce(p.role, '')) in ('owner', 'admin')))));

notify pgrst, 'reload schema';

update public.dev_roadmap_items set stage = 'completed', module = 'service_desk',
  description = 'Service Desk Public Link: owner link settings (toggle, copy, QR, reset, services, monthly quota, expiry), no-login public form (EN/BM, anti-spam, 10 MB file limit, burst + monthly limits in RLS), thank-you ref SR-PUB-NNNN, public status page, owner approve/reject (approve creates official request on contract quota), inactive link screen.'
where title = 'Service Desk F5: Public Link';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Service Desk F5: Public Link', 'Service Desk Public Link: owner link settings (toggle, copy, QR, reset, services, monthly quota, expiry), no-login public form (EN/BM, anti-spam, 10 MB file limit, burst + monthly limits in RLS), thank-you ref SR-PUB-NNNN, public status page, owner approve/reject (approve creates official request on contract quota), inactive link screen.', 'service_desk', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Service Desk F5: Public Link');
