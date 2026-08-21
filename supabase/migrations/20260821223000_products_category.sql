-- Product category (text) for inventory grouping / filter
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category text;

CREATE INDEX IF NOT EXISTS products_tenant_category_idx
  ON public.products (tenant_id, category)
  WHERE deleted_at IS NULL;

-- Optional backfill for M-Core seed SKUs (MP Workspace + any tenant with same codes)
UPDATE public.products SET category = 'Software'
WHERE category IS NULL AND code LIKE 'MCORE-%' AND code NOT LIKE 'MCORE-SETUP%';

UPDATE public.products SET category = 'Setup'
WHERE category IS NULL AND code LIKE 'MCORE-SETUP%';

UPDATE public.products SET category = 'Bookkeeping'
WHERE category IS NULL AND code LIKE 'OPS-BK-%';

UPDATE public.products SET category = 'Payroll & Tax'
WHERE category IS NULL AND (code LIKE 'OPS-PAY-%' OR code = 'OPS-TAX-C');

UPDATE public.products SET category = 'Website & Systems'
WHERE category IS NULL AND code LIKE 'WEB-%';
