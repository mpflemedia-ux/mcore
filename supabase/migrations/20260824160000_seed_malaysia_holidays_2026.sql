-- Seed Malaysia federal public holidays 2026 into Planner as events (all active tenants).
-- Idempotent: notes marker MY_PH:2026:<YYYY-MM-DD>
-- Islamic dates are commonly published estimates; adjust if official gazette differs.

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
    -- date, title_en, title_bm
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
BEGIN
  FOR tid IN
    SELECT id FROM public.tenants
    WHERE deleted_at IS NULL
      AND coalesce(is_active, true) = true
      AND (p_tenant_id IS NULL OR id = p_tenant_id)
  LOOP
    -- Prefer an owner/admin profile as owner_user_id (nullable-safe)
    SELECT up.id INTO owner
    FROM public.user_profiles up
    WHERE up.tenant_id = tid
    ORDER BY CASE WHEN lower(coalesce(up.role,'')) IN ('owner','admin','platform_admin') THEN 0 ELSE 1 END, up.created_at NULLS LAST
    LIMIT 1;

    IF owner IS NULL THEN
      CONTINUE; -- no user yet; skip until team exists
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

-- Run for all current tenants
SELECT public.seed_malaysia_public_holidays_2026(NULL);

COMMENT ON FUNCTION public.seed_malaysia_public_holidays_2026(uuid) IS
  'Seed MY federal public holidays 2026 as planner events; pass tenant_id or NULL=all';
