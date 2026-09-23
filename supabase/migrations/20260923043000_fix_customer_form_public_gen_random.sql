-- Fix: pgcrypto RNG not visible under search_path=public.
-- Use gen_random_uuid() (PG13+ core; already used as PK defaults).
-- Mike: paste this entire file into Supabase SQL Editor (plain text, no markdown fences).

CREATE OR REPLACE FUNCTION public.ensure_customer_form_public_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  tid uuid;
  tok text;
BEGIN
  tid := public.get_my_tenant_id();
  IF tid IS NULL THEN RAISE EXCEPTION 'No tenant'; END IF;
  SELECT customer_form_public_token INTO tok FROM public.tenants WHERE id = tid;
  IF tok IS NULL OR length(tok) < 8 THEN
    tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    UPDATE public.tenants SET customer_form_public_token = tok WHERE id = tid;
  END IF;
  RETURN tok;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.get_public_customer_form(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE tn public.tenants%ROWTYPE;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 8 THEN RETURN NULL; END IF;
  SELECT * INTO tn FROM public.tenants
  WHERE customer_form_public_token = trim(p_token)
    AND deleted_at IS NULL
  LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'tenant_name', tn.name,
    'logo_url', tn.logo_url
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.submit_public_customer(p_token text, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  tn public.tenants%ROWTYPE;
  v_id uuid;
  v_mode text;
  v_name text;
  v_email text;
  v_code text;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 8 THEN
    RAISE EXCEPTION 'invalid token';
  END IF;
  SELECT * INTO tn FROM public.tenants
  WHERE customer_form_public_token = trim(p_token)
    AND deleted_at IS NULL
  LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid token'; END IF;

  v_name := nullif(trim(coalesce(p_payload->>'name','')), '');
  IF v_name IS NULL OR length(v_name) < 2 THEN
    RAISE EXCEPTION 'name required';
  END IF;
  v_email := nullif(trim(coalesce(p_payload->>'email','')), '');
  IF v_email IS NOT NULL THEN
    v_email := lower(v_email);
  END IF;

  IF v_email IS NOT NULL AND length(v_email) > 3 THEN
    SELECT id INTO v_id FROM public.customers
    WHERE tenant_id = tn.id
      AND deleted_at IS NULL
      AND lower(email) = v_email
    LIMIT 1;
  END IF;

  IF v_id IS NOT NULL THEN
    UPDATE public.customers SET
      name = v_name,
      email = v_email,
      phone = nullif(trim(coalesce(p_payload->>'phone','')), ''),
      address_line1 = nullif(trim(coalesce(p_payload->>'address_line1','')), ''),
      city = nullif(trim(coalesce(p_payload->>'city','')), ''),
      postcode = nullif(trim(coalesce(p_payload->>'postcode','')), ''),
      state = nullif(trim(coalesce(p_payload->>'state','')), ''),
      notes = nullif(trim(coalesce(p_payload->>'notes','')), ''),
      updated_at = now()
    WHERE id = v_id AND tenant_id = tn.id AND deleted_at IS NULL;
    v_mode := 'updated';
  ELSE
    BEGIN
      v_code := public.next_ref_no('CUST');
    EXCEPTION WHEN OTHERS THEN
      v_code := NULL;
    END;
    IF v_code IS NULL OR length(trim(v_code)) < 3 THEN
      v_code := 'CUST-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    END IF;
    INSERT INTO public.customers (
      tenant_id, code, name, email, phone,
      address_line1, city, postcode, state, notes
    ) VALUES (
      tn.id, v_code, v_name, v_email,
      nullif(trim(coalesce(p_payload->>'phone','')), ''),
      nullif(trim(coalesce(p_payload->>'address_line1','')), ''),
      nullif(trim(coalesce(p_payload->>'city','')), ''),
      nullif(trim(coalesce(p_payload->>'postcode','')), ''),
      nullif(trim(coalesce(p_payload->>'state','')), ''),
      nullif(trim(coalesce(p_payload->>'notes','')), '')
    ) RETURNING id INTO v_id;
    v_mode := 'created';
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'mode', v_mode);
END;
$fn$;

REVOKE ALL ON FUNCTION public.ensure_customer_form_public_token() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_customer_form(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_public_customer(text, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ensure_customer_form_public_token() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_customer_form(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_customer(text, jsonb) TO anon, authenticated;
