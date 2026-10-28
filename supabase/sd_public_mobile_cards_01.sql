-- Public SD mobile pay cards (no horizontal scroll). WRITE ONLY — Mike runs in Supabase SQL Editor.
-- Idempotent roadmap upsert. No schema/RLS/RPC changes (UI-only in app/public-sd.html).

update public.dev_roadmap_items
set stage = 'completed',
    module = 'hr_payroll',
    description = coalesce(nullif(trim(description), ''), '') ||
      case when description ilike '%public-sd mobile pay cards%' then ''
           else E'\n[2026-10-29] public-sd.html: mobile (<768) stacked pay cards — Basic/Allow/Deduct/EPF/SOCSO/EIS/PCB/OT/Net always visible vertically; desktop ≥768 classic table; EN/BM via lang=; light+dark tokens; Approve & Sign unchanged.'
      end
where title = 'Public SD mobile pay cards (no LTR scroll)';

insert into public.dev_roadmap_items (title, description, module, stage)
select
  'Public SD mobile pay cards (no LTR scroll)',
  'public-sd.html mobile (<768px) replaces wide table with stacked employee pay cards so all numbers (Basic, Allowance, Deductions, EPF, SOCSO, EIS, PCB, OT, Net) stay visible without horizontal scroll; desktop ≥768 keeps classic table; Confidential + Approve & Sign unchanged; EN/BM lang=; CSS tokens + prefers-color-scheme dark. Layout-only — no RPC/RLS/notif/payroll math changes.',
  'hr_payroll',
  'completed'
where not exists (
  select 1 from public.dev_roadmap_items where title = 'Public SD mobile pay cards (no LTR scroll)'
);
