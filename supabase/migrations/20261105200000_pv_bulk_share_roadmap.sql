-- Payment Vouchers: bulk WhatsApp share (select several draft/shared PVs, one combined link message)
-- Idempotent — write-only, run in Supabase SQL Editor.

insert into dev_roadmap_items (id, title, description, module, stage, started_at, completed_at)
select gen_random_uuid(),
  'Payment Vouchers: share several PVs as one WhatsApp message',
  'app/pv-bulk-share.js patches the PV list table to add checkboxes on draft/shared rows and a sticky action bar — pick a signature role, it generates a pv_sign_link_create token for each selected PV (same RPC the single-PV Share button uses) and opens one WhatsApp compose listing all the links, instead of sharing one PV at a time.',
  'accounting', 'completed', now(), now()
where not exists (
  select 1 from dev_roadmap_items where title = 'Payment Vouchers: share several PVs as one WhatsApp message'
);
