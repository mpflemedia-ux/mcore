-- Public view token for service requests (client view without login)
ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS public_view_token text;

CREATE UNIQUE INDEX IF NOT EXISTS service_requests_view_token_uidx
  ON public.service_requests (public_view_token)
  WHERE public_view_token IS NOT NULL AND deleted_at IS NULL;

-- Anon can read a request by token only (no other rows)
CREATE OR REPLACE FUNCTION public.get_sr_public_view(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.service_requests%ROWTYPE;
  tn text;
  ev jsonb;
BEGIN
  SELECT * INTO r FROM public.service_requests
  WHERE public_view_token = trim(p_token) AND deleted_at IS NULL
  LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  -- expire 7 days after delivered
  IF r.delivered_at IS NOT NULL AND r.delivered_at < now() - interval '7 days' THEN
    RETURN jsonb_build_object('expired', true, 'ref_no', r.ref_no);
  END IF;
  SELECT name INTO tn FROM public.tenants WHERE id = r.tenant_id;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'type', e.type, 'body', e.body, 'file_path', e.file_path,
    'created_at', e.created_at, 'meta', e.meta
  ) ORDER BY e.created_at), '[]'::jsonb)
  INTO ev
  FROM public.service_request_events e
  WHERE e.request_id = r.id AND e.type IN ('attachment','comment','status')
    AND e.deleted_at IS NULL;
  -- log view
  INSERT INTO public.service_request_events (tenant_id, request_id, type, body, created_at)
  VALUES (r.tenant_id, r.id, 'viewed', 'Client viewed', now());
  RETURN jsonb_build_object(
    'id', r.id, 'ref_no', r.ref_no, 'title', r.title, 'description', r.description,
    'status', r.status, 'priority', r.priority, 'service_code', r.service_code,
    'created_at', r.created_at, 'sla_due', r.sla_due, 'delivered_at', r.delivered_at,
    'tenant', tn, 'events', ev
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_sr_public_view(text) TO anon, authenticated;

-- Client reply from public page
CREATE OR REPLACE FUNCTION public.sr_public_reply(p_token text, p_body text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.service_requests%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.service_requests
  WHERE public_view_token = trim(p_token) AND deleted_at IS NULL LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false); END IF;
  IF r.delivered_at IS NOT NULL AND r.delivered_at < now() - interval '7 days' THEN
    RETURN jsonb_build_object('ok', false, 'expired', true);
  END IF;
  INSERT INTO public.service_request_events (tenant_id, request_id, type, body, created_at)
  VALUES (r.tenant_id, r.id, 'comment', trim(p_body), now());
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sr_public_reply(text, text) TO anon, authenticated;
