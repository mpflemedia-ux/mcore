-- Create Racus Studio token-staff invoice at RM 250. customers has no type column.
WITH tn AS (
  SELECT id
  FROM public.tenants
  WHERE deleted_at IS NULL
    AND (code = 'BROZKY99' OR name ILIKE '%br%zky%empire%')
  ORDER BY CASE WHEN code = 'BROZKY99' THEN 0 ELSE 1 END
  LIMIT 1
), ins_cust AS (
  INSERT INTO public.customers (tenant_id, code, name, notes)
  SELECT tn.id, 'RACUS-STUDIO', 'Racus Studio', 'Maybank 564397158599'
  FROM tn
  WHERE NOT EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.tenant_id = tn.id AND c.deleted_at IS NULL AND c.name ILIKE '%racus%'
  )
  RETURNING id, tenant_id
), cust AS (
  SELECT c.id, c.tenant_id
  FROM public.customers c
  JOIN tn ON c.tenant_id = tn.id
  WHERE c.deleted_at IS NULL AND c.name ILIKE '%racus%'
  ORDER BY c.created_at
  LIMIT 1
), ins_inv AS (
  INSERT INTO public.invoices (
    tenant_id, customer_id, customer_name, ref_no, issue_date, due_date, total, paid_amt, status
  )
  SELECT cust.tenant_id, cust.id, 'Racus Studio', 'INV-20261009-RACUS', '2026-10-09', '2026-10-09', 250, 0, 'unpaid'
  FROM cust
  WHERE NOT EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.tenant_id = cust.tenant_id AND i.ref_no = 'INV-20261009-RACUS' AND i.deleted_at IS NULL
  )
  RETURNING id, tenant_id
), inv AS (
  SELECT i.id, i.tenant_id
  FROM public.invoices i
  JOIN cust ON i.tenant_id = cust.tenant_id
  WHERE i.ref_no = 'INV-20261009-RACUS' AND i.deleted_at IS NULL
  LIMIT 1
), upd_inv AS (
  UPDATE public.invoices i
  SET customer_id = cust.id, customer_name = 'Racus Studio', total = 250, paid_amt = 0, status = 'unpaid', updated_at = now()
  FROM cust
  WHERE i.id = (SELECT id FROM inv) AND i.tenant_id = cust.tenant_id
  RETURNING i.id
)
INSERT INTO public.invoice_items (tenant_id, invoice_id, description, qty, unit_price, line_total)
SELECT inv.tenant_id, inv.id, 'Token staff. Racus Studio Maybank 564397158599. Brzky Empire Public Bank 3242191926.', 1, 250, 250
FROM inv
WHERE NOT EXISTS (
  SELECT 1 FROM public.invoice_items ii WHERE ii.invoice_id = inv.id
);
