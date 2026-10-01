-- Customer Source / Sumber (free-text lead origin: Ceonita, MIHAS, TikTok, meetup, …)
-- WRITE-ONLY from agents — run in Supabase SQL Editor as authorised operator.
-- UI: CRM customer form (#cf-source) + list column. Does not change public form RPC / crm-scan.

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS source text;

COMMENT ON COLUMN public.customers.source IS
  'Free-text customer acquisition source / Sumber (e.g. Ceonita, MIHAS, TikTok, meetup). Optional.';

-- Optional filter/sort helper (null sources skipped; soft-deleted excluded)
CREATE INDEX IF NOT EXISTS idx_customers_tenant_source
  ON public.customers (tenant_id, source)
  WHERE deleted_at IS NULL AND source IS NOT NULL;
