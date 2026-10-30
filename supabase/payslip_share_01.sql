-- payslip_share_01.sql — Payslip card view + WhatsApp share (app/payslip-cards.js).
-- WRITE-ONLY: run manually in the Supabase SQL Editor.
-- Widens doc_shares checks so W.log() can record payslip shares (doc_type 'payslip',
-- templates 'payslip_send' / 'payslip_remind'). Superset of sd_approval_01/02 lists —
-- widen, never shrink. Template keys avoid the 'reminder%' prefix, so the one-reminder-
-- per-day unique index does not apply to payslips. recipient_kind uses existing 'other'.

alter table public.doc_shares drop constraint if exists doc_shares_doc_type_check;
alter table public.doc_shares add constraint doc_shares_doc_type_check check (doc_type in (
  'inv', 'quo', 'booking', 'pos', 'project', 'splan', 'sd', 'payslip')) not valid;

alter table public.doc_shares drop constraint if exists doc_shares_template_check;
alter table public.doc_shares add constraint doc_shares_template_check check (template in (
  'send', 'confirm', 'remind_day', 'reschedule', 'reminder_friendly', 'reminder_firm', 'reminder_final',
  'thanks', 'receipt', 'followup', 'weekly', 'sd_send', 'sd_remind', 'payslip_send', 'payslip_remind')) not valid;

notify pgrst, 'reload schema';

update public.dev_roadmap_items set stage = 'completed', module = 'hr',
  description = 'Payslip card view: token-based cards replace the white paper on Payslip detail + All Payslips (3-col tiles desktop / 1-col mobile, dark+light, EN/BM), bank masked on screen, employer contributions collapsible, sticky Print / PDF / Share WhatsApp bar. Light A4 print one slip per page, pdf-lib PDF (Payslip-<Name>-<MonYear>.pdf, PDF all), WhatsApp share via WAD (Send payslip / Reminder templates, net pay only, no bank details, share one by one, desktop downloads PDF), logged to doc_shares (doc_type payslip). Bell+push "Payslip <Mon Year> ready" to the staff login (no amounts) -> My Payroll History. Email share: M-Core wording, bank line removed.'
where title = 'HR: Payslip card view + WhatsApp share';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'HR: Payslip card view + WhatsApp share', 'Payslip card view: token-based cards replace the white paper on Payslip detail + All Payslips (3-col tiles desktop / 1-col mobile, dark+light, EN/BM), bank masked on screen, employer contributions collapsible, sticky Print / PDF / Share WhatsApp bar. Light A4 print one slip per page, pdf-lib PDF (Payslip-<Name>-<MonYear>.pdf, PDF all), WhatsApp share via WAD (Send payslip / Reminder templates, net pay only, no bank details, share one by one, desktop downloads PDF), logged to doc_shares (doc_type payslip). Bell+push "Payslip <Mon Year> ready" to the staff login (no amounts) -> My Payroll History. Email share: M-Core wording, bank line removed.', 'hr', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'HR: Payslip card view + WhatsApp share');
