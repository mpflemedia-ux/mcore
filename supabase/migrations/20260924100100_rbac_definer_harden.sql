-- Harden SECURITY DEFINER surfaces used in public / cross-tenant paths.

-- 1) expire_stale_bookings: no direct anon execute; other DEFINER callers still work as owner
REVOKE ALL ON FUNCTION public.expire_stale_bookings() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_stale_bookings() FROM anon;
REVOKE ALL ON FUNCTION public.expire_stale_bookings() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_bookings() TO service_role;
-- Keep postgres/supabase_admin implicit. Authenticated cron (if any) should use service_role.

COMMENT ON FUNCTION public.expire_stale_bookings() IS
  'Expire hold/pending_payment bookings past hold_until. Execute: service_role only (called from other DEFINER booking RPCs).';

-- 2) seed_malaysia_public_holidays_2026: reject NULL tenant for non-platform; scope to caller tenant
CREATE OR REPLACE FUNCTION public.seed_malaysia_public_holidays_2026(p_tenant_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tid uuid;
  ins_count int := 0;
  n int;
  holidays text[][] := ARRAY[
    ARRAY['2026-01-01', 'Public Holiday — New Year''s Day', 'Cuti Umum — Hari Tahun Baru'],
    ARRAY['2026-02-01', 'Public Holiday — Federal Territory Day', 'Cuti Umum — Hari Wilayah Persekutuan'],
    ARRAY['2026-02-17', 'Public Holiday — Chinese New Year', 'Cuti Umum — Tahun Baru Cina'],
    ARRAY['2026-02-18', 'Public Holiday — Chinese New Year (Day 2)', 'Cuti Umum — Tahun Baru Cina (Hari 2)'],
    ARRAY['2026-03-21', 'Public Holiday — Hari Raya Aidilfitri', 'Cuti Umum — Hari Raya Aidilfitri'],
    ARRAY['2026-03-22', 'Public Holiday — Hari Raya Aidilfitri (Day 2)', 'Cuti Umum — Hari Raya Aidilfitri (Hari 2)'],
    ARRAY['2026-05-01', 'Public Holiday — Labour Day', 'Cuti Umum — Hari Pekerja'],
    ARRAY['2026-05-27', 'Public Holiday — Hari Raya Aidiladha', 'Cuti Umum — Hari Raya Aidiladha'],
    ARRAY['2026-05-31', 'Public Holiday — Wesak Day', 'Cuti Umum — Hari Wesak'],
    ARRAY['2026-06-01', 'Public Holiday — Yang di-Pertuan Agong''s Birthday', 'Cuti Umum — Hari Keputeraan YDPA'],
    ARRAY['2026-06-17', 'Public Holiday — Awal Muharram', 'Cuti Umum — Awal Muharram'],
    ARRAY['2026-08-25', 'Public Holiday — Maulidur Rasul', 'Cuti Umum — Maulidur Rasul'],
    ARRAY['2026-08-31', 'Public Holiday — National Day (Merdeka)', 'Cuti Umum — Hari Kebangsaan'],
    ARRAY['2026-09-16', 'Public Holiday — Malaysia Day', 'Cuti Umum — Hari Malaysia'],
    ARRAY['2026-11-08', 'Public Holiday — Deepavali', 'Cuti Umum — Deepavali'],
    ARRAY['2026-12-25', 'Public Holiday — Christmas Day', 'Cuti Umum — Hari Krismas']
  ];
  h text[];
  d date;
  marker text;
  owner uuid;
  caller_role text;
  my_tid uuid;
  is_service boolean := (current_setting('role', true) = 'service_role');
BEGIN
  SELECT lower(trim(coalesce(role, ''))) INTO caller_role
  FROM public.user_profiles WHERE id = auth.uid();

  my_tid := NULL;
  BEGIN
    my_tid := public.get_my_tenant_id();
  EXCEPTION WHEN OTHERS THEN
    my_tid := NULL;
  END;

  -- Non-platform callers may only seed their own tenant; NULL p_tenant_id → own tenant
  IF NOT is_service AND coalesce(caller_role, '') <> 'platform_admin' THEN
    IF my_tid IS NULL THEN
      RAISE EXCEPTION 'tenant required';
    END IF;
    IF p_tenant_id IS NULL THEN
      p_tenant_id := my_tid;
    ELSIF p_tenant_id <> my_tid THEN
      RAISE EXCEPTION 'cannot seed holidays for another tenant';
    END IF;
  END IF;

  FOR tid IN
    SELECT id FROM public.tenants
    WHERE deleted_at IS NULL
      AND coalesce(is_active, true) = true
      AND (p_tenant_id IS NULL OR id = p_tenant_id)
  LOOP
    SELECT up.id INTO owner
    FROM public.user_profiles up
    WHERE up.tenant_id = tid
    ORDER BY up.id
    LIMIT 1;

    IF owner IS NULL THEN
      CONTINUE;
    END IF;

    FOREACH h SLICE 1 IN ARRAY holidays
    LOOP
      d := h[1]::date;
      marker := 'MY_PH:2026:' || h[1];
      IF EXISTS (
        SELECT 1 FROM public.platform_activities pa
        WHERE pa.tenant_id = tid
          AND pa.deleted_at IS NULL
          AND pa.notes LIKE marker || '%'
      ) THEN
        CONTINUE;
      END IF;

      INSERT INTO public.platform_activities (
        tenant_id, owner_user_id, title, activity_type, status,
        starts_at, ends_at, due_at, notes, created_at, updated_at
      ) VALUES (
        tid,
        owner,
        h[2],
        'event',
        'open',
        (d::timestamp AT TIME ZONE 'Asia/Kuala_Lumpur'),
        (d::timestamp AT TIME ZONE 'Asia/Kuala_Lumpur') + interval '1 day' - interval '1 second',
        NULL,
        marker || E'\n' || h[3] || E'\nMalaysia federal public holiday 2026 (seed). Islamic dates may be adjusted after official announcement.',
        now(),
        now()
      );
      ins_count := ins_count + 1;
    END LOOP;
  END LOOP;
  RETURN ins_count;
END;
$$;

COMMENT ON FUNCTION public.seed_malaysia_public_holidays_2026(uuid) IS
  'Seed MY federal holidays 2026. Non-platform: only caller tenant (NULL → own). service_role/platform_admin may pass NULL=all.';

-- 3) submit_public_customer: no silent full overwrite — fill blank fields only; else error if fully populated
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
  v_phone text;
  v_addr text;
  v_city text;
  v_postcode text;
  v_state text;
  v_notes text;
  cur record;
  filled int := 0;
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
  v_phone := nullif(trim(coalesce(p_payload->>'phone','')), '');
  v_addr := nullif(trim(coalesce(p_payload->>'address_line1','')), '');
  v_city := nullif(trim(coalesce(p_payload->>'city','')), '');
  v_postcode := nullif(trim(coalesce(p_payload->>'postcode','')), '');
  v_state := nullif(trim(coalesce(p_payload->>'state','')), '');
  v_notes := nullif(trim(coalesce(p_payload->>'notes','')), '');

  IF v_email IS NOT NULL AND length(v_email) > 3 THEN
    SELECT id INTO v_id FROM public.customers
    WHERE tenant_id = tn.id
      AND deleted_at IS NULL
      AND lower(email) = v_email
    LIMIT 1;
  END IF;

  IF v_id IS NOT NULL THEN
    SELECT * INTO cur FROM public.customers
    WHERE id = v_id AND tenant_id = tn.id AND deleted_at IS NULL;

    -- Any blank field we can fill?
    filled := 0;
    IF nullif(trim(coalesce(cur.name,'')), '') IS NULL AND v_name IS NOT NULL THEN filled := filled + 1; END IF;
    IF nullif(trim(coalesce(cur.phone,'')), '') IS NULL AND v_phone IS NOT NULL THEN filled := filled + 1; END IF;
    IF nullif(trim(coalesce(cur.address_line1,'')), '') IS NULL AND v_addr IS NOT NULL THEN filled := filled + 1; END IF;
    IF nullif(trim(coalesce(cur.city,'')), '') IS NULL AND v_city IS NOT NULL THEN filled := filled + 1; END IF;
    IF nullif(trim(coalesce(cur.postcode,'')), '') IS NULL AND v_postcode IS NOT NULL THEN filled := filled + 1; END IF;
    IF nullif(trim(coalesce(cur.state,'')), '') IS NULL AND v_state IS NOT NULL THEN filled := filled + 1; END IF;
    IF nullif(trim(coalesce(cur.notes,'')), '') IS NULL AND v_notes IS NOT NULL THEN filled := filled + 1; END IF;

    IF filled = 0 THEN
      RAISE EXCEPTION 'customer already exists';
    END IF;

    -- Update ONLY blank fields — never overwrite existing profile data
    UPDATE public.customers SET
      name = CASE WHEN nullif(trim(coalesce(cur.name,'')), '') IS NULL THEN v_name ELSE cur.name END,
      phone = CASE WHEN nullif(trim(coalesce(cur.phone,'')), '') IS NULL THEN v_phone ELSE cur.phone END,
      address_line1 = CASE WHEN nullif(trim(coalesce(cur.address_line1,'')), '') IS NULL THEN v_addr ELSE cur.address_line1 END,
      city = CASE WHEN nullif(trim(coalesce(cur.city,'')), '') IS NULL THEN v_city ELSE cur.city END,
      postcode = CASE WHEN nullif(trim(coalesce(cur.postcode,'')), '') IS NULL THEN v_postcode ELSE cur.postcode END,
      state = CASE WHEN nullif(trim(coalesce(cur.state,'')), '') IS NULL THEN v_state ELSE cur.state END,
      notes = CASE WHEN nullif(trim(coalesce(cur.notes,'')), '') IS NULL THEN v_notes ELSE cur.notes END,
      updated_at = now()
    WHERE id = v_id AND tenant_id = tn.id AND deleted_at IS NULL;

    v_mode := 'updated_blank_only';
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
      v_phone, v_addr, v_city, v_postcode, v_state, v_notes
    ) RETURNING id INTO v_id;
    v_mode := 'created';
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'mode', v_mode);
END;
$fn$;

REVOKE ALL ON FUNCTION public.submit_public_customer(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_customer(text, jsonb) TO anon, authenticated;

COMMENT ON FUNCTION public.submit_public_customer(text, jsonb) IS
  'Public customer form: insert new email; existing email fills blank fields only (no full overwrite).';
