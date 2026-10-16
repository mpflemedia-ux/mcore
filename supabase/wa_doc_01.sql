-- M-Core WhatsApp document share, Phase 1 (wa.me, no API): share log, public links (30-day expiry + revoke), view log for "Opened".
-- Write-only; run in Supabase SQL Editor. Rerun-safe. Plain SQL only (no new functions, no dollar quoting, no pgcrypto).
-- Docs: inv = invoices, quo = quotations, booking = bookings, pos = POS receipt (doc_ref only; a walk-in's typed number is never stored).
-- Until this runs, the app hides every WhatsApp-doc button (it probes doc_shares first).

-- 1) Share log (masked phone only)
create table if not exists public.doc_shares (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  doc_type text not null check (doc_type in ('inv', 'quo', 'booking', 'pos')),
  doc_id uuid,
  doc_ref text check (doc_ref is null or length(doc_ref) <= 80),
  template text not null check (template in ('send', 'confirm', 'remind_day', 'reschedule', 'reminder_friendly', 'reminder_firm', 'reminder_final', 'thanks', 'receipt', 'followup')),
  lang text not null default 'bm' check (lang in ('en', 'bm')),
  carrier text not null default 'text' check (carrier in ('text', 'file')),
  recipient_kind text not null default 'customer' check (recipient_kind in ('customer', 'walkin', 'other')),
  recipient_label text check (recipient_label is null or length(recipient_label) <= 200),
  phone_masked text check (phone_masked is null or phone_masked ~ '^[0-9]{2,6}[*]{2,10}[0-9]{2,4}$'),
  link_id uuid,
  share_day date not null default ((now() at time zone 'Asia/Kuala_Lumpur')::date),
  created_by uuid default auth.uid(),
  created_by_name text check (created_by_name is null or length(created_by_name) <= 200),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint doc_shares_doc_chk check (doc_id is not null or doc_type = 'pos'));
create index if not exists doc_shares_doc_idx on public.doc_shares (doc_type, doc_id, created_at) where deleted_at is null;
create index if not exists doc_shares_tenant_idx on public.doc_shares (tenant_id, created_at);
-- one overdue reminder per invoice per day (MYT), enforced by the DB
create unique index if not exists doc_shares_reminder_day_uq on public.doc_shares (doc_type, doc_id, share_day)
  where deleted_at is null and template like 'reminder%';

-- 2) Public links: one row per issued token (only the sha256 hash is stored)
create table if not exists public.doc_public_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  doc_type text not null check (doc_type in ('inv', 'quo')),
  doc_id uuid not null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null default (now() + interval '30 days'),
  revoked_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  deleted_at timestamptz);
create index if not exists doc_public_links_doc_idx on public.doc_public_links (doc_type, doc_id, created_at) where deleted_at is null;

-- 3) View log (one row per public page open; notified_at = bell sent)
create table if not exists public.doc_views (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  link_id uuid not null references public.doc_public_links(id),
  doc_type text not null check (doc_type in ('inv', 'quo')),
  doc_id uuid not null,
  token text not null check (length(token) between 16 and 64),
  viewed_at timestamptz not null default now(),
  notified_at timestamptz,
  deleted_at timestamptz);
create index if not exists doc_views_doc_idx on public.doc_views (doc_type, doc_id, viewed_at) where deleted_at is null;
create index if not exists doc_views_pending_idx on public.doc_views (tenant_id) where notified_at is null and deleted_at is null;
create index if not exists doc_views_link_idx on public.doc_views (link_id, viewed_at);

alter table public.doc_shares enable row level security;
alter table public.doc_public_links enable row level security;
alter table public.doc_views enable row level security;

-- doc_shares: tenant members read + insert their own; owner/admin soft delete
drop policy if exists doc_shares_read on public.doc_shares;
create policy doc_shares_read on public.doc_shares for select to authenticated using (
  deleted_at is null and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()));
drop policy if exists doc_shares_ins on public.doc_shares;
create policy doc_shares_ins on public.doc_shares for insert to authenticated with check (
  created_by = auth.uid() and deleted_at is null
  and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()));
