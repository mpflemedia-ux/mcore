-- Public SD theme follows sharer's app display mode. WRITE ONLY — Mike runs in Supabase SQL Editor.
-- Idempotent roadmap upsert. No schema/RLS/RPC changes (URL query + CSS/JS only).

update public.dev_roadmap_items
set stage = 'completed',
    module = 'hr_payroll',
    description = coalesce(nullif(trim(description), ''), '') ||
      case when description ilike '%theme=light|dark%' or description ilike '%W.theme()%' then ''
           else E'\n[2026-10-29] public-sd follows sharer app theme via ?theme=light|dark from W.ensureLink (data-theme/mcore_theme); OS prefers-color-scheme fallback for old links; Approve & Sign uses --psd-* tokens.'
      end
where title = 'Public SD theme follows tenant display mode';

insert into public.dev_roadmap_items (title, description, module, stage)
select
  'Public SD theme follows tenant display mode',
  'Share WhatsApp SD link appends ?theme=light|dark from sharer current app theme (html data-theme / localStorage mcore_theme via W.theme() in wa-doc-core). public-sd.html locks data-theme + --psd-* tokens (overrides OS); missing theme param keeps prefers-color-scheme fallback. sd-approve-pub Approve & Sign panel uses --psd-* classes (no hardcoded light card). Cache-bust wa-doc-core.js?v=4, sd-approve-pub.js?v=5. Layout/theme only — no RPC/RLS/notif/payroll math.',
  'hr_payroll',
  'completed'
where not exists (
  select 1 from public.dev_roadmap_items where title = 'Public SD theme follows tenant display mode'
);
