ALTER TABLE quotations ADD COLUMN IF NOT EXISTS public_token text;
CREATE UNIQUE INDEX IF NOT EXISTS quotations_public_token_uidx ON quotations(public_token) WHERE public_token IS NOT NULL;

CREATE OR REPLACE FUNCTION get_public_quotation(p_token text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS '
SELECT jsonb_build_object(
  ''tenant_name'', (SELECT name FROM tenants WHERE id = q.tenant_id),
  ''ref_no'', q.ref_no,
  ''issue_date'', q.issue_date,
  ''valid_until'', q.valid_until,
  ''customer_name'', q.customer_name,
  ''total'', q.total,
  ''status'', q.status,
  ''items'', coalesce((
    SELECT jsonb_agg(
      jsonb_build_object(
        ''description'', qi.description,
        ''qty'', qi.qty,
        ''unit_price'', qi.unit_price,
        ''line_total'', qi.line_total
      )
    )
    FROM quotation_items qi
    WHERE qi.quotation_id = q.id
  ), ''[]''::jsonb)
)
FROM quotations q
WHERE q.public_token = trim(p_token)
  AND q.deleted_at IS NULL
LIMIT 1;
';

GRANT EXECUTE ON FUNCTION get_public_quotation(text) TO anon, authenticated;
