-- Set Racus Studio token-staff invoice to RM 250.
UPDATE public.invoice_items ii
SET qty = 1, unit_price = 250, line_total = 250
FROM public.invoices i
JOIN public.tenants t ON t.id = i.tenant_id
WHERE ii.invoice_id = i.id
  AND i.ref_no = 'INV-20261009-RACUS'
  AND i.deleted_at IS NULL
  AND (t.code = 'BROZKY99' OR t.name ILIKE '%br%zky%empire%');

UPDATE public.invoices i
SET total = 250, paid_amt = 0, status = 'unpaid', updated_at = now()
FROM public.tenants t
WHERE i.tenant_id = t.id
  AND i.ref_no = 'INV-20261009-RACUS'
  AND i.deleted_at IS NULL
  AND (t.code = 'BROZKY99' OR t.name ILIKE '%br%zky%empire%');
