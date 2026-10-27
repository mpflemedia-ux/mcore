reset role;

-- Fixes the Salary Disbursement "Share for Approval" flow silently doing nothing: WhatsApp
-- opens, but W.log()'s INSERT into doc_shares fails (23514) because doc_shares_template_check
-- (widened in bo_support_03.sql) never included the 'sd_send'/'sd_remind' template keys added
-- alongside sd_approval_01.sql. Since W.log()'s insert fails, the 'wad:shared' event it fires
-- on success never fires, so _sdShareForApproval()'s listener never flips the batch to
-- 'shared' -- the badge stays 'Draft' and nothing appears to have happened. Reproduced live via
-- direct REST insert (23514) before writing this fix. Same superset-preserving pattern as the
-- doc_shares_doc_type_check fix in sd_approval_02 -- widen, never shrink.
alter table public.doc_shares drop constraint if exists doc_shares_template_check;
alter table public.doc_shares add constraint doc_shares_template_check check (template in (
  'send', 'confirm', 'remind_day', 'reschedule', 'reminder_friendly', 'reminder_firm', 'reminder_final',
  'thanks', 'receipt', 'followup', 'weekly', 'sd_send', 'sd_remind'));

notify pgrst, 'reload schema';

update public.dev_roadmap_items set stage = 'completed', module = 'hr',
  description = 'Salary Disbursement — Share for Approval: HR shares a specific month''s disbursement via WhatsApp (public link, no login needed); the approver views the full breakdown and uploads a signed photo/PDF back; HR reviews and approves/rejects in-app. Clones the proven Payment Claims blueprint (token-gated anon INSERT-only RLS, private doc-files bucket) rather than a new mechanism. Batch is locked (read-only) while shared/pending review to keep what was signed in sync with the system. sd_approval_02.sql: fixed doc_shares_template_check never allowing sd_send/sd_remind, which made every Share/Remind silently fail to flip the batch to shared (WhatsApp opened, but the share log insert -- and the event that flips batch status -- failed).'
where title = 'HR: Salary Disbursement Share for Approval (WhatsApp signature)';
