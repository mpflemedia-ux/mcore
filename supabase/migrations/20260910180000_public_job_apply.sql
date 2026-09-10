-- Public job-application link (applicant fills form without login).
-- Run manually in Supabase SQL Editor.

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS job_apply_token text;
CREATE UNIQUE INDEX IF NOT EXISTS tenants_job_apply_token_uidx ON public.tenants(job_apply_token) WHERE job_apply_token IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_public_apply_form(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tn public.tenants%ROWTYPE;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 8 THEN RETURN NULL; END IF;
  SELECT * INTO tn FROM public.tenants WHERE job_apply_token = trim(p_token) LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('tenant_name', tn.name, 'logo_url', tn.logo_url);
END $$;

CREATE OR REPLACE FUNCTION public.submit_public_application(p_token text, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant uuid; v_id uuid; v_ref text; v_name text; v_pos text; v_gender text; v_marital text;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 8 THEN RAISE EXCEPTION 'invalid token'; END IF;
  SELECT id INTO v_tenant FROM public.tenants WHERE job_apply_token = trim(p_token) LIMIT 1;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'invalid token'; END IF;
  v_name := nullif(trim(coalesce(p_payload->>'full_name','')), '');
  v_pos  := nullif(trim(coalesce(p_payload->>'position_applied','')), '');
  IF v_name IS NULL OR v_pos IS NULL THEN RAISE EXCEPTION 'name and position required'; END IF;
  v_gender := p_payload->>'gender';
  IF v_gender IS NULL OR v_gender NOT IN ('male','female') THEN v_gender := NULL; END IF;
  v_marital := p_payload->>'marital_status';
  IF v_marital IS NULL OR v_marital NOT IN ('single','married','divorced','widowed') THEN v_marital := NULL; END IF;
  v_ref := 'APP-' || to_char(now() AT TIME ZONE 'Asia/Kuala_Lumpur', 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 4));
  INSERT INTO public.job_applicants (
    tenant_id, ref_no, position_applied, expected_salary, available_date,
    full_name, ic_no, dob, gender, nationality, marital_status,
    mobile_no, email, home_address, education, employment_history, language_proficiency,
    emergency_name, emergency_relationship, emergency_mobile, emergency_address, status
  ) VALUES (
    v_tenant, v_ref, v_pos,
    NULLIF(p_payload->>'expected_salary','')::numeric,
    NULLIF(p_payload->>'available_date','')::date,
    v_name,
    NULLIF(trim(coalesce(p_payload->>'ic_no','')), ''),
    NULLIF(p_payload->>'dob','')::date,
    v_gender,
    NULLIF(trim(coalesce(p_payload->>'nationality','')), ''),
    v_marital,
    NULLIF(trim(coalesce(p_payload->>'mobile_no','')), ''),
    NULLIF(trim(coalesce(p_payload->>'email','')), ''),
    NULLIF(trim(coalesce(p_payload->>'home_address','')), ''),
    COALESCE(p_payload->'education', '[]'::jsonb),
    COALESCE(p_payload->'employment_history', '[]'::jsonb),
    COALESCE(p_payload->'language_proficiency', '{}'::jsonb),
    NULLIF(trim(coalesce(p_payload->>'emergency_name','')), ''),
    NULLIF(trim(coalesce(p_payload->>'emergency_relationship','')), ''),
    NULLIF(trim(coalesce(p_payload->>'emergency_mobile','')), ''),
    NULLIF(trim(coalesce(p_payload->>'emergency_address','')), ''),
    'pending'
  ) RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'id', v_id, 'ref_no', v_ref);
END $$;

REVOKE ALL ON FUNCTION public.get_public_apply_form(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_public_application(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_apply_form(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_application(text, jsonb) TO anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.dev_roadmap_items WHERE title ILIKE '%public%apply%' OR title ILIKE '%applicant%link%' OR title ILIKE '%share%applicant%') THEN
    UPDATE public.dev_roadmap_items SET stage='completed',
      description='Public share link so applicants fill Job Application form without login.',
      module=COALESCE(module,'applicants')
    WHERE title ILIKE '%public%apply%' OR title ILIKE '%applicant%link%' OR title ILIKE '%share%applicant%';
  ELSE
    INSERT INTO public.dev_roadmap_items (title, description, module, stage)
    VALUES ('Job Applicants — public apply link','Public share link so applicants fill Job Application form without login.','applicants','completed');
  END IF;
END $$;