drop policy if exists doc_shares_upd on public.doc_shares;
create policy doc_shares_upd on public.doc_shares for update to authenticated
  using (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid() and lower(coalesce(p.role, '')) in ('owner', 'admin')))
  with check (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()));

-- doc_public_links: tenant members manage; anon may read limited columns (to tell "expired/revoked" and to log a view)
drop policy if exists doc_public_links_read on public.doc_public_links;
create policy doc_public_links_read on public.doc_public_links for select to authenticated using (
  deleted_at is null and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()));
drop policy if exists doc_public_links_anon_read on public.doc_public_links;
create policy doc_public_links_anon_read on public.doc_public_links for select to anon using (deleted_at is null);
drop policy if exists doc_public_links_ins on public.doc_public_links;
create policy doc_public_links_ins on public.doc_public_links for insert to authenticated with check (
  created_by = auth.uid() and deleted_at is null and revoked_at is null
  and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()));
drop policy if exists doc_public_links_upd on public.doc_public_links;
create policy doc_public_links_upd on public.doc_public_links for update to authenticated
  using (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()))
  with check (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()));

-- doc_views: anyone holding a live token may insert (hash must match, not revoked, not expired; max 20 per link per 10 min)
drop policy if exists doc_views_public_ins on public.doc_views;
create policy doc_views_public_ins on public.doc_views for insert to anon, authenticated with check (
  notified_at is null and deleted_at is null
  and exists (select 1 from public.doc_public_links l
    where l.id = doc_views.link_id and l.tenant_id = doc_views.tenant_id and l.doc_type = doc_views.doc_type and l.doc_id = doc_views.doc_id
      and l.token_hash = encode(sha256(convert_to(doc_views.token, 'UTF8')), 'hex')
      and l.revoked_at is null and l.deleted_at is null and l.expires_at > now())
  and (select count(*) from public.doc_views v where v.link_id = doc_views.link_id and v.viewed_at > now() - interval '10 minutes') < 20);
-- anon sees only (id, link_id, viewed_at) so the rate limit above can count; no token, no tenant data
drop policy if exists doc_views_anon_read on public.doc_views;
create policy doc_views_anon_read on public.doc_views for select to anon using (deleted_at is null);
drop policy if exists doc_views_read on public.doc_views;
create policy doc_views_read on public.doc_views for select to authenticated using (
  deleted_at is null and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()));
drop policy if exists doc_views_upd on public.doc_views;
create policy doc_views_upd on public.doc_views for update to authenticated
  using (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()))
  with check (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()));

grant select, insert, update on public.doc_shares to authenticated;
grant select, insert, update on public.doc_public_links to authenticated;
grant select (id, tenant_id, doc_type, doc_id, token_hash, expires_at, revoked_at, deleted_at) on public.doc_public_links to anon;
grant select, insert, update on public.doc_views to authenticated;
grant select (id, link_id, viewed_at, deleted_at) on public.doc_views to anon;
grant insert (tenant_id, link_id, doc_type, doc_id, token) on public.doc_views to anon;

notify pgrst, 'reload schema';

update public.dev_roadmap_items set stage = 'completed', module = 'sales',
  description = 'WhatsApp document share Phase 1 (wa.me, no API): invoice, quotation, booking (confirm + day-before), POS receipt (PDF via share sheet, text fallback). 3-step sheet EN/BM, phone check, share log (masked phone), public links 30-day expiry + revoke, Opened tracking (doc_views) + bell, overdue reminder tiers with 1/day guard, BM public pages. SQL: supabase/wa_doc_01.sql.'
where title = 'WhatsApp document share (Phase 1)';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'WhatsApp document share (Phase 1)', 'WhatsApp document share Phase 1 (wa.me, no API): invoice, quotation, booking (confirm + day-before), POS receipt (PDF via share sheet, text fallback). 3-step sheet EN/BM, phone check, share log (masked phone), public links 30-day expiry + revoke, Opened tracking (doc_views) + bell, overdue reminder tiers with 1/day guard, BM public pages. SQL: supabase/wa_doc_01.sql.', 'sales', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'WhatsApp document share (Phase 1)');
