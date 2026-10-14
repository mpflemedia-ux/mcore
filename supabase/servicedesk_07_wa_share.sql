-- M-Core Service Desk F7: Share WhatsApp + client result link (Sahkan / Minta pindaan).
-- Write-only: run once in Supabase SQL Editor AFTER servicedesk_02_desk.sql. Rerun-safe. No functions, no pgcrypto.
-- 'Siap' = existing status 'delivered' (no status constraint change). Client result files = existing deliverable
-- attachments (service_request_events.type='attachment' and meta.deliverable = true) - no new file column needed.
-- 'Belum dimaklumkan' is computed: delivered request with no share row created at/after delivered_at (no extra column).
-- Anon gets NO access to these tables: the public result page talks only to Edge Function sd-result (service role).

-- 1) Timeline event types: add wa_notified + result_response (keeps all existing types).
alter table public.service_request_events drop constraint if exists service_request_events_type_check;
alter table public.service_request_events add constraint service_request_events_type_check
  check (type in ('status', 'comment', 'attachment', 'support_access', 'internal_note', 'wa_notified', 'result_response'));

-- 2) Result links: only sha256(token) is stored; the token itself lives only in the WhatsApp message.
create table if not exists public.service_result_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  request_id uuid not null references public.service_requests(id),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null default (now() + interval '7 days'),
  revoked_at timestamptz, viewed_at timestamptz,
  view_count int not null default 0 check (view_count >= 0),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(), deleted_at timestamptz,
  check (expires_at <= created_at + interval '30 days'));
create index if not exists service_result_links_req_idx on public.service_result_links (request_id, created_at desc);

-- 3) Share log (one row per "Buka WhatsApp").
create table if not exists public.service_request_shares (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  request_id uuid not null references public.service_requests(id),
  template text not null check (template in ('received', 'need_info', 'in_progress', 'done', 'reminder')),
  lang text not null default 'bm' check (lang in ('bm', 'en')),
  recipient_kind text not null check (recipient_kind in ('requester', 'pic', 'other')),
  recipient_label text check (recipient_label is null or length(recipient_label) <= 200),
  phone text check (phone is null or phone ~ '^[0-9]{8,15}$'),
  message text not null check (length(message) between 1 and 6000),
  result_link_id uuid references public.service_result_links(id),
  created_by uuid not null default auth.uid(),
  created_by_name text check (created_by_name is null or length(created_by_name) <= 120),
  created_at timestamptz not null default now(), deleted_at timestamptz);
create index if not exists service_request_shares_req_idx on public.service_request_shares (request_id, created_at desc);

-- 4) Client responses from the public result page (written only by the Edge Function with the service role).
create table if not exists public.service_result_responses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  request_id uuid not null references public.service_requests(id),
  link_id uuid not null references public.service_result_links(id),
  action text not null check (action in ('confirm', 'revise')),
  comment text check (comment is null or length(comment) <= 2000),
  created_at timestamptz not null default now(), deleted_at timestamptz,
  check (action = 'confirm' or length(btrim(coalesce(comment, ''))) >= 3));
create index if not exists service_result_responses_req_idx on public.service_result_responses (request_id, created_at desc);

alter table public.service_result_links enable row level security;
alter table public.service_request_shares enable row level security;
alter table public.service_result_responses enable row level security;

-- Platform admin (Service Desk team) manages links + shares; the client tenant may read its own rows.
drop policy if exists service_result_links_read on public.service_result_links;
create policy service_result_links_read on public.service_result_links for select to authenticated using (
  exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin')
  or (deleted_at is null and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())));
drop policy if exists service_result_links_ins on public.service_result_links;
create policy service_result_links_ins on public.service_result_links for insert to authenticated with check (
  exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin')
  and created_by = auth.uid() and revoked_at is null and viewed_at is null and view_count = 0 and deleted_at is null
  and exists (select 1 from public.service_requests r where r.id = request_id and r.tenant_id = service_result_links.tenant_id and r.deleted_at is null));
drop policy if exists service_result_links_upd on public.service_result_links;
create policy service_result_links_upd on public.service_result_links for update to authenticated
  using (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'))
  with check (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));

drop policy if exists service_request_shares_read on public.service_request_shares;
create policy service_request_shares_read on public.service_request_shares for select to authenticated using (
  exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin')
  or (deleted_at is null and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())));
drop policy if exists service_request_shares_ins on public.service_request_shares;
create policy service_request_shares_ins on public.service_request_shares for insert to authenticated with check (
  exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin')
  and created_by = auth.uid() and deleted_at is null
  and exists (select 1 from public.service_requests r where r.id = request_id and r.tenant_id = service_request_shares.tenant_id and r.deleted_at is null)
  and (result_link_id is null or exists (select 1 from public.service_result_links l where l.id = result_link_id and l.request_id = service_request_shares.request_id)));
drop policy if exists service_request_shares_upd on public.service_request_shares;
create policy service_request_shares_upd on public.service_request_shares for update to authenticated
  using (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'))
  with check (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));

drop policy if exists service_result_responses_read on public.service_result_responses;
create policy service_result_responses_read on public.service_result_responses for select to authenticated using (
  exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin')
  or (deleted_at is null and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())));

revoke all on public.service_result_links, public.service_request_shares, public.service_result_responses from anon;
grant select, insert on public.service_result_links to authenticated;
grant update (revoked_at, deleted_at) on public.service_result_links to authenticated;
grant select, insert on public.service_request_shares to authenticated;
grant update (deleted_at) on public.service_request_shares to authenticated;
grant select on public.service_result_responses to authenticated;
grant all on public.service_result_links, public.service_request_shares, public.service_result_responses to service_role;

notify pgrst, 'reload schema';

insert into public.dev_roadmap_items (title, description, module, stage)
select 'Service Desk F7: Share WhatsApp + client result link', 'Admin Share WhatsApp on Service Desk requests (5 status templates EN/BM, service wording, requester / PIC / group, wa.me), prompt on Siap, Dimaklumkan Nx + timeline event, Belum dimaklumkan filter, 7-day client result page (?sr_result=) via Edge Function sd-result with signed URLs for deliverables, Sahkan & tutup / Minta pindaan.', 'service_desk', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Service Desk F7: Share WhatsApp + client result link');
