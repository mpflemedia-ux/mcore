-- M-Core back-office support - Phase C (write-only; run after bo_support_02.sql)
-- 1) Customer tags (VIP / Often late) -> reminder tone in the WhatsApp share sheet
alter table public.customers add column if not exists wa_tags text[] not null default '{}';
alter table public.customers drop constraint if exists customers_wa_tags_chk;
alter table public.customers add constraint customers_wa_tags_chk check (wa_tags <@ array['vip', 'late']::text[]);

-- 2) WhatsApp weekly update for Projects + Sales Plan: allow logging in doc_shares
alter table public.doc_shares drop constraint if exists doc_shares_doc_type_check;
alter table public.doc_shares add constraint doc_shares_doc_type_check check (doc_type in ('inv', 'quo', 'booking', 'pos', 'project', 'splan'));
alter table public.doc_shares drop constraint if exists doc_shares_template_check;
alter table public.doc_shares add constraint doc_shares_template_check check (template in ('send', 'confirm', 'remind_day', 'reschedule', 'reminder_friendly', 'reminder_firm', 'reminder_final', 'thanks', 'receipt', 'followup', 'weekly'));

-- 3) Best send time reads doc_views per customer's docs
create index if not exists bo_views_doc_idx on public.doc_views (tenant_id, doc_id);

-- 4) System Development
update public.dev_roadmap_items set stage = 'completed', module = 'admin',
  description = 'Back-office support Phase C: customer tags (VIP / Often late) adapt reminder tone; best send time from doc_views (3+ opens); WhatsApp weekly update for Projects and Sales Plan; QR to live public link on printed invoice/quotation.'
  where title = 'Back-office support (Phase C)';
insert into public.dev_roadmap_items (title, description, module, stage)
  select 'Back-office support (Phase C)', 'Back-office support Phase C: customer tags (VIP / Often late) adapt reminder tone; best send time from doc_views (3+ opens); WhatsApp weekly update for Projects and Sales Plan; QR to live public link on printed invoice/quotation.', 'admin', 'completed'
  where not exists (select 1 from public.dev_roadmap_items where title = 'Back-office support (Phase C)');
