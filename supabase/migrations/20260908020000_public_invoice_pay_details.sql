CREATE OR REPLACE FUNCTION public.get_public_invoice(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv invoices%ROWTYPE;
  items jsonb;
  tn tenants%ROWTYPE;
  cp jsonb;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 8 THEN
    RAISE EXCEPTION 'Invalid token';
  END IF;
  SELECT * INTO inv FROM invoices WHERE public_token = trim(p_token) AND deleted_at IS NULL LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;
  SELECT * INTO tn FROM tenants WHERE id = inv.tenant_id;
  cp := coalesce(tn.config->'company_profile', '{}'::jsonb);

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'description', description,
    'qty', qty,
    'unit_price', unit_price,
    'line_total', line_total
  ) ORDER BY created_at), '[]'::jsonb)
  INTO items
  FROM invoice_items WHERE invoice_id = inv.id;

  RETURN jsonb_build_object(
    'tenant_name', coalesce(nullif(tn.name,''), cp->>'name'),
    'logo_url', coalesce(nullif(tn.logo_url,''), cp->>'logo_url'),
    'payment_qr_url', coalesce(nullif(tn.payment_qr_url,''), cp->>'payment_qr_url'),
    'ssm_no', coalesce(nullif(tn.ssm_no,''), cp->>'ssm_no'),
    'address', coalesce(nullif(tn.address,''), cp->>'address'),
    'address_line2', coalesce(nullif(tn.address_line2,''), cp->>'address_line2'),
    'city', coalesce(nullif(tn.city,''), cp->>'city'),
    'postcode', coalesce(nullif(tn.postcode,''), cp->>'postcode'),
    'state', coalesce(nullif(tn.state,''), cp->>'state'),
    'phone', coalesce(nullif(tn.phone,''), cp->>'phone'),
    'email', coalesce(nullif(tn.email,''), cp->>'email'),
    'bank_name', coalesce(nullif(tn.bank_name,''), cp->>'bank_name'),
    'account_name', coalesce(nullif(tn.account_name,''), cp->>'account_name'),
    'account_number', coalesce(nullif(tn.account_number,''), cp->>'account_number'),
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

GRANT EXECUTE ON FUNCTION public.get_public_invoice(text) TO anon, authenticated;
