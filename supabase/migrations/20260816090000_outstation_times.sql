-- Outstation depart/return times (all tenants)
-- Safe to re-run

ALTER TABLE public.outstation_requests
  ADD COLUMN IF NOT EXISTS depart_time time without time zone,
  ADD COLUMN IF NOT EXISTS return_time time without time zone;

COMMENT ON COLUMN public.outstation_requests.depart_time IS 'Expected depart time (local)';
COMMENT ON COLUMN public.outstation_requests.return_time IS 'Expected return time (local)';
