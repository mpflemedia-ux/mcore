-- ============================================================================
-- Brzky Empire — Link BILL-0001 → PO-0001
-- File: supabase/snippets/brzky_link_bill_po_2026-10-29.sql
-- Run MANUALLY in Supabase SQL Editor. Idempotent (safe to re-run).
--
-- Context:
--   PO-0001 (Ethye Sdn. Bhd., Sent, Hair Moisturizer 2400 @ RM8.30 = RM19,920, received 0, no GRN)
--   BILL-0001 was created earlier without po_id — so PO detail never "reflects" the bill.
--
-- App audit (do NOT invent fields):
--   • purchase_orders has NO billed_amt / billed_status. Status is draft|sent|partial|received|cancelled
--     driven only by GRN qty_received (Receive Goods). Linking a bill does NOT change PO.
--   • _billSave only writes supplier_bills.po_id / grn_id. No PO update.
--   • renderPODetail shows PO header, items (qty/received), GRN history — NOT linked bills.
--   → This SQL only sets supplier_bills.po_id (and grn_id if a GRN for that PO exists; none yet).
--
-- Tenant: code BROZKY99 OR name ILIKE '%br%zky%'. Must match exactly 1.
-- Guard: only link when bill.po_id IS NULL and bill.supplier_id = po.supplier_id; else NOTICE.
-- ============================================================================

DO $$
DECLARE
  v_tenant   uuid;
  v_cnt      int;
  v_po       record;
  v_bill     record;
  v_grn_id   uuid;
