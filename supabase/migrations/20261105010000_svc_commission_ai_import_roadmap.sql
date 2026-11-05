-- Service Commission — "Import from doc" (AI): Excel/CSV/PDF/photo of a staff service-log sheet
-- -> ai-proxy action doc_to_svc_logs -> fills the existing "Paste CSV" textarea (app/svc-commission.js).
-- Nothing is written by the AI step itself — the result still goes through the same S.parseCsv
-- validation and an explicit Import click as a manual paste would. No schema change: svc_logs /
-- svc_comm_months already have every column used (log_date, service, price, client_status,
-- lead_source, product_sales, product_note). This migration only records the roadmap entry.
--
-- Idempotent — write-only, run in Supabase SQL Editor.

insert into dev_roadmap_items (id, title, description, module, stage, started_at, completed_at)
select gen_random_uuid(),
  'Service commission: AI "Import from doc" for service logs',
  'HR/staff can upload an Excel/CSV sheet, PDF, or photo of a part-time staff service log (and the Product sales section) — a new ai-proxy action (doc_to_svc_logs) reads it and fills the existing Paste CSV box in Service Commission, which still goes through the same validation and an explicit Import click before anything is saved. Reuses the same file-reading helpers (SheetJS/pdf.js/image compress) and AI-proxy call pattern already used by Projects "Import from doc".',
  'hr', 'completed', now(), now()
where not exists (
  select 1 from dev_roadmap_items where title = 'Service commission: AI "Import from doc" for service logs'
);
