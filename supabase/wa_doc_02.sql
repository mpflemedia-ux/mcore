-- M-Core WhatsApp document share, Phase 2: tenant-editable templates + quotation Accept/Decline from the public page.
-- Write-only; run in Supabase SQL Editor. Rerun-safe. Plain SQL only (no new functions, no dollar quoting, no pgcrypto).
-- RUN ORDER: supabase/wa_doc_01.sql FIRST, then this file. The first statement stops here with "division by zero" if wa_doc_01 has not been run.
-- Until this runs, the app hides every Phase 2 feature (it probes wa_templates + doc_responses).
select 1 / (case when to_regclass('public.doc_public_links') is null or to_regclass('public.doc_shares') is null then 0 else 1 end) as wa_doc_01_present;

-- 1) Tenant templates (one live row per tenant + template + language; Reset = soft delete)
create table if not exists public.wa_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  doc_type text not null check (doc_type in ('inv', 'quo', 'booking', 'pos')),
  template_key text not null check (template_key in ('inv_send', 'reminder_friendly', 'reminder_firm', 'reminder_final', 'thanks', 'quo_send', 'followup', 'confirm', 'remind_day', 'reschedule', 'receipt')),
  lang text not null check (lang in ('en', 'bm')),
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz);
create unique index if not exists wa_templates_live_uq on public.wa_templates (tenant_id, template_key, lang) where deleted_at is null;

-- 2) Customer answers on a public quotation link (the app copies them onto the quotation when staff are online)
create table if not exists public.doc_responses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  link_id uuid not null references public.doc_public_links(id),
  doc_type text not null default 'quo' check (doc_type = 'quo'),
  doc_id uuid not null,
  token text not null check (length(token) between 16 and 64),
  response text not null check (response in ('accepted', 'declined')),
  reason text check (reason is null or length(reason) <= 500),
  responder_name text check (responder_name is null or length(responder_name) <= 120),
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  notified_at timestamptz,
  deleted_at timestamptz);
create index if not exists doc_responses_doc_idx on public.doc_responses (doc_id, created_at) where deleted_at is null;
create index if not exists doc_responses_link_idx on public.doc_responses (link_id, created_at);
create index if not exists doc_responses_pending_idx on public.doc_responses (tenant_id) where notified_at is null and deleted_at is null;

-- 3) Quotation columns for the customer's answer (status itself is not changed; "converted" stays the app's own flow)
alter table public.quotations add column if not exists customer_response text;
alter table public.quotations add column if not exists customer_response_at timestamptz;
alter table public.quotations add column if not exists customer_response_reason text;
alter table public.quotations drop constraint if exists quotations_customer_response_chk;
alter table public.quotations add constraint quotations_customer_response_chk check (customer_response is null or customer_response in ('accepted', 'declined'));

alter table public.wa_templates enable row level security;
alter table public.doc_responses enable row level security;

-- wa_templates: tenant members read; owner/admin write
drop policy if exists wa_templates_read on public.wa_templates;
create policy wa_templates_read on public.wa_templates for select to authenticated using (
  deleted_at is null and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()));
drop policy if exists wa_templates_ins on public.wa_templates;
create policy wa_templates_ins on public.wa_templates for insert to authenticated with check (
  deleted_at is null and created_by = auth.uid()
  and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid() and lower(coalesce(p.role, '')) in ('owner', 'admin')));
drop policy if exists wa_templates_upd on public.wa_templates;
create policy wa_templates_upd on public.wa_templates for update to authenticated
  using (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid() and lower(coalesce(p.role, '')) in ('owner', 'admin')))
  with check (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid() and lower(coalesce(p.role, '')) in ('owner', 'admin')));

-- doc_responses: anyone holding a live quotation token may insert (hash match, not revoked, not expired; max 5 per link per 10 min)
drop policy if exists doc_responses_public_ins on public.doc_responses;
create policy doc_responses_public_ins on public.doc_responses for insert to anon, authenticated with check (
  applied_at is null and notified_at is null and deleted_at is null
  and exists (select 1 from public.doc_public_links l
    where l.id = doc_responses.link_id and l.tenant_id = doc_responses.tenant_id and l.doc_type = 'quo' and l.doc_id = doc_responses.doc_id
      and l.token_hash = encode(sha256(convert_to(doc_responses.token, 'UTF8')), 'hex')
      and l.revoked_at is null and l.deleted_at is null and l.expires_at > now())
  and (select count(*) from public.doc_responses r where r.link_id = doc_responses.link_id and r.created_at > now() - interval '10 minutes') < 5);
-- anon sees only (id, link_id, response, created_at): the public page shows "you accepted on ..." and the rate limit can count
drop policy if exists doc_responses_anon_read on public.doc_responses;
create policy doc_responses_anon_read on public.doc_responses for select to anon using (deleted_at is null);
drop policy if exists doc_responses_read on public.doc_responses;
create policy doc_responses_read on public.doc_responses for select to authenticated using (
  deleted_at is null and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()));
drop policy if exists doc_responses_upd on public.doc_responses;
create policy doc_responses_upd on public.doc_responses for update to authenticated
  using (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()))
  with check (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()));

grant select, insert, update on public.wa_templates to authenticated;
grant select, insert, update on public.doc_responses to authenticated;
grant select (id, link_id, response, created_at, deleted_at) on public.doc_responses to anon;
grant insert (tenant_id, link_id, doc_type, doc_id, token, response, reason, responder_name) on public.doc_responses to anon;

notify pgrst, 'reload schema';

update public.dev_roadmap_items set stage = 'completed', module = 'sales',
  description = 'WhatsApp document share Phase 2: tenant-editable templates in Settings (EN/BM, tags, live preview, reset), Pay online line + #pay button on public invoice (existing ToyyibPay flow only), bulk Send one by one from Invoice + Overdue lists (1 reminder/day, each logged), quotation Accept/Decline on public page (doc_responses, token-hash RLS) with pill, Convert to invoice shortcut and bell. SQL: supabase/wa_doc_02.sql (after wa_doc_01.sql).'
where title = 'WhatsApp document share (Phase 2)';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'WhatsApp document share (Phase 2)', 'WhatsApp document share Phase 2: tenant-editable templates in Settings (EN/BM, tags, live preview, reset), Pay online line + #pay button on public invoice (existing ToyyibPay flow only), bulk Send one by one from Invoice + Overdue lists (1 reminder/day, each logged), quotation Accept/Decline on public page (doc_responses, token-hash RLS) with pill, Convert to invoice shortcut and bell. SQL: supabase/wa_doc_02.sql (after wa_doc_01.sql).', 'sales', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'WhatsApp document share (Phase 2)');
