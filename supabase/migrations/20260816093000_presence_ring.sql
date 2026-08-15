-- Presence Ring geofence settings (all tenants)
-- Safe to re-run

ALTER TABLE public.tenant_attendance_settings
  ADD COLUMN IF NOT EXISTS office_lat numeric,
  ADD COLUMN IF NOT EXISTS office_lng numeric,
  ADD COLUMN IF NOT EXISTS office_radius_m int DEFAULT 500,
  ADD COLUMN IF NOT EXISTS office_name text,
  ADD COLUMN IF NOT EXISTS geo_enforce boolean DEFAULT false;

COMMENT ON COLUMN public.tenant_attendance_settings.office_lat IS 'Office geofence latitude';
COMMENT ON COLUMN public.tenant_attendance_settings.office_lng IS 'Office geofence longitude';
COMMENT ON COLUMN public.tenant_attendance_settings.office_radius_m IS 'Presence radius metres (default 500)';
COMMENT ON COLUMN public.tenant_attendance_settings.office_name IS 'Office label for Presence Ring messages';
COMMENT ON COLUMN public.tenant_attendance_settings.geo_enforce IS 'When true, staff Office clock-in blocked outside radius';
