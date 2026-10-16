-- M-Core back-office support, Phase B: internal notes on documents + "remind me in N days if unpaid" follow-ups. (Tenant switch keeping the page needs no SQL.)
-- Write-only; run in Supabase SQL Editor. Rerun-safe. Plain SQL only (no new functions, no dollar quoting, no pgcrypto).
-- RUN ORDER: wa_doc_01.sql -> wa_doc_02.sql -> bo_support_01.sql -> THIS FILE (bo_support_02.sql) -> bo_support_03.sql.
-- The first statement stops here with "division by zero" if bo_support_01 has not been run.
-- Until this runs, the app hides notes + follow-ups (it probes doc_notes / doc_followups).
select 1 / (case when to_regclass('public.wa_settings') is null then 0 else 1 end) as bo_support_01_present;

-- 1) Internal notes (staff of the tenant + platform admin only; no anon access at all; soft delete)
create table if not exists public.doc_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  doc_type text not null check (doc_type in ('inv', 'quo', 'booking')),
  doc_id uuid not null,
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_by uuid default auth.uid(),
  created_by_name text check (created_by_name is null or length(created_by_name) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz);
create index if not exists doc_notes_doc_idx on public.doc_notes (tenant_id, doc_type, doc_id, created_at) where deleted_at is null;
alter table public.doc_notes enable row level security;
revoke all on public.doc_notes from anon;
drop policy if exists doc_notes_read on public.doc_notes;
create policy doc_notes_read on public.doc_notes for select to authenticated using (
  tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
  or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));
drop policy if exists doc_notes_ins on public.doc_notes;
create policy doc_notes_ins on public.doc_notes for insert to authenticated with check (
  created_by = auth.uid() and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()));
drop policy if exists doc_notes_upd on public.doc_notes;
create policy doc_notes_upd on public.doc_notes for update to authenticated
  using (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
    and (created_by = auth.uid() or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role in ('owner', 'admin', 'platform_admin'))))
  with check (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()));
grant select, insert, update on public.doc_notes to authenticated;

-- 2) Personal follow-ups after a reminder (only the person who asked can see / close them)
create table if not exists public.doc_followups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  doc_type text not null default 'inv' check (doc_type = 'inv'),
  doc_id uuid not null,
  doc_ref text check (doc_ref is null or length(doc_ref) <= 80),
  user_id uuid not null default auth.uid(),
  due_at timestamptz not null,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint doc_followups_due_chk check (due_at > created_at - interval '1 minute' and due_at < created_at + interval '60 days'));
create index if not exists doc_followups_due_idx on public.doc_followups (user_id, tenant_id, due_at) where done_at is null and deleted_at is null;
alter table public.doc_followups enable row level security;
revoke all on public.doc_followups from anon;
drop policy if exists doc_followups_read on public.doc_followups;
create policy doc_followups_read on public.doc_followups for select to authenticated using (user_id = auth.uid());
drop policy if exists doc_followups_ins on public.doc_followups;
create policy doc_followups_ins on public.doc_followups for insert to authenticated with check (
  user_id = auth.uid() and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()));
drop policy if exists doc_followups_upd on public.doc_followups;
create policy doc_followups_upd on public.doc_followups for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.doc_followups to authenticated;

-- 3) System Development
update public.dev_roadmap_items set stage = 'completed', module = 'admin',
  description = 'Back-office support Phase B: PA tenant switch keeps the current page + filters (Overdue / Opened-unpaid sheets reopen), internal staff-only notes on invoices / quotations / bookings (never printed or public; PA notes carry no name), "remind me in 1/3/7 days if unpaid" after a WhatsApp reminder with a bell for the sender. SQL: supabase/bo_support_02.sql (after bo_support_01.sql).'
where title = 'Back-office support (Phase B)';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Back-office support (Phase B)', 'Back-office support Phase B: PA tenant switch keeps the current page + filters (Overdue / Opened-unpaid sheets reopen), internal staff-only notes on invoices / quotations / bookings (never printed or public; PA notes carry no name), "remind me in 1/3/7 days if unpaid" after a WhatsApp reminder with a bell for the sender. SQL: supabase/bo_support_02.sql (after bo_support_01.sql).', 'admin', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Back-office support (Phase B)');
