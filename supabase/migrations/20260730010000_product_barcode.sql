-- ============================================================================
-- Migration: Product Barcode
-- NOTE: Supabase Edge Functions/migrations do NOT auto-deploy from GitHub —
-- run this manually in Supabase Dashboard -> SQL Editor.
-- ============================================================================

ALTER TABLE products ADD COLUMN barcode text;

CREATE INDEX idx_products_barcode ON products(tenant_id, barcode)
  WHERE barcode IS NOT NULL;
