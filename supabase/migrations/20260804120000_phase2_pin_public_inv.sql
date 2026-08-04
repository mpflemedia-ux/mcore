-- Optional: public invoice share token
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS public_token text;
CREATE UNIQUE INDEX IF NOT EXISTS invoices_public_token_uidx ON invoices(public_token) WHERE public_token IS NOT NULL;

-- Read-only public invoice by token (no auth required for EXECUTE by anon)
CREATE OR REPLACE FUNCTION get_public_invoice(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv invoices%ROWTYPE;
  items jsonb;
  tenant_name text;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 8 THEN
    RAISE EXCEPTION 'Invalid token';
  END IF;
  SELECT * INTO inv FROM invoices WHERE public_token = trim(p_token) AND deleted_at IS NULL LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;
  SELECT name INTO tenant_name FROM tenants WHERE id = inv.tenant_id;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'description', description,
    'qty', qty,
    'unit_price', unit_price,
    'line_total', line_total
  ) ORDER BY created_at), '[]'::jsonb)
  INTO items
  FROM invoice_items WHERE invoice_id = inv.id;

  RETURN jsonb_build_object(
    'tenant_name', tenant_name,
    'ref_no', inv.ref_no,
    'issue_date', inv.issue_date,
    'due_date', inv.due_date,
    'customer_name', inv.customer_name,
    'subtotal', inv.subtotal,
    'tax_rate', inv.tax_rate,
    'tax_amt', inv.tax_amt,
    'total', inv.total,
    'paid_amt', inv.paid_amt,
    'status', inv.status,
    'items', items
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_invoice(text) TO anon, authenticated;
