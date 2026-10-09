-- Brzky Empire invoice to Racus Studio. Token staff. Amount was not in the message, so total is 0.
WITH tn AS (
  SELECT id FROM public.tenants
  WHERE deleted_at IS NULL AND (code = 'BROZKY99' OR name ILIKE '%br%zky%empire%')
  ORDER BY CASE WHEN code = 'BROZKY99' THEN 0 ELSE 1 END
  LIMIT 1
), ins_cust AS (
  INSERT INTO public.customers (tenant_id, code, name, type, country)
  SELECT tn.id, 'RACUS-STUDIO', 'Racus Studio', 'company', 'MY'
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
), inv AS (
  INSERT INTO public.invoices (
    tenant_id, customer_id, customer_name, ref_no, issue_date, due_date,
    total, paid_amt, status, notes, created_at, updated_at
  )
  SELECT
    cust.tenant_id, cust.id, 'Racus Studio', 'INV-20261009-RACUS', '2026-10-09', '2026-10-09',
    0, 0, 'unpaid',
    'Token staff. Bill to Racus Studio, Maybank 564397158599. Receive into Brzky Empire Public Bank 3242191926. Amount not in source message.',
    now(), now()
  FROM cust
  WHERE NOT EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.tenant_id = cust.tenant_id AND i.ref_no = 'INV-20261009-RACUS' AND i.deleted_at IS NULL
  )
  RETURNING id, tenant_id
)
INSERT INTO public.invoice_items (tenant_id, invoice_id, description, qty, unit_price, line_total)
SELECT inv.tenant_id, inv.id, 'Token staff', 1, 0, 0
FROM inv;