BEGIN
  -- 0) Tenant ---------------------------------------------------------------
  SELECT count(*) INTO v_cnt FROM public.tenants t
   WHERE t.deleted_at IS NULL AND (upper(t.code) = 'BROZKY99' OR t.name ILIKE '%br%zky%');
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'Tenant Brzky match = % (expect 1). Semak tenants.name/code.', v_cnt;
  END IF;
  SELECT t.id INTO v_tenant FROM public.tenants t
   WHERE t.deleted_at IS NULL AND (upper(t.code) = 'BROZKY99' OR t.name ILIKE '%br%zky%');

  -- 1) PO-0001 --------------------------------------------------------------
  SELECT po.id, po.po_no, po.supplier_id, po.status, po.total
    INTO v_po
    FROM public.purchase_orders po
   WHERE po.tenant_id = v_tenant
     AND po.deleted_at IS NULL
     AND upper(po.po_no) = 'PO-0001'
   ORDER BY po.created_at
   LIMIT 1;
  IF v_po.id IS NULL THEN
    RAISE EXCEPTION 'PO-0001 not found in tenant %.', v_tenant;
  END IF;

  -- 2) BILL-0001 ------------------------------------------------------------
  SELECT b.id, b.bill_no, b.supplier_id, b.po_id, b.grn_id, b.total, b.status, b.paid_amt
    INTO v_bill
    FROM public.supplier_bills b
   WHERE b.tenant_id = v_tenant
     AND b.deleted_at IS NULL
     AND upper(b.bill_no) = 'BILL-0001'
   ORDER BY b.created_at
   LIMIT 1;
  IF v_bill.id IS NULL THEN
    RAISE EXCEPTION 'BILL-0001 not found in tenant %.', v_tenant;
  END IF;

  -- 3) Guards ---------------------------------------------------------------
  IF v_bill.po_id IS NOT NULL THEN
    IF v_bill.po_id = v_po.id THEN
      RAISE NOTICE 'BILL-0001 already linked to PO-0001 (%). Skip.', v_po.id;
    ELSE
      RAISE NOTICE 'BILL-0001.po_id already set to % (not PO-0001). Skip — no overwrite.', v_bill.po_id;
    END IF;
  ELSIF v_bill.supplier_id IS DISTINCT FROM v_po.supplier_id THEN
    RAISE NOTICE 'Supplier mismatch: BILL-0001.supplier_id=% vs PO-0001.supplier_id=%. Skip.',
      v_bill.supplier_id, v_po.supplier_id;
  ELSE
    -- Optional GRN for this PO (none expected yet)
    SELECT g.id INTO v_grn_id
      FROM public.goods_received_notes g
     WHERE g.tenant_id = v_tenant
       AND g.deleted_at IS NULL
       AND g.po_id = v_po.id
     ORDER BY g.received_date DESC NULLS LAST, g.created_at DESC
     LIMIT 1;

    UPDATE public.supplier_bills
       SET po_id  = v_po.id,
           grn_id = COALESCE(v_bill.grn_id, v_grn_id)
     WHERE id = v_bill.id
       AND tenant_id = v_tenant
       AND po_id IS NULL
       AND supplier_id = v_po.supplier_id;

    IF FOUND THEN
      RAISE NOTICE 'Linked BILL-0001 → PO-0001 (po_id=%). grn_id=% (NULL if no GRN yet).',
        v_po.id, COALESCE(v_bill.grn_id, v_grn_id);
    ELSE
      RAISE NOTICE 'UPDATE matched 0 rows (race / already linked). No change.';
    END IF;
  END IF;

  -- 4) Roadmap --------------------------------------------------------------
  BEGIN
    IF EXISTS (SELECT 1 FROM public.dev_roadmap_items
                WHERE title ILIKE '%brzky%link%bill-0001%po-0001%') THEN
      UPDATE public.dev_roadmap_items
         SET stage = 'completed',
             module = COALESCE(NULLIF(TRIM(module), ''), 'purchasing'),
             description = 'Brzky Empire: set supplier_bills.po_id for BILL-0001 → PO-0001 (same supplier, only when po_id was null). grn_id set only if a GRN for that PO exists (none at link time). No PO billed_amt/status — app does not maintain those; PO status stays GRN-driven. Idempotent.'
       WHERE title ILIKE '%brzky%link%bill-0001%po-0001%';
    ELSE
      INSERT INTO public.dev_roadmap_items (title, description, module, stage)
      VALUES (
        'Brzky: link BILL-0001 to PO-0001',
        'Brzky Empire: set supplier_bills.po_id for BILL-0001 → PO-0001 (same supplier, only when po_id was null). grn_id set only if a GRN for that PO exists (none at link time). No PO billed_amt/status — app does not maintain those; PO status stays GRN-driven. Idempotent.',
        'purchasing', 'completed');
    END IF;
  EXCEPTION WHEN undefined_column OR undefined_table THEN
    RAISE NOTICE 'dev_roadmap schema variant; skip: %', SQLERRM;
  END;
END $$;

-- Verify (expect 1 row: BILL-0001.po_id = PO-0001.id, same supplier, grn_id NULL until Receive Goods)
SELECT t.name AS tenant,
       po.po_no, po.status AS po_status, po.total AS po_total,
       s.name AS supplier,
       b.bill_no, b.total AS bill_total, b.status AS bill_status, b.paid_amt,
       b.po_id IS NOT NULL AND b.po_id = po.id AS linked,
       b.grn_id,
       (SELECT count(*) FROM public.goods_received_notes g
         WHERE g.tenant_id = t.id AND g.po_id = po.id AND g.deleted_at IS NULL) AS grn_count
  FROM public.tenants t
  JOIN public.purchase_orders po
    ON po.tenant_id = t.id AND po.deleted_at IS NULL AND upper(po.po_no) = 'PO-0001'
  JOIN public.suppliers s
    ON s.id = po.supplier_id
  JOIN public.supplier_bills b
    ON b.tenant_id = t.id AND b.deleted_at IS NULL AND upper(b.bill_no) = 'BILL-0001'
 WHERE t.deleted_at IS NULL
   AND (upper(t.code) = 'BROZKY99' OR t.name ILIKE '%br%zky%');

SELECT title, module, stage FROM public.dev_roadmap_items
 WHERE title ILIKE '%brzky%link%bill-0001%po-0001%';
