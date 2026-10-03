-- WRITE-ONLY for Mike. Do not run from CI, the app, or an agent.
-- Planner support mode stores the picked CRM customer on the activity
-- without putting a customer uuid into related_tenant_id (FK -> tenants).

ALTER TABLE public.platform_activities
  ADD COLUMN IF NOT EXISTS customer_id uuid;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'customers'
      AND column_name = 'id'
      AND udt_name = 'uuid'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'platform_activities_customer_id_fkey'
  ) THEN
    ALTER TABLE public.platform_activities
      ADD CONSTRAINT platform_activities_customer_id_fkey
      FOREIGN KEY (customer_id)
      REFERENCES public.customers (id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS platform_activities_customer_idx
  ON public.platform_activities (tenant_id, customer_id)
  WHERE deleted_at IS NULL AND customer_id IS NOT NULL;

COMMENT ON COLUMN public.platform_activities.customer_id IS
  'CRM customer picked while platform admin is in support mode. Nullable. Separate from related_tenant_id (tenants FK).';
