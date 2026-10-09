-- Nurbella Empire stock from STOK MELAKA,GOMBAK UIA.xlsx
-- SKU = design / colour / size. Combo and box excluded (no price).
DO $body$
DECLARE
  tn uuid;
  n int := 0;
BEGIN
  SELECT id INTO tn FROM public.tenants
  WHERE deleted_at IS NULL AND name ILIKE '%nurbella%empire%'
  ORDER BY is_active DESC NULLS LAST, created_at
  LIMIT 1;
  IF tn IS NULL THEN
    RAISE EXCEPTION 'Tenant Nurbella Empire tidak dijumpai';
  END IF;
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0001', 'Handsocks Wawa / Black / S', 'Handsocks Wawa / Black / S', 'Handsocks', 'pcs', 17.00, 0, 12.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Wawa / Black / S'
  );
  UPDATE public.products SET
    unit_price = 17.00, stock_qty = 12.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Wawa / Black / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0002', 'Handsocks Wawa / Black / M', 'Handsocks Wawa / Black / M', 'Handsocks', 'pcs', 17.00, 0, 12.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Wawa / Black / M'
  );
  UPDATE public.products SET
    unit_price = 17.00, stock_qty = 12.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Wawa / Black / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0003', 'Handsocks Wawa / Black / L', 'Handsocks Wawa / Black / L', 'Handsocks', 'pcs', 19.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Wawa / Black / L'
  );
  UPDATE public.products SET
    unit_price = 19.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Wawa / Black / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0004', 'Handsocks Wawa / Orchid / S', 'Handsocks Wawa / Orchid / S', 'Handsocks', 'pcs', 17.00, 0, 4.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Wawa / Orchid / S'
  );
  UPDATE public.products SET
    unit_price = 17.00, stock_qty = 4.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Wawa / Orchid / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0005', 'Handsocks Wawa / Orchid / M', 'Handsocks Wawa / Orchid / M', 'Handsocks', 'pcs', 17.00, 0, 4.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Wawa / Orchid / M'
  );
  UPDATE public.products SET
    unit_price = 17.00, stock_qty = 4.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Wawa / Orchid / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0006', 'Handsocks Wawa / Orchid / L', 'Handsocks Wawa / Orchid / L', 'Handsocks', 'pcs', 19.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Wawa / Orchid / L'
  );
  UPDATE public.products SET
    unit_price = 19.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Wawa / Orchid / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0007', 'Handsocks Wawa / Milo Brown / S', 'Handsocks Wawa / Milo Brown / S', 'Handsocks', 'pcs', 17.00, 0, 12.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Wawa / Milo Brown / S'
  );
  UPDATE public.products SET
    unit_price = 17.00, stock_qty = 12.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Wawa / Milo Brown / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0008', 'Handsocks Wawa / Milo Brown / M', 'Handsocks Wawa / Milo Brown / M', 'Handsocks', 'pcs', 17.00, 0, 12.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Wawa / Milo Brown / M'
  );
  UPDATE public.products SET
    unit_price = 17.00, stock_qty = 12.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Wawa / Milo Brown / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0009', 'Handsocks Wawa / Milo Brown / L', 'Handsocks Wawa / Milo Brown / L', 'Handsocks', 'pcs', 19.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Wawa / Milo Brown / L'
  );
  UPDATE public.products SET
    unit_price = 19.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Wawa / Milo Brown / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0010', 'Handsocks Wawa / Blueblack / S', 'Handsocks Wawa / Blueblack / S', 'Handsocks', 'pcs', 17.00, 0, 12.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Wawa / Blueblack / S'
  );
  UPDATE public.products SET
    unit_price = 17.00, stock_qty = 12.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Wawa / Blueblack / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0011', 'Handsocks Wawa / Blueblack / M', 'Handsocks Wawa / Blueblack / M', 'Handsocks', 'pcs', 17.00, 0, 12.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Wawa / Blueblack / M'
  );
  UPDATE public.products SET
    unit_price = 17.00, stock_qty = 12.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Wawa / Blueblack / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0012', 'Handsocks Wawa / Blueblack / L', 'Handsocks Wawa / Blueblack / L', 'Handsocks', 'pcs', 19.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Wawa / Blueblack / L'
  );
  UPDATE public.products SET
    unit_price = 19.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Wawa / Blueblack / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0013', 'Handsocks Wawa / Maroon / S', 'Handsocks Wawa / Maroon / S', 'Handsocks', 'pcs', 17.00, 0, 10.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Wawa / Maroon / S'
  );
  UPDATE public.products SET
    unit_price = 17.00, stock_qty = 10.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Wawa / Maroon / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0014', 'Handsocks Wawa / Maroon / M', 'Handsocks Wawa / Maroon / M', 'Handsocks', 'pcs', 17.00, 0, 8.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Wawa / Maroon / M'
  );
  UPDATE public.products SET
    unit_price = 17.00, stock_qty = 8.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Wawa / Maroon / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0015', 'Handsocks Wawa / Maroon / L', 'Handsocks Wawa / Maroon / L', 'Handsocks', 'pcs', 19.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Wawa / Maroon / L'
  );
  UPDATE public.products SET
    unit_price = 19.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Wawa / Maroon / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0016', 'Handsocks Wawa / Moss Green / S', 'Handsocks Wawa / Moss Green / S', 'Handsocks', 'pcs', 17.00, 0, 10.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Wawa / Moss Green / S'
  );
  UPDATE public.products SET
    unit_price = 17.00, stock_qty = 10.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Wawa / Moss Green / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0017', 'Handsocks Wawa / Moss Green / M', 'Handsocks Wawa / Moss Green / M', 'Handsocks', 'pcs', 17.00, 0, 8.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Wawa / Moss Green / M'
  );
  UPDATE public.products SET
    unit_price = 17.00, stock_qty = 8.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Wawa / Moss Green / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0018', 'Handsocks Wawa / Moss Green / L', 'Handsocks Wawa / Moss Green / L', 'Handsocks', 'pcs', 19.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Wawa / Moss Green / L'
  );
  UPDATE public.products SET
    unit_price = 19.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Wawa / Moss Green / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0019', 'Handsocks Wawa / Burgundy / S', 'Handsocks Wawa / Burgundy / S', 'Handsocks', 'pcs', 17.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Wawa / Burgundy / S'
  );
  UPDATE public.products SET
    unit_price = 17.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Wawa / Burgundy / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0020', 'Handsocks Wawa / Burgundy / M', 'Handsocks Wawa / Burgundy / M', 'Handsocks', 'pcs', 17.00, 0, 4.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Wawa / Burgundy / M'
  );
  UPDATE public.products SET
    unit_price = 17.00, stock_qty = 4.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Wawa / Burgundy / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0021', 'Handsocks Wawa / Burgundy / L', 'Handsocks Wawa / Burgundy / L', 'Handsocks', 'pcs', 19.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Wawa / Burgundy / L'
  );
  UPDATE public.products SET
    unit_price = 19.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Wawa / Burgundy / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0022', 'Handsocks Sajeeda / Black / S', 'Handsocks Sajeeda / Black / S', 'Handsocks', 'pcs', 17.00, 0, 5.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Sajeeda / Black / S'
  );
  UPDATE public.products SET
    unit_price = 17.00, stock_qty = 5.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Sajeeda / Black / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0023', 'Handsocks Sajeeda /  / M', 'Handsocks Sajeeda /  / M', 'Handsocks', 'pcs', 17.00, 0, 26.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Sajeeda /  / M'
  );
  UPDATE public.products SET
    unit_price = 17.00, stock_qty = 26.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Sajeeda /  / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0024', 'Handsocks Sajeeda /  / L', 'Handsocks Sajeeda /  / L', 'Handsocks', 'pcs', 19.00, 0, 18.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Sajeeda /  / L'
  );
  UPDATE public.products SET
    unit_price = 19.00, stock_qty = 18.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Sajeeda /  / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0025', 'Handsocks Sajeeda / Coffee / S', 'Handsocks Sajeeda / Coffee / S', 'Handsocks', 'pcs', 17.00, 0, 5.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Sajeeda / Coffee / S'
  );
  UPDATE public.products SET
    unit_price = 17.00, stock_qty = 5.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Sajeeda / Coffee / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0026', 'Handsocks Sajeeda / Rich Brown / S', 'Handsocks Sajeeda / Rich Brown / S', 'Handsocks', 'pcs', 17.00, 0, 5.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Sajeeda / Rich Brown / S'
  );
  UPDATE public.products SET
    unit_price = 17.00, stock_qty = 5.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Sajeeda / Rich Brown / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0027', 'Handsocks Sajeeda / Light Peanut / S', 'Handsocks Sajeeda / Light Peanut / S', 'Handsocks', 'pcs', 17.00, 0, 4.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Sajeeda / Light Peanut / S'
  );
  UPDATE public.products SET
    unit_price = 17.00, stock_qty = 4.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Sajeeda / Light Peanut / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0028', 'Handsocks Sajeeda / Nude Beige / S', 'Handsocks Sajeeda / Nude Beige / S', 'Handsocks', 'pcs', 17.00, 0, 5.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Sajeeda / Nude Beige / S'
  );
  UPDATE public.products SET
    unit_price = 17.00, stock_qty = 5.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Sajeeda / Nude Beige / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0029', 'Handsocks Sajeeda / White / S', 'Handsocks Sajeeda / White / S', 'Handsocks', 'pcs', 17.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Sajeeda / White / S'
  );
  UPDATE public.products SET
    unit_price = 17.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Sajeeda / White / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0030', Bella Socks / Charcoal', Bella Socks / Charcoal', 'Socks', 'pcs', 12.00, 0, 12.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = Bella Socks / Charcoal'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 12.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = Bella Socks / Charcoal';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0031', Bella Socks / Almond', Bella Socks / Almond', 'Socks', 'pcs', 12.00, 0, 12.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = Bella Socks / Almond'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 12.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = Bella Socks / Almond';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0032', Bella Socks / Copper', Bella Socks / Copper', 'Socks', 'pcs', 12.00, 0, 8.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = Bella Socks / Copper'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 8.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = Bella Socks / Copper';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0033', Bella Socks / Smoke', Bella Socks / Smoke', 'Socks', 'pcs', 12.00, 0, 5.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = Bella Socks / Smoke'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 5.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = Bella Socks / Smoke';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0034', Bella Socks / Midnight', Bella Socks / Midnight', 'Socks', 'pcs', 12.00, 0, 5.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = Bella Socks / Midnight'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 5.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = Bella Socks / Midnight';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0035', Bella Socks / Scallop', Bella Socks / Scallop', 'Socks', 'pcs', 12.00, 0, 8.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = Bella Socks / Scallop'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 8.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = Bella Socks / Scallop';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0036', Bella Socks / Dokong', Bella Socks / Dokong', 'Socks', 'pcs', 12.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = Bella Socks / Dokong'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = Bella Socks / Dokong';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0037', Bella Socks / Langsat', Bella Socks / Langsat', 'Socks', 'pcs', 12.00, 0, 8.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = Bella Socks / Langsat'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 8.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = Bella Socks / Langsat';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0038', Bella Socks / Granola', Bella Socks / Granola', 'Socks', 'pcs', 12.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = Bella Socks / Granola'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = Bella Socks / Granola';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0039', Bella Socks / Ash Brown', Bella Socks / Ash Brown', 'Socks', 'pcs', 12.00, 0, 5.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = Bella Socks / Ash Brown'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 5.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = Bella Socks / Ash Brown';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0040', Bella Socks / Cinnamon', Bella Socks / Cinnamon', 'Socks', 'pcs', 12.00, 0, 5.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = Bella Socks / Cinnamon'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 5.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = Bella Socks / Cinnamon';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0041', Bella Socks / Root', Bella Socks / Root', 'Socks', 'pcs', 12.00, 0, 8.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = Bella Socks / Root'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 8.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = Bella Socks / Root';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0042', Bella Socks / Sand', Bella Socks / Sand', 'Socks', 'pcs', 12.00, 0, 8.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = Bella Socks / Sand'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 8.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = Bella Socks / Sand';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0043', Bella Socks / Pearl', Bella Socks / Pearl', 'Socks', 'pcs', 12.00, 0, 5.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = Bella Socks / Pearl'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 5.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = Bella Socks / Pearl';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0044', Bella Socks / Dusty Rose', Bella Socks / Dusty Rose', 'Socks', 'pcs', 12.00, 0, 5.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = Bella Socks / Dusty Rose'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 5.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = Bella Socks / Dusty Rose';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0045', Antislip Socks / Midnight', Antislip Socks / Midnight', 'Socks', 'pcs', 14.00, 0, 5.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = Antislip Socks / Midnight'
  );
  UPDATE public.products SET
    unit_price = 14.00, stock_qty = 5.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = Antislip Socks / Midnight';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0046', Antislip Socks / Cloud', Antislip Socks / Cloud', 'Socks', 'pcs', 14.00, 0, 5.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = Antislip Socks / Cloud'
  );
  UPDATE public.products SET
    unit_price = 14.00, stock_qty = 5.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = Antislip Socks / Cloud';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0047', 'Handsocks Ara / Black / XS', 'Handsocks Ara / Black / XS', 'Handsocks', 'pcs', 10.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Ara / Black / XS'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Ara / Black / XS';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0048', 'Handsocks Ara / Black / S', 'Handsocks Ara / Black / S', 'Handsocks', 'pcs', 10.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Ara / Black / S'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Ara / Black / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0049', 'Handsocks Ara / Black / M', 'Handsocks Ara / Black / M', 'Handsocks', 'pcs', 10.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Ara / Black / M'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Ara / Black / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0050', 'Handsocks Ara / Black / L', 'Handsocks Ara / Black / L', 'Handsocks', 'pcs', 12.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Ara / Black / L'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Ara / Black / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0051', 'Handsocks Ara / Latte / XS', 'Handsocks Ara / Latte / XS', 'Handsocks', 'pcs', 10.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Ara / Latte / XS'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Ara / Latte / XS';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0052', 'Handsocks Ara / Latte / S', 'Handsocks Ara / Latte / S', 'Handsocks', 'pcs', 10.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Ara / Latte / S'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Ara / Latte / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0053', 'Handsocks Ara / Latte / M', 'Handsocks Ara / Latte / M', 'Handsocks', 'pcs', 10.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Ara / Latte / M'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Ara / Latte / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0054', 'Handsocks Ara / Latte / L', 'Handsocks Ara / Latte / L', 'Handsocks', 'pcs', 12.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Ara / Latte / L'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Ara / Latte / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0055', 'Handsocks Ara / Blueblack / XS', 'Handsocks Ara / Blueblack / XS', 'Handsocks', 'pcs', 10.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Ara / Blueblack / XS'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Ara / Blueblack / XS';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0056', 'Handsocks Ara / Blueblack / S', 'Handsocks Ara / Blueblack / S', 'Handsocks', 'pcs', 10.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Ara / Blueblack / S'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Ara / Blueblack / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0057', 'Handsocks Ara / Blueblack / M', 'Handsocks Ara / Blueblack / M', 'Handsocks', 'pcs', 10.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Ara / Blueblack / M'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Ara / Blueblack / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0058', 'Handsocks Ara / Blueblack / L', 'Handsocks Ara / Blueblack / L', 'Handsocks', 'pcs', 12.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Ara / Blueblack / L'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Ara / Blueblack / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0059', 'Handsocks Ara / Light Peanut / XS', 'Handsocks Ara / Light Peanut / XS', 'Handsocks', 'pcs', 10.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Ara / Light Peanut / XS'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Ara / Light Peanut / XS';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0060', 'Handsocks Ara / Light Peanut / S', 'Handsocks Ara / Light Peanut / S', 'Handsocks', 'pcs', 10.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Ara / Light Peanut / S'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Ara / Light Peanut / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0061', 'Handsocks Ara / Light Peanut / M', 'Handsocks Ara / Light Peanut / M', 'Handsocks', 'pcs', 10.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Ara / Light Peanut / M'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Ara / Light Peanut / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0062', 'Handsocks Ara / Light Peanut / L', 'Handsocks Ara / Light Peanut / L', 'Handsocks', 'pcs', 12.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Ara / Light Peanut / L'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Ara / Light Peanut / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0063', 'Handsocks Ara / White / XS', 'Handsocks Ara / White / XS', 'Handsocks', 'pcs', 10.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Ara / White / XS'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Ara / White / XS';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0064', 'Handsocks Ara / White / S', 'Handsocks Ara / White / S', 'Handsocks', 'pcs', 10.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Ara / White / S'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Ara / White / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0065', 'Handsocks Ara / White / M', 'Handsocks Ara / White / M', 'Handsocks', 'pcs', 10.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Ara / White / M'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Ara / White / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0066', 'Handsocks Ara / White / L', 'Handsocks Ara / White / L', 'Handsocks', 'pcs', 12.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Ara / White / L'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Ara / White / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0067', 'Handsocks Ara / Burgundy / XS', 'Handsocks Ara / Burgundy / XS', 'Handsocks', 'pcs', 10.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Ara / Burgundy / XS'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Ara / Burgundy / XS';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0068', 'Handsocks Ara / Burgundy / S', 'Handsocks Ara / Burgundy / S', 'Handsocks', 'pcs', 10.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Ara / Burgundy / S'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Ara / Burgundy / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0069', 'Handsocks Ara / Burgundy / M', 'Handsocks Ara / Burgundy / M', 'Handsocks', 'pcs', 10.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Ara / Burgundy / M'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Ara / Burgundy / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0070', 'Handsocks Ara / Burgundy / L', 'Handsocks Ara / Burgundy / L', 'Handsocks', 'pcs', 12.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Ara / Burgundy / L'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Ara / Burgundy / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0071', 'Handsocks Ara / Maroon / XS', 'Handsocks Ara / Maroon / XS', 'Handsocks', 'pcs', 10.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Ara / Maroon / XS'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Ara / Maroon / XS';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0072', 'Handsocks Ara / Maroon / S', 'Handsocks Ara / Maroon / S', 'Handsocks', 'pcs', 10.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Ara / Maroon / S'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Ara / Maroon / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0073', 'Handsocks Ara / Maroon / M', 'Handsocks Ara / Maroon / M', 'Handsocks', 'pcs', 10.00, 0, 4.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Ara / Maroon / M'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 4.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Ara / Maroon / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0074', 'Handsocks Ara / Maroon / L', 'Handsocks Ara / Maroon / L', 'Handsocks', 'pcs', 12.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Ara / Maroon / L'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Ara / Maroon / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0075', 'Handsocks Ara / Dusty Pink / XS', 'Handsocks Ara / Dusty Pink / XS', 'Handsocks', 'pcs', 10.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Ara / Dusty Pink / XS'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Ara / Dusty Pink / XS';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0076', 'Handsocks Ara / Dusty Pink / S', 'Handsocks Ara / Dusty Pink / S', 'Handsocks', 'pcs', 10.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Ara / Dusty Pink / S'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Ara / Dusty Pink / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0077', 'Handsocks Ara / Dusty Pink / M', 'Handsocks Ara / Dusty Pink / M', 'Handsocks', 'pcs', 10.00, 0, 4.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Ara / Dusty Pink / M'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 4.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Ara / Dusty Pink / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0078', 'Handsocks Ara / Dusty Pink / L', 'Handsocks Ara / Dusty Pink / L', 'Handsocks', 'pcs', 12.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Ara / Dusty Pink / L'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Ara / Dusty Pink / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0079', 'Handsocks Ara / Middle Grey / XS', 'Handsocks Ara / Middle Grey / XS', 'Handsocks', 'pcs', 10.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Ara / Middle Grey / XS'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Ara / Middle Grey / XS';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0080', 'Handsocks Ara / Middle Grey / S', 'Handsocks Ara / Middle Grey / S', 'Handsocks', 'pcs', 10.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Ara / Middle Grey / S'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Ara / Middle Grey / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0081', 'Handsocks Ara / Middle Grey / M', 'Handsocks Ara / Middle Grey / M', 'Handsocks', 'pcs', 10.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Ara / Middle Grey / M'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Ara / Middle Grey / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0082', 'Handsocks Ara / Middle Grey / L', 'Handsocks Ara / Middle Grey / L', 'Handsocks', 'pcs', 12.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Ara / Middle Grey / L'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Ara / Middle Grey / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0083', 'Handsocks Ara / Rich Brown / XS', 'Handsocks Ara / Rich Brown / XS', 'Handsocks', 'pcs', 10.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Ara / Rich Brown / XS'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Ara / Rich Brown / XS';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0084', 'Handsocks Ara / Rich Brown / S', 'Handsocks Ara / Rich Brown / S', 'Handsocks', 'pcs', 10.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Ara / Rich Brown / S'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Ara / Rich Brown / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0085', 'Handsocks Ara / Rich Brown / M', 'Handsocks Ara / Rich Brown / M', 'Handsocks', 'pcs', 10.00, 0, 4.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Ara / Rich Brown / M'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 4.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Ara / Rich Brown / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0086', 'Handsocks Ara / Rich Brown / L', 'Handsocks Ara / Rich Brown / L', 'Handsocks', 'pcs', 12.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Ara / Rich Brown / L'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Ara / Rich Brown / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0087', 'Handsocks Warda / All Black / XS', 'Handsocks Warda / All Black / XS', 'Handsocks', 'pcs', 10.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Warda / All Black / XS'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Warda / All Black / XS';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0088', 'Handsocks Warda / All Black / S', 'Handsocks Warda / All Black / S', 'Handsocks', 'pcs', 10.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Warda / All Black / S'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Warda / All Black / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0089', 'Handsocks Warda / All Black / M', 'Handsocks Warda / All Black / M', 'Handsocks', 'pcs', 10.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Warda / All Black / M'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Warda / All Black / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0090', 'Handsocks Warda / All Black / L', 'Handsocks Warda / All Black / L', 'Handsocks', 'pcs', 12.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Warda / All Black / L'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Warda / All Black / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0091', 'Handsocks Warda / All Nude / XS', 'Handsocks Warda / All Nude / XS', 'Handsocks', 'pcs', 10.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Warda / All Nude / XS'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Warda / All Nude / XS';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0092', 'Handsocks Warda / All Nude / S', 'Handsocks Warda / All Nude / S', 'Handsocks', 'pcs', 10.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Warda / All Nude / S'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Warda / All Nude / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0093', 'Handsocks Warda / All Nude / M', 'Handsocks Warda / All Nude / M', 'Handsocks', 'pcs', 10.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Warda / All Nude / M'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Warda / All Nude / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0094', 'Handsocks Warda / All Nude / L', 'Handsocks Warda / All Nude / L', 'Handsocks', 'pcs', 12.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Warda / All Nude / L'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Warda / All Nude / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0095', 'Handsocks Warda / All Grey / XS', 'Handsocks Warda / All Grey / XS', 'Handsocks', 'pcs', 10.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Warda / All Grey / XS'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Warda / All Grey / XS';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0096', 'Handsocks Warda / All Grey / S', 'Handsocks Warda / All Grey / S', 'Handsocks', 'pcs', 10.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Warda / All Grey / S'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Warda / All Grey / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0097', 'Handsocks Warda / All Grey / M', 'Handsocks Warda / All Grey / M', 'Handsocks', 'pcs', 10.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Warda / All Grey / M'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Warda / All Grey / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0098', 'Handsocks Warda / All Grey / L', 'Handsocks Warda / All Grey / L', 'Handsocks', 'pcs', 12.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Warda / All Grey / L'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Warda / All Grey / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0099', 'Handsocks Warda / All Sandy / XS', 'Handsocks Warda / All Sandy / XS', 'Handsocks', 'pcs', 10.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Warda / All Sandy / XS'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Warda / All Sandy / XS';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0100', 'Handsocks Warda / All Sandy / S', 'Handsocks Warda / All Sandy / S', 'Handsocks', 'pcs', 10.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Warda / All Sandy / S'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Warda / All Sandy / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0101', 'Handsocks Warda / All Sandy / M', 'Handsocks Warda / All Sandy / M', 'Handsocks', 'pcs', 10.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Warda / All Sandy / M'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Warda / All Sandy / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0102', 'Handsocks Warda / All Sandy / L', 'Handsocks Warda / All Sandy / L', 'Handsocks', 'pcs', 12.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Warda / All Sandy / L'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Warda / All Sandy / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0103', 'Handsocks Warda / White / XS', 'Handsocks Warda / White / XS', 'Handsocks', 'pcs', 10.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Warda / White / XS'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Warda / White / XS';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0104', 'Handsocks Warda / White / S', 'Handsocks Warda / White / S', 'Handsocks', 'pcs', 10.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Warda / White / S'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Warda / White / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0105', 'Handsocks Warda / White / M', 'Handsocks Warda / White / M', 'Handsocks', 'pcs', 10.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Warda / White / M'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Warda / White / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0106', 'Handsocks Warda / White / L', 'Handsocks Warda / White / L', 'Handsocks', 'pcs', 12.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Warda / White / L'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Warda / White / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0107', 'Handsocks Warda / Dusty Pink / XS', 'Handsocks Warda / Dusty Pink / XS', 'Handsocks', 'pcs', 10.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Warda / Dusty Pink / XS'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Warda / Dusty Pink / XS';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0108', 'Handsocks Warda / Dusty Pink / S', 'Handsocks Warda / Dusty Pink / S', 'Handsocks', 'pcs', 10.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Warda / Dusty Pink / S'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Warda / Dusty Pink / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0109', 'Handsocks Warda / Dusty Pink / M', 'Handsocks Warda / Dusty Pink / M', 'Handsocks', 'pcs', 10.00, 0, 4.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Warda / Dusty Pink / M'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 4.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Warda / Dusty Pink / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0110', 'Handsocks Warda / Dusty Pink / L', 'Handsocks Warda / Dusty Pink / L', 'Handsocks', 'pcs', 12.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Warda / Dusty Pink / L'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Warda / Dusty Pink / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0111', 'Handsocks Warda / Blueblack / XS', 'Handsocks Warda / Blueblack / XS', 'Handsocks', 'pcs', 10.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Warda / Blueblack / XS'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Warda / Blueblack / XS';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0112', 'Handsocks Warda / Blueblack / S', 'Handsocks Warda / Blueblack / S', 'Handsocks', 'pcs', 10.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Warda / Blueblack / S'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Warda / Blueblack / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0113', 'Handsocks Warda / Blueblack / M', 'Handsocks Warda / Blueblack / M', 'Handsocks', 'pcs', 10.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Warda / Blueblack / M'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Warda / Blueblack / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0114', 'Handsocks Warda / Blueblack / L', 'Handsocks Warda / Blueblack / L', 'Handsocks', 'pcs', 12.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Warda / Blueblack / L'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Warda / Blueblack / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0115', 'Handsocks Warda / Burgundy / XS', 'Handsocks Warda / Burgundy / XS', 'Handsocks', 'pcs', 10.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Warda / Burgundy / XS'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Warda / Burgundy / XS';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0116', 'Handsocks Warda / Burgundy / S', 'Handsocks Warda / Burgundy / S', 'Handsocks', 'pcs', 10.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Warda / Burgundy / S'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Warda / Burgundy / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0117', 'Handsocks Warda / Burgundy / M', 'Handsocks Warda / Burgundy / M', 'Handsocks', 'pcs', 10.00, 0, 4.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Warda / Burgundy / M'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 4.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Warda / Burgundy / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0118', 'Handsocks Warda / Burgundy / L', 'Handsocks Warda / Burgundy / L', 'Handsocks', 'pcs', 12.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Warda / Burgundy / L'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Warda / Burgundy / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0119', 'Handsocks Warda / Baby Blue / XS', 'Handsocks Warda / Baby Blue / XS', 'Handsocks', 'pcs', 10.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Warda / Baby Blue / XS'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Warda / Baby Blue / XS';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0120', 'Handsocks Warda / Baby Blue / S', 'Handsocks Warda / Baby Blue / S', 'Handsocks', 'pcs', 10.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Warda / Baby Blue / S'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Warda / Baby Blue / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0121', 'Handsocks Warda / Baby Blue / M', 'Handsocks Warda / Baby Blue / M', 'Handsocks', 'pcs', 10.00, 0, 4.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Warda / Baby Blue / M'
  );
  UPDATE public.products SET
    unit_price = 10.00, stock_qty = 4.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Warda / Baby Blue / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0122', 'Handsocks Warda / Baby Blue / L', 'Handsocks Warda / Baby Blue / L', 'Handsocks', 'pcs', 12.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Warda / Baby Blue / L'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Warda / Baby Blue / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0123', 'Handsocks Rania / Black / XS', 'Handsocks Rania / Black / XS', 'Handsocks', 'pcs', 23.00, 0, 2.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Rania / Black / XS'
  );
  UPDATE public.products SET
    unit_price = 23.00, stock_qty = 2.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Rania / Black / XS';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0124', 'Handsocks Rania / Black / S', 'Handsocks Rania / Black / S', 'Handsocks', 'pcs', 23.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Rania / Black / S'
  );
  UPDATE public.products SET
    unit_price = 23.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Rania / Black / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0125', 'Handsocks Rania / Black / M', 'Handsocks Rania / Black / M', 'Handsocks', 'pcs', 23.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Rania / Black / M'
  );
  UPDATE public.products SET
    unit_price = 23.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Rania / Black / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0126', 'Handsocks Rania / Black / L', 'Handsocks Rania / Black / L', 'Handsocks', 'pcs', 25.00, 0, 2.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Rania / Black / L'
  );
  UPDATE public.products SET
    unit_price = 25.00, stock_qty = 2.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Rania / Black / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0127', 'Handsocks Rania / Coffee / XS', 'Handsocks Rania / Coffee / XS', 'Handsocks', 'pcs', 23.00, 0, 2.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Rania / Coffee / XS'
  );
  UPDATE public.products SET
    unit_price = 23.00, stock_qty = 2.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Rania / Coffee / XS';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0128', 'Handsocks Rania / Coffee / S', 'Handsocks Rania / Coffee / S', 'Handsocks', 'pcs', 23.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Rania / Coffee / S'
  );
  UPDATE public.products SET
    unit_price = 23.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Rania / Coffee / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0129', 'Handsocks Rania / Coffee / M', 'Handsocks Rania / Coffee / M', 'Handsocks', 'pcs', 23.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Rania / Coffee / M'
  );
  UPDATE public.products SET
    unit_price = 23.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Rania / Coffee / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0130', 'Handsocks Rania / Coffee / L', 'Handsocks Rania / Coffee / L', 'Handsocks', 'pcs', 25.00, 0, 2.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Rania / Coffee / L'
  );
  UPDATE public.products SET
    unit_price = 25.00, stock_qty = 2.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Rania / Coffee / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0131', 'Handsocks Rania / Moss Green / XS', 'Handsocks Rania / Moss Green / XS', 'Handsocks', 'pcs', 23.00, 0, 2.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Rania / Moss Green / XS'
  );
  UPDATE public.products SET
    unit_price = 23.00, stock_qty = 2.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Rania / Moss Green / XS';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0132', 'Handsocks Rania / Moss Green / S', 'Handsocks Rania / Moss Green / S', 'Handsocks', 'pcs', 23.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Rania / Moss Green / S'
  );
  UPDATE public.products SET
    unit_price = 23.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Rania / Moss Green / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0133', 'Handsocks Rania / Moss Green / M', 'Handsocks Rania / Moss Green / M', 'Handsocks', 'pcs', 23.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Rania / Moss Green / M'
  );
  UPDATE public.products SET
    unit_price = 23.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Rania / Moss Green / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0134', 'Handsocks Rania / Moss Green / L', 'Handsocks Rania / Moss Green / L', 'Handsocks', 'pcs', 25.00, 0, 2.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Rania / Moss Green / L'
  );
  UPDATE public.products SET
    unit_price = 25.00, stock_qty = 2.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Rania / Moss Green / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0135', 'Handsocks Rania / Rich Brown / XS', 'Handsocks Rania / Rich Brown / XS', 'Handsocks', 'pcs', 23.00, 0, 2.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Rania / Rich Brown / XS'
  );
  UPDATE public.products SET
    unit_price = 23.00, stock_qty = 2.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Rania / Rich Brown / XS';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0136', 'Handsocks Rania / Rich Brown / S', 'Handsocks Rania / Rich Brown / S', 'Handsocks', 'pcs', 23.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Rania / Rich Brown / S'
  );
  UPDATE public.products SET
    unit_price = 23.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Rania / Rich Brown / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0137', 'Handsocks Rania / Rich Brown / M', 'Handsocks Rania / Rich Brown / M', 'Handsocks', 'pcs', 23.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Rania / Rich Brown / M'
  );
  UPDATE public.products SET
    unit_price = 23.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Rania / Rich Brown / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0138', 'Handsocks Rania / Rich Brown / L', 'Handsocks Rania / Rich Brown / L', 'Handsocks', 'pcs', 25.00, 0, 2.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Rania / Rich Brown / L'
  );
  UPDATE public.products SET
    unit_price = 25.00, stock_qty = 2.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Rania / Rich Brown / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0139', 'Handsocks Rania / Soft Peach / XS', 'Handsocks Rania / Soft Peach / XS', 'Handsocks', 'pcs', 23.00, 0, 2.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Rania / Soft Peach / XS'
  );
  UPDATE public.products SET
    unit_price = 23.00, stock_qty = 2.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Rania / Soft Peach / XS';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0140', 'Handsocks Rania / Soft Peach / S', 'Handsocks Rania / Soft Peach / S', 'Handsocks', 'pcs', 23.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Rania / Soft Peach / S'
  );
  UPDATE public.products SET
    unit_price = 23.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Rania / Soft Peach / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0141', 'Handsocks Rania / Soft Peach / M', 'Handsocks Rania / Soft Peach / M', 'Handsocks', 'pcs', 23.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Rania / Soft Peach / M'
  );
  UPDATE public.products SET
    unit_price = 23.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Rania / Soft Peach / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0142', 'Handsocks Rania / Soft Peach / L', 'Handsocks Rania / Soft Peach / L', 'Handsocks', 'pcs', 25.00, 0, 2.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Rania / Soft Peach / L'
  );
  UPDATE public.products SET
    unit_price = 25.00, stock_qty = 2.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Rania / Soft Peach / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0143', 'Handsocks Airis / Black / S', 'Handsocks Airis / Black / S', 'Handsocks', 'pcs', 25.00, 0, 8.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Airis / Black / S'
  );
  UPDATE public.products SET
    unit_price = 25.00, stock_qty = 8.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Airis / Black / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0144', 'Handsocks Airis / Black / M', 'Handsocks Airis / Black / M', 'Handsocks', 'pcs', 25.00, 0, 8.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Airis / Black / M'
  );
  UPDATE public.products SET
    unit_price = 25.00, stock_qty = 8.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Airis / Black / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0145', 'Handsocks Airis / Black / L', 'Handsocks Airis / Black / L', 'Handsocks', 'pcs', 27.00, 0, 4.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Airis / Black / L'
  );
  UPDATE public.products SET
    unit_price = 27.00, stock_qty = 4.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Airis / Black / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0146', 'Handsocks Airis / Moss Green / S', 'Handsocks Airis / Moss Green / S', 'Handsocks', 'pcs', 25.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Airis / Moss Green / S'
  );
  UPDATE public.products SET
    unit_price = 25.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Airis / Moss Green / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0147', 'Handsocks Airis / Moss Green / M', 'Handsocks Airis / Moss Green / M', 'Handsocks', 'pcs', 25.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Airis / Moss Green / M'
  );
  UPDATE public.products SET
    unit_price = 25.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Airis / Moss Green / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0148', 'Handsocks Airis / Moss Green / L', 'Handsocks Airis / Moss Green / L', 'Handsocks', 'pcs', 27.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Airis / Moss Green / L'
  );
  UPDATE public.products SET
    unit_price = 27.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Airis / Moss Green / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0149', 'Handsocks Airis / Light Peanut / S', 'Handsocks Airis / Light Peanut / S', 'Handsocks', 'pcs', 25.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Airis / Light Peanut / S'
  );
  UPDATE public.products SET
    unit_price = 25.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Airis / Light Peanut / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0150', 'Handsocks Airis / Light Peanut / M', 'Handsocks Airis / Light Peanut / M', 'Handsocks', 'pcs', 25.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Airis / Light Peanut / M'
  );
  UPDATE public.products SET
    unit_price = 25.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Airis / Light Peanut / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0151', 'Handsocks Airis / Light Peanut / L', 'Handsocks Airis / Light Peanut / L', 'Handsocks', 'pcs', 27.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Airis / Light Peanut / L'
  );
  UPDATE public.products SET
    unit_price = 27.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Airis / Light Peanut / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0152', 'Handsocks Airis / Nude Beige / S', 'Handsocks Airis / Nude Beige / S', 'Handsocks', 'pcs', 25.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Airis / Nude Beige / S'
  );
  UPDATE public.products SET
    unit_price = 25.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Airis / Nude Beige / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0153', 'Handsocks Airis / Nude Beige / M', 'Handsocks Airis / Nude Beige / M', 'Handsocks', 'pcs', 25.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Airis / Nude Beige / M'
  );
  UPDATE public.products SET
    unit_price = 25.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Airis / Nude Beige / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0154', 'Handsocks Airis / Nude Beige / L', 'Handsocks Airis / Nude Beige / L', 'Handsocks', 'pcs', 27.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Airis / Nude Beige / L'
  );
  UPDATE public.products SET
    unit_price = 27.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Airis / Nude Beige / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0155', 'Handsocks Airis / Rich Brown / S', 'Handsocks Airis / Rich Brown / S', 'Handsocks', 'pcs', 25.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Airis / Rich Brown / S'
  );
  UPDATE public.products SET
    unit_price = 25.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Airis / Rich Brown / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0156', 'Handsocks Airis / Rich Brown / M', 'Handsocks Airis / Rich Brown / M', 'Handsocks', 'pcs', 25.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Airis / Rich Brown / M'
  );
  UPDATE public.products SET
    unit_price = 25.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Airis / Rich Brown / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0157', 'Handsocks Airis / Rich Brown / L', 'Handsocks Airis / Rich Brown / L', 'Handsocks', 'pcs', 27.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Airis / Rich Brown / L'
  );
  UPDATE public.products SET
    unit_price = 27.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Airis / Rich Brown / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0158', 'Handsocks Airis / Dusty Pink / S', 'Handsocks Airis / Dusty Pink / S', 'Handsocks', 'pcs', 25.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Airis / Dusty Pink / S'
  );
  UPDATE public.products SET
    unit_price = 25.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Airis / Dusty Pink / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0159', 'Handsocks Airis / Dusty Pink / M', 'Handsocks Airis / Dusty Pink / M', 'Handsocks', 'pcs', 25.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Airis / Dusty Pink / M'
  );
  UPDATE public.products SET
    unit_price = 25.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Airis / Dusty Pink / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0160', 'Handsocks Airis / Dusty Pink / L', 'Handsocks Airis / Dusty Pink / L', 'Handsocks', 'pcs', 27.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Airis / Dusty Pink / L'
  );
  UPDATE public.products SET
    unit_price = 27.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Airis / Dusty Pink / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0161', 'Handsocks Airis / Blueblack / S', 'Handsocks Airis / Blueblack / S', 'Handsocks', 'pcs', 25.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Airis / Blueblack / S'
  );
  UPDATE public.products SET
    unit_price = 25.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Airis / Blueblack / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0162', 'Handsocks Airis / Blueblack / M', 'Handsocks Airis / Blueblack / M', 'Handsocks', 'pcs', 25.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Airis / Blueblack / M'
  );
  UPDATE public.products SET
    unit_price = 25.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Airis / Blueblack / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0163', 'Handsocks Airis / Blueblack / L', 'Handsocks Airis / Blueblack / L', 'Handsocks', 'pcs', 27.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Airis / Blueblack / L'
  );
  UPDATE public.products SET
    unit_price = 27.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Airis / Blueblack / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0164', 'Handsocks Airis / Burgundy / S', 'Handsocks Airis / Burgundy / S', 'Handsocks', 'pcs', 25.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Airis / Burgundy / S'
  );
  UPDATE public.products SET
    unit_price = 25.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Airis / Burgundy / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0165', 'Handsocks Airis / Burgundy / M', 'Handsocks Airis / Burgundy / M', 'Handsocks', 'pcs', 25.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Airis / Burgundy / M'
  );
  UPDATE public.products SET
    unit_price = 25.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Airis / Burgundy / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0166', 'Handsocks Airis / Burgundy / L', 'Handsocks Airis / Burgundy / L', 'Handsocks', 'pcs', 27.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Airis / Burgundy / L'
  );
  UPDATE public.products SET
    unit_price = 27.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Airis / Burgundy / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0167', 'Handsocks Airis / White / S', 'Handsocks Airis / White / S', 'Handsocks', 'pcs', 25.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Airis / White / S'
  );
  UPDATE public.products SET
    unit_price = 25.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Airis / White / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0168', 'Handsocks Airis / White / M', 'Handsocks Airis / White / M', 'Handsocks', 'pcs', 25.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Airis / White / M'
  );
  UPDATE public.products SET
    unit_price = 25.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Airis / White / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0169', 'Handsocks Airis / White / L', 'Handsocks Airis / White / L', 'Handsocks', 'pcs', 27.00, 0, 1.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Airis / White / L'
  );
  UPDATE public.products SET
    unit_price = 27.00, stock_qty = 1.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Airis / White / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0170', 'Handsocks Airis / Coffee / S', 'Handsocks Airis / Coffee / S', 'Handsocks', 'pcs', 25.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Airis / Coffee / S'
  );
  UPDATE public.products SET
    unit_price = 25.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Airis / Coffee / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0171', 'Handsocks Airis / Coffee / M', 'Handsocks Airis / Coffee / M', 'Handsocks', 'pcs', 25.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Airis / Coffee / M'
  );
  UPDATE public.products SET
    unit_price = 25.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Airis / Coffee / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0172', 'Handsocks Airis / Coffee / L', 'Handsocks Airis / Coffee / L', 'Handsocks', 'pcs', 27.00, 0, 1.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Airis / Coffee / L'
  );
  UPDATE public.products SET
    unit_price = 27.00, stock_qty = 1.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Airis / Coffee / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0173', 'Handsocks Deeja / Black / XS', 'Handsocks Deeja / Black / XS', 'Handsocks', 'pcs', 12.00, 0, 9.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / Black / XS'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 9.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / Black / XS';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0174', 'Handsocks Deeja / Black / S', 'Handsocks Deeja / Black / S', 'Handsocks', 'pcs', 12.00, 0, 15.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / Black / S'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 15.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / Black / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0175', 'Handsocks Deeja / Black / M', 'Handsocks Deeja / Black / M', 'Handsocks', 'pcs', 12.00, 0, 15.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / Black / M'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 15.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / Black / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0176', 'Handsocks Deeja / Black / L', 'Handsocks Deeja / Black / L', 'Handsocks', 'pcs', 14.00, 0, 8.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / Black / L'
  );
  UPDATE public.products SET
    unit_price = 14.00, stock_qty = 8.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / Black / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0177', 'Handsocks Deeja / Nude Beige / XS', 'Handsocks Deeja / Nude Beige / XS', 'Handsocks', 'pcs', 12.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / Nude Beige / XS'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / Nude Beige / XS';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0178', 'Handsocks Deeja / Nude Beige / S', 'Handsocks Deeja / Nude Beige / S', 'Handsocks', 'pcs', 12.00, 0, 15.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / Nude Beige / S'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 15.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / Nude Beige / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0179', 'Handsocks Deeja / Nude Beige / M', 'Handsocks Deeja / Nude Beige / M', 'Handsocks', 'pcs', 12.00, 0, 15.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / Nude Beige / M'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 15.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / Nude Beige / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0180', 'Handsocks Deeja / Nude Beige / L', 'Handsocks Deeja / Nude Beige / L', 'Handsocks', 'pcs', 14.00, 0, 5.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / Nude Beige / L'
  );
  UPDATE public.products SET
    unit_price = 14.00, stock_qty = 5.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / Nude Beige / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0181', 'Handsocks Deeja / Champagne / XS', 'Handsocks Deeja / Champagne / XS', 'Handsocks', 'pcs', 12.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / Champagne / XS'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / Champagne / XS';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0182', 'Handsocks Deeja / Champagne / S', 'Handsocks Deeja / Champagne / S', 'Handsocks', 'pcs', 12.00, 0, 15.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / Champagne / S'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 15.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / Champagne / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0183', 'Handsocks Deeja / Champagne / M', 'Handsocks Deeja / Champagne / M', 'Handsocks', 'pcs', 12.00, 0, 15.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / Champagne / M'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 15.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / Champagne / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0184', 'Handsocks Deeja / Champagne / L', 'Handsocks Deeja / Champagne / L', 'Handsocks', 'pcs', 14.00, 0, 5.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / Champagne / L'
  );
  UPDATE public.products SET
    unit_price = 14.00, stock_qty = 5.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / Champagne / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0185', 'Handsocks Deeja / Burgundy / XS', 'Handsocks Deeja / Burgundy / XS', 'Handsocks', 'pcs', 12.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / Burgundy / XS'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / Burgundy / XS';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0186', 'Handsocks Deeja / Burgundy / S', 'Handsocks Deeja / Burgundy / S', 'Handsocks', 'pcs', 12.00, 0, 13.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / Burgundy / S'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 13.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / Burgundy / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0187', 'Handsocks Deeja / Burgundy / M', 'Handsocks Deeja / Burgundy / M', 'Handsocks', 'pcs', 12.00, 0, 11.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / Burgundy / M'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 11.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / Burgundy / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0188', 'Handsocks Deeja / Burgundy / L', 'Handsocks Deeja / Burgundy / L', 'Handsocks', 'pcs', 14.00, 0, 8.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / Burgundy / L'
  );
  UPDATE public.products SET
    unit_price = 14.00, stock_qty = 8.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / Burgundy / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0189', 'Handsocks Deeja / White / XS', 'Handsocks Deeja / White / XS', 'Handsocks', 'pcs', 12.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / White / XS'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / White / XS';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0190', 'Handsocks Deeja / White / S', 'Handsocks Deeja / White / S', 'Handsocks', 'pcs', 12.00, 0, 13.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / White / S'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 13.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / White / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0191', 'Handsocks Deeja / White / M', 'Handsocks Deeja / White / M', 'Handsocks', 'pcs', 12.00, 0, 13.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / White / M'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 13.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / White / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0192', 'Handsocks Deeja / White / L', 'Handsocks Deeja / White / L', 'Handsocks', 'pcs', 14.00, 0, 8.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / White / L'
  );
  UPDATE public.products SET
    unit_price = 14.00, stock_qty = 8.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / White / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0193', 'Handsocks Deeja / Dusty Milo / XS', 'Handsocks Deeja / Dusty Milo / XS', 'Handsocks', 'pcs', 12.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / Dusty Milo / XS'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / Dusty Milo / XS';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0194', 'Handsocks Deeja / Dusty Milo / S', 'Handsocks Deeja / Dusty Milo / S', 'Handsocks', 'pcs', 12.00, 0, 12.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / Dusty Milo / S'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 12.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / Dusty Milo / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0195', 'Handsocks Deeja / Dusty Milo / M', 'Handsocks Deeja / Dusty Milo / M', 'Handsocks', 'pcs', 12.00, 0, 12.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / Dusty Milo / M'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 12.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / Dusty Milo / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0196', 'Handsocks Deeja / Dusty Milo / L', 'Handsocks Deeja / Dusty Milo / L', 'Handsocks', 'pcs', 14.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / Dusty Milo / L'
  );
  UPDATE public.products SET
    unit_price = 14.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / Dusty Milo / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0197', 'Handsocks Deeja / Moss Green / XS', 'Handsocks Deeja / Moss Green / XS', 'Handsocks', 'pcs', 12.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / Moss Green / XS'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / Moss Green / XS';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0198', 'Handsocks Deeja / Moss Green / S', 'Handsocks Deeja / Moss Green / S', 'Handsocks', 'pcs', 12.00, 0, 13.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / Moss Green / S'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 13.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / Moss Green / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0199', 'Handsocks Deeja / Moss Green / M', 'Handsocks Deeja / Moss Green / M', 'Handsocks', 'pcs', 12.00, 0, 11.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / Moss Green / M'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 11.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / Moss Green / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0200', 'Handsocks Deeja / Moss Green / L', 'Handsocks Deeja / Moss Green / L', 'Handsocks', 'pcs', 14.00, 0, 8.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / Moss Green / L'
  );
  UPDATE public.products SET
    unit_price = 14.00, stock_qty = 8.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / Moss Green / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0201', 'Handsocks Deeja / Light Peanut / XS', 'Handsocks Deeja / Light Peanut / XS', 'Handsocks', 'pcs', 12.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / Light Peanut / XS'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / Light Peanut / XS';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0202', 'Handsocks Deeja / Light Peanut / S', 'Handsocks Deeja / Light Peanut / S', 'Handsocks', 'pcs', 12.00, 0, 15.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / Light Peanut / S'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 15.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / Light Peanut / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0203', 'Handsocks Deeja / Light Peanut / M', 'Handsocks Deeja / Light Peanut / M', 'Handsocks', 'pcs', 12.00, 0, 15.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / Light Peanut / M'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 15.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / Light Peanut / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0204', 'Handsocks Deeja / Light Peanut / L', 'Handsocks Deeja / Light Peanut / L', 'Handsocks', 'pcs', 14.00, 0, 8.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / Light Peanut / L'
  );
  UPDATE public.products SET
    unit_price = 14.00, stock_qty = 8.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / Light Peanut / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0205', 'Handsocks Deeja / Blueblack / XS', 'Handsocks Deeja / Blueblack / XS', 'Handsocks', 'pcs', 12.00, 0, 6.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / Blueblack / XS'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 6.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / Blueblack / XS';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0206', 'Handsocks Deeja / Blueblack / S', 'Handsocks Deeja / Blueblack / S', 'Handsocks', 'pcs', 12.00, 0, 15.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / Blueblack / S'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 15.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / Blueblack / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0207', 'Handsocks Deeja / Blueblack / M', 'Handsocks Deeja / Blueblack / M', 'Handsocks', 'pcs', 12.00, 0, 15.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / Blueblack / M'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 15.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / Blueblack / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0208', 'Handsocks Deeja / Blueblack / L', 'Handsocks Deeja / Blueblack / L', 'Handsocks', 'pcs', 14.00, 0, 8.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / Blueblack / L'
  );
  UPDATE public.products SET
    unit_price = 14.00, stock_qty = 8.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / Blueblack / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0209', 'Handsocks Deeja / Dusty Pink / XS', 'Handsocks Deeja / Dusty Pink / XS', 'Handsocks', 'pcs', 12.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / Dusty Pink / XS'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / Dusty Pink / XS';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0210', 'Handsocks Deeja / Dusty Pink / S', 'Handsocks Deeja / Dusty Pink / S', 'Handsocks', 'pcs', 12.00, 0, 4.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / Dusty Pink / S'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 4.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / Dusty Pink / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0211', 'Handsocks Deeja / Dusty Pink / M', 'Handsocks Deeja / Dusty Pink / M', 'Handsocks', 'pcs', 12.00, 0, 4.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / Dusty Pink / M'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 4.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / Dusty Pink / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0212', 'Handsocks Deeja / Dusty Pink / L', 'Handsocks Deeja / Dusty Pink / L', 'Handsocks', 'pcs', 14.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / Dusty Pink / L'
  );
  UPDATE public.products SET
    unit_price = 14.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / Dusty Pink / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0213', 'Handsocks Deeja / Maroon / XS', 'Handsocks Deeja / Maroon / XS', 'Handsocks', 'pcs', 12.00, 0, 0.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / Maroon / XS'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 0.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / Maroon / XS';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0214', 'Handsocks Deeja / Maroon / S', 'Handsocks Deeja / Maroon / S', 'Handsocks', 'pcs', 12.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / Maroon / S'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / Maroon / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0215', 'Handsocks Deeja / Maroon / M', 'Handsocks Deeja / Maroon / M', 'Handsocks', 'pcs', 12.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / Maroon / M'
  );
  UPDATE public.products SET
    unit_price = 12.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / Maroon / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0216', 'Handsocks Deeja / Maroon / L', 'Handsocks Deeja / Maroon / L', 'Handsocks', 'pcs', 14.00, 0, 2.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Deeja / Maroon / L'
  );
  UPDATE public.products SET
    unit_price = 14.00, stock_qty = 2.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Deeja / Maroon / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0217', 'Handsocks Sofea / Black / XS', 'Handsocks Sofea / Black / XS', 'Handsocks', 'pcs', 55.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Sofea / Black / XS'
  );
  UPDATE public.products SET
    unit_price = 55.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Sofea / Black / XS';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0218', 'Handsocks Sofea / Black / S', 'Handsocks Sofea / Black / S', 'Handsocks', 'pcs', 55.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Sofea / Black / S'
  );
  UPDATE public.products SET
    unit_price = 55.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Sofea / Black / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0219', 'Handsocks Sofea / Black / M', 'Handsocks Sofea / Black / M', 'Handsocks', 'pcs', 55.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Sofea / Black / M'
  );
  UPDATE public.products SET
    unit_price = 55.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Sofea / Black / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0220', 'Handsocks Sofea / Black / L', 'Handsocks Sofea / Black / L', 'Handsocks', 'pcs', 55.00, 0, 2.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Sofea / Black / L'
  );
  UPDATE public.products SET
    unit_price = 55.00, stock_qty = 2.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Sofea / Black / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0221', 'Handsocks Sofea / Latte / XS', 'Handsocks Sofea / Latte / XS', 'Handsocks', 'pcs', 55.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Sofea / Latte / XS'
  );
  UPDATE public.products SET
    unit_price = 55.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Sofea / Latte / XS';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0222', 'Handsocks Sofea / Latte / S', 'Handsocks Sofea / Latte / S', 'Handsocks', 'pcs', 55.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Sofea / Latte / S'
  );
  UPDATE public.products SET
    unit_price = 55.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Sofea / Latte / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0223', 'Handsocks Sofea / Latte / M', 'Handsocks Sofea / Latte / M', 'Handsocks', 'pcs', 55.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Sofea / Latte / M'
  );
  UPDATE public.products SET
    unit_price = 55.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Sofea / Latte / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0224', 'Handsocks Sofea / Latte / L', 'Handsocks Sofea / Latte / L', 'Handsocks', 'pcs', 55.00, 0, 2.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Sofea / Latte / L'
  );
  UPDATE public.products SET
    unit_price = 55.00, stock_qty = 2.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Sofea / Latte / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0225', 'Handsocks Sofea / Nude Beige / XS', 'Handsocks Sofea / Nude Beige / XS', 'Handsocks', 'pcs', 55.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Sofea / Nude Beige / XS'
  );
  UPDATE public.products SET
    unit_price = 55.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Sofea / Nude Beige / XS';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0226', 'Handsocks Sofea / Nude Beige / S', 'Handsocks Sofea / Nude Beige / S', 'Handsocks', 'pcs', 55.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Sofea / Nude Beige / S'
  );
  UPDATE public.products SET
    unit_price = 55.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Sofea / Nude Beige / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0227', 'Handsocks Sofea / Nude Beige / M', 'Handsocks Sofea / Nude Beige / M', 'Handsocks', 'pcs', 55.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Sofea / Nude Beige / M'
  );
  UPDATE public.products SET
    unit_price = 55.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Sofea / Nude Beige / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0228', 'Handsocks Sofea / Nude Beige / L', 'Handsocks Sofea / Nude Beige / L', 'Handsocks', 'pcs', 55.00, 0, 2.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Sofea / Nude Beige / L'
  );
  UPDATE public.products SET
    unit_price = 55.00, stock_qty = 2.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Sofea / Nude Beige / L';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0229', 'Handsocks Sofea / Burgundy / XS', 'Handsocks Sofea / Burgundy / XS', 'Handsocks', 'pcs', 55.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Sofea / Burgundy / XS'
  );
  UPDATE public.products SET
    unit_price = 55.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Sofea / Burgundy / XS';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0230', 'Handsocks Sofea / Burgundy / S', 'Handsocks Sofea / Burgundy / S', 'Handsocks', 'pcs', 55.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Sofea / Burgundy / S'
  );
  UPDATE public.products SET
    unit_price = 55.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Sofea / Burgundy / S';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0231', 'Handsocks Sofea / Burgundy / M', 'Handsocks Sofea / Burgundy / M', 'Handsocks', 'pcs', 55.00, 0, 3.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Sofea / Burgundy / M'
  );
  UPDATE public.products SET
    unit_price = 55.00, stock_qty = 3.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Sofea / Burgundy / M';
  INSERT INTO public.products (tenant_id, code, name_en, name_bm, category, unit, unit_price, unit_cost, stock_qty, reorder_point)
  SELECT tn, 'NBE-0232', 'Handsocks Sofea / Burgundy / L', 'Handsocks Sofea / Burgundy / L', 'Handsocks', 'pcs', 55.00, 0, 2.000, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.tenant_id = tn AND p.deleted_at IS NULL AND p.name_en = 'Handsocks Sofea / Burgundy / L'
  );
  UPDATE public.products SET
    unit_price = 55.00, stock_qty = 2.000, category = 'Socks', unit = 'pcs', updated_at = now()
  WHERE tenant_id = tn AND deleted_at IS NULL AND name_en = 'Handsocks Sofea / Burgundy / L';
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'Nurbella products touched. Last update row count %', n;
END
$body$;
