-- Salary Disbursement WhatsApp signature share — URL fix + UX polish
-- Idempotent roadmap upsert only. Schema already in sd_approval_01.sql + sd_approval_02.sql.
-- WRITE ONLY — Mike runs in Supabase SQL Editor. Do not execute from agents.

update public.dev_roadmap_items
set stage = 'completed',
    module = 'hr_payroll',
    description = coalesce(description, '') ||
      case when description ilike '%public-sd.html%' then ''
           else E'\n[2026-10-28] Hardened WAD ensureLink → public-sd.html?public_sd=; Share WhatsApp 3-step templates; HR review modal.'
      end
where title = 'Salary Disbursement WhatsApp signature share URL+UX';

insert into public.dev_roadmap_items (title, description, module, stage)
select
  'Salary Disbursement WhatsApp signature share URL+UX',
  'Fix public share URL to public-sd.html (no login), align Share WhatsApp 3-step sheet (Request signature + Reminder), toolbar wrap/nowrap, HR review card Approve/Reject.',
  'hr_payroll',
  'completed'
where not exists (
  select 1 from public.dev_roadmap_items
  where title = 'Salary Disbursement WhatsApp signature share URL+UX'
);
