-- FFM Funded stock merge — Brzky Empire (c60f2b79-7132-48ed-b35d-72b0dfd9a973),
-- Hair Moisturizer (KRV-HM-003, bb2d0ce8-03ed-4664-9845-fc726ffca0b1), 03/11/2026.
--
-- Owner confirmed: M-Core's own stock_qty should equal the COMBINED FFM total across
-- both connected accounts (Brzky 860 + Funded 1,080 = 1,940), i.e. this stock stays
-- inside M-Core's regular inventory — not tracked separately via Sales Plan financing.
-- This migration only adds the missing Funded-account inbound (DO-12784, ETHYE SDN BHD,
-- 29.10.2026: 45 ctn x 24 pcs = 1,080 pcs) as a proper stock_movements row and brings
-- stock_qty up to 1,940. It does NOT touch Sales Plan (no batch/journal created) —
-- that is a separate decision the owner is still confirming with the financing side.
--
-- Idempotent (guarded by current stock_qty) — write-only, run in Supabase SQL Editor.

do $$
declare
  v_tenant_id uuid := 'c60f2b79-7132-48ed-b35d-72b0dfd9a973';
  v_product_id uuid := 'bb2d0ce8-03ed-4664-9845-fc726ffca0b1';
  v_cur numeric;
  v_add numeric := 1080; -- DO-12784: 45 ctn x 24 pcs, Funded-account inbound
  v_wh uuid;
begin
  select stock_qty into v_cur from products where id = v_product_id and tenant_id = v_tenant_id and deleted_at is null;
  if v_cur is null then
    raise notice 'Product not found — skipping (id=%, tenant=%)', v_product_id, v_tenant_id;
    return;
  end if;
  if v_cur >= 1940 then
    raise notice 'stock_qty already % (>= 1940) — nothing to do', v_cur;
    return;
  end if;

  select id into v_wh from warehouses where tenant_id = v_tenant_id and is_default = true and deleted_at is null limit 1;

  insert into stock_movements (tenant_id, product_id, warehouse_id, movement_type, ref_type, ref_no,
    qty_in, qty_out, qty_balance, notes, created_at)
  values (v_tenant_id, v_product_id, v_wh, 'in', 'opening_balance', 'DO-12784',
    v_add, 0, v_cur + v_add,
    'Funded-account inbound (ETHYE SDN BHD, DO-12784, 29.10.2026, 45 ctn x 24 pcs = 1,080 pcs) merged into M-Core stock per owner confirmation. Combined FFM total (Brzky 860 + Funded 1,080 = 1,940) now matches M-Core stock_qty. See migration 20261102010000_ffm_recon_audit_brzky.sql for the earlier Brzky-side correction (2,400 -> 860).',
    now());

  update products set stock_qty = v_cur + v_add, updated_at = now()
  where id = v_product_id and tenant_id = v_tenant_id and stock_qty = v_cur;

  raise notice 'KRV-HM-003 stock_qty merged % -> %', v_cur, v_cur + v_add;
end $$;

-- ---------- dev roadmap ----------
do $$
declare
  pr text := 'https://github.com/mpflemedia-ux/mcore/commits/main';
begin
  insert into public.dev_roadmap_items (title, description, module, stage, pr_url)
  select v.title, v.descr, 'logistics', 'completed', pr
  from (values
    ('FFM Funded stock merged into M-Core book (Brzky/KRV-HM-003)',
     'Owner confirmed the Funded-account inbound (DO-12784, 1,080 pcs) stays inside M-Core''s regular inventory, not tracked separately via Sales Plan financing. Added a proper stock_movements row (ref DO-12784) and brought stock_qty from 860 to 1,940, matching the combined FFM total across both connected accounts (Brzky + Funded). No Sales Plan batch/journal created by this change.'),
    ('Removed duplicate test product (KRVKL001) and its FFM links',
     'Confirmed with owner that only one real product exists (Hair Moisturizer, KRV-HM-003) — "Keravive Keratin Lock After Care" (KRVKL001) was a duplicate/test product created with a placeholder FFM barcode that did not match any real FFM-registered barcode. Owner cancelled the open PO referencing it (PO-0002) and soft-deleted the product via the app; this migration''s sibling cleanup soft-deleted its orphaned ffm_product_links and ffm_stock rows so Reconciliation/Stock no longer reference it.')
  ) as v(title, descr)
  where not exists (select 1 from public.dev_roadmap_items d where d.title = v.title);

  update public.dev_roadmap_items set stage = 'completed', pr_url = pr
  where title in (
    'FFM Funded stock merged into M-Core book (Brzky/KRV-HM-003)',
    'Removed duplicate test product (KRVKL001) and its FFM links'
  );
exception when undefined_column or undefined_table then
  raise notice 'dev_roadmap schema variant; skip: %', sqlerrm;
end $$;
