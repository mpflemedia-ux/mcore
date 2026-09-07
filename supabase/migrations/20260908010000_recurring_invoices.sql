ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS recurring_interval text,
  ADD COLUMN IF NOT EXISTS recurring_next date,
  ADD COLUMN IF NOT EXISTS recurring_active boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurring_source_id uuid;

COMMENT ON COLUMN public.invoices.recurring_interval IS 'monthly | quarterly | yearly';
COMMENT ON COLUMN public.invoices.recurring_next IS 'Next date to spawn a child invoice';
COMMENT ON COLUMN public.invoices.recurring_active IS 'When true, opening Sales may generate a due child invoice';
COMMENT ON COLUMN public.invoices.recurring_source_id IS 'Parent/template invoice this row was generated from';

CREATE INDEX IF NOT EXISTS invoices_recurring_due_idx
  ON public.invoices (tenant_id, recurring_next)
  WHERE recurring_active = true AND deleted_at IS NULL;
