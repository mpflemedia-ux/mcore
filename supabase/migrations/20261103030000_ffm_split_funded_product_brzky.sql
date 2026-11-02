-- FFM: split Hair Moisturizer into 2 separate products per FFM account — Brzky Empire
-- (c60f2b79-7132-48ed-b35d-72b0dfd9a973). Supersedes 20261103020000_ffm_funded_stock_merge_brzky.sql
-- (do NOT run that one — owner decided against merging into one combined stock_qty).
--
-- Owner decision: Brzky-account stock (860 pcs, barcode 9555277201519) and Funded-account
-- stock (1,080 pcs, barcode 9555277201526) are two distinct SKUs, not one merged product.
--   - KV-HC-150-B = existing product (bb2d0ce8-03ed-4664-9845-fc726ffca0b1), renamed from
--     KRV-HM-003, keeps its 860 pcs and its Brzky FFM link unchanged.
--   - KV-HC-150-F = new product, opening stock 1,080 pcs (DO-12784, ETHYE SDN BHD,
--     29.10.2026, 45 ctn x 24 pcs), same unit cost (RM8.30) and sell price (RM55.00) as
--     the original. Codes match FFM's own Product Files product numbers for these SKUs.
-- The Funded account's existing ffm_product_links/ffm_stock rows are repointed from the
-- old product to the new one (not duplicated) so Stock/Reconciliation attribute them
-- correctly from the next sync onward.
--
-- Idempotent — write-only, run in Supabase SQL Editor.

do $$
declare
  v_tenant_id uuid := 'c60f2b79-7132-48ed-b35d-72b0dfd9a973';
  v_old_id uuid := 'bb2d0ce8-03ed-4664-9845-fc726ffca0b1'; -- Hair Moisturizer / Brzky
  v_new_id uuid;
  v_wh uuid;
  v_funded_link_id uuid := '4a1b1417-a4e3-492b-9593-f209ddbac620';
  v_funded_stock_id uuid := '1a0386eb-3433-4b89-8627-c75f9f9d2c3b';
  v_new_cur numeric;
begin
  -- 1) rename the existing (Brzky) product's code
  update products set code = 'KV-HC-150-B', updated_at = now()
  where id = v_old_id and tenant_id = v_tenant_id and code <> 'KV-HC-150-B';

  -- 2) create the Funded product if it doesn't exist yet
  select id into v_new_id from products where tenant_id = v_tenant_id and code = 'KV-HC-150-F' and deleted_at is null;
  if v_new_id is null then
    insert into products (tenant_id, code, name_en, name_bm, unit, category, unit_cost, unit_price, reorder_point, stock_qty)
    values (v_tenant_id, 'KV-HC-150-F', 'Hair Moisturizer', 'Pelembap Rambut', 'Pcs', 'Haircare', 8.30, 55.00, 5, 0)
    returning id into v_new_id;
  end if;

  -- 3) opening stock for the new product, traceable via stock_movements (only if not already set)
  select stock_qty into v_new_cur from products where id = v_new_id;
  if v_new_cur < 1080 then
    select id into v_wh from warehouses where tenant_id = v_tenant_id and is_default = true and deleted_at is null limit 1;
    insert into stock_movements (tenant_id, product_id, warehouse_id, movement_type, ref_type, ref_no,
      qty_in, qty_out, qty_balance, notes, created_at)
    values (v_tenant_id, v_new_id, v_wh, 'in', 'opening_balance', 'DO-12784',
      1080 - v_new_cur, 0, 1080,
      'Funded-account inbound (ETHYE SDN BHD, DO-12784, 29.10.2026, 45 ctn x 24 pcs = 1,080 pcs) set up as its own product (KV-HC-150-F) per owner decision to keep Brzky (KV-HC-150-B) and Funded stock as separate SKUs rather than merged into one.',
      now());
    update products set stock_qty = 1080, updated_at = now() where id = v_new_id;
  end if;

  -- 4) move the Funded account's FFM link + cached stock row from the old product to the new one
  update ffm_product_links set product_id = v_new_id where id = v_funded_link_id and product_id = v_old_id;
  update ffm_stock set product_id = v_new_id where id = v_funded_stock_id and product_id = v_old_id;

  raise notice 'Done. Brzky product=% (code KV-HC-150-B, 860 pcs), Funded product=% (code KV-HC-150-F, 1080 pcs)', v_old_id, v_new_id;
end $$;

-- ---------- dev roadmap ----------
do $$
declare
  pr text := 'https://github.com/mpflemedia-ux/mcore/commits/main';
begin
  insert into public.dev_roadmap_items (title, description, module, stage, pr_url)
  select v.title, v.descr, 'logistics', 'completed', pr
  from (values
    ('FFM: split Brzky/Funded Hair Moisturizer into 2 products',
     'Owner decided Brzky-account (860 pcs, KV-HC-150-B) and Funded-account (1,080 pcs, KV-HC-150-F) stock should be two separate M-Core SKUs instead of one merged product (supersedes the earlier merge-to-1,940 migration, which was not run). Renamed the existing product''s code, created the new Funded product with a proper traceable stock_movements opening entry (ref DO-12784), and repointed the Funded account''s existing ffm_product_links/ffm_stock rows to the new product so Stock/Reconciliation attribute each SKU correctly.')
  ) as v(title, descr)
  where not exists (select 1 from public.dev_roadmap_items d where d.title = v.title);

  update public.dev_roadmap_items set stage = 'completed', pr_url = pr
  where title = 'FFM: split Brzky/Funded Hair Moisturizer into 2 products';
exception when undefined_column or undefined_table then
  raise notice 'dev_roadmap schema variant; skip: %', sqlerrm;
end $$;
