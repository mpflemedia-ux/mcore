-- ============================================================================
-- PO detail: Linked Bills card — System Development roadmap update
-- File: supabase/snippets/po_linked_bills_roadmap_2026-10-29.sql
-- Run MANUALLY in Supabase SQL Editor. Idempotent (safe to re-run).
-- Frontend-only change (app/index.html: renderPODetail + _poLinkedBillsCard). No schema change.
-- dev_roadmap_items: system-level roadmap (same upsert pattern as previous roadmap snippets; no tenant rows touched).
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.dev_roadmap_items WHERE title ILIKE 'PO detail: Linked Bills card%') THEN
    UPDATE public.dev_roadmap_items
       SET stage = 'completed',
           module = COALESCE(NULLIF(TRIM(module), ''), 'purchasing'),
           description = 'Purchasing → PO detail: read-only "Linked Bills" card under Receiving History. Lists supplier_bills where po_id = PO + tenant_id + deleted_at IS NULL (Bill No, Date, Total, Paid, Balance, status colour as bill list). Row → bill detail. Summary: Billed RM x / PO total (warning colour if over-billed) + Paid RM z. Empty + error states (EN/BM). Phones ≤480px: stacked rows, no horizontal overflow. Dark/light via tokens. No notifications (read-only).'
     WHERE title ILIKE 'PO detail: Linked Bills card%';
  ELSE
    INSERT INTO public.dev_roadmap_items (title, description, module, stage)
    VALUES (
      'PO detail: Linked Bills card',
      'Purchasing → PO detail: read-only "Linked Bills" card under Receiving History. Lists supplier_bills where po_id = PO + tenant_id + deleted_at IS NULL (Bill No, Date, Total, Paid, Balance, status colour as bill list). Row → bill detail. Summary: Billed RM x / PO total (warning colour if over-billed) + Paid RM z. Empty + error states (EN/BM). Phones ≤480px: stacked rows, no horizontal overflow. Dark/light via tokens. No notifications (read-only).',
      'purchasing', 'completed');
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'dev_roadmap schema variant; skip: %', SQLERRM;
END $$;

-- Verify
SELECT title, module, stage FROM public.dev_roadmap_items
 WHERE title ILIKE 'PO detail: Linked Bills card%';
