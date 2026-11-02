-- FFM reconciliation audit — Brzky Empire (c60f2b79-7132-48ed-b35d-72b0dfd9a973),
-- product KRV-HM-003 (Hair Moisturizer, bb2d0ce8-03ed-4664-9845-fc726ffca0b1), 02/11/2026.
--
-- TASK A FINDING: products.stock_qty = 2400 has ZERO matching rows in stock_movements
-- (confirmed by direct query). products.created_at and updated_at are ~0.06s apart,
-- i.e. stock_qty has never changed since the row was INSERTed — it was typed directly
-- into the "Stock Qty" field on the Add Product form (_prodSave() in app/index.html
-- writes stock_qty straight onto the products row; it never writes a matching
-- stock_movements row, unlike the rest of the app, which already has a recognised
-- movement_type='in', ref_type='opening_balance' convention for exactly this case —
-- that convention exists elsewhere but Add Product does not use it). This is a real,
-- separate gap (every product's opening stock is currently untraceable), but it is
-- OUT OF SCOPE for this fix: it is tenant-wide, touches every product (not just FFM
-- ones), and needs its own sign-off — flagging it here, not changing _prodSave().
--
-- PO-0001 (qty 2400, status 'sent', created 2026-10-17 19:36 — 13 min AFTER the
-- product's stock_qty was already 2400 at 19:23) is coincidental, not causal: it has
-- no goods_received_items/GRN, so it never touched stock_movements either. If this PO
-- is a real pending order, receive it properly via GRN when it arrives; it is not the
-- source of today's 2,400 and this migration does not touch it.
--
-- CORRECTION: the only verified source of truth right now is the connected, synced FFM
-- account "Brzky" (ffm_stock.total_qty = 860, synced_at today). "Brozkey" (1,080 pcs,
-- barcode 9555277201526) is NOT a configured ffm_accounts row for this or any tenant —
-- it cannot be included in a data correction until it is actually connected (see TASK C
-- note below); until then, 860 is the only number this system can verify.
--
-- Write-only — review the numbers, then run in Supabase SQL Editor. Idempotent (guarded
-- by current stock_qty value so re-running after the correction is a no-op).

do $$
declare
  v_tenant_id uuid := 'c60f2b79-7132-48ed-b35d-72b0dfd9a973';
  v_product_id uuid := 'bb2d0ce8-03ed-4664-9845-fc726ffca0b1';
  v_cur numeric;
  v_target numeric := 860; -- verified FFM "Brzky" total_qty as of this audit
  v_wh uuid;
begin
  select stock_qty into v_cur from products where id = v_product_id and tenant_id = v_tenant_id;
  if v_cur is null then
    raise notice 'Product not found — skipping (id=%, tenant=%)', v_product_id, v_tenant_id;
    return;
  end if;
  if v_cur = v_target then
    raise notice 'stock_qty already % — nothing to do', v_target;
    return;
  end if;

  select id into v_wh from warehouses where tenant_id = v_tenant_id and is_default = true and deleted_at is null limit 1;

  -- Audit-trail row for the correction itself (so this adjustment, unlike the original
  -- phantom balance, IS traceable in stock_movements).
  insert into stock_movements (tenant_id, product_id, warehouse_id, movement_type, ref_type, ref_no,
    qty_in, qty_out, qty_balance, notes, created_at)
  values (v_tenant_id, v_product_id, v_wh, 'out', 'adjustment', 'FFM-RECON-20261102',
    0, v_cur - v_target, v_target,
    'Correction: stock_qty was ' || v_cur || ' with no supporting stock_movements/GRN (set directly on the product row at creation, 2026-10-17 — see migration 20261102010000_ffm_recon_audit_brzky.sql). ' ||
    'Reset to ' || v_target || ' pcs to match the only verified, synced FFM stock source (account "Brzky", ffm_stock.total_qty) as of this audit.',
    now());

  update products set stock_qty = v_target, updated_at = now()
  where id = v_product_id and tenant_id = v_tenant_id and stock_qty = v_cur;

  raise notice 'KRV-HM-003 stock_qty corrected % -> %', v_cur, v_target;
end $$;

-- TASK C note (no code/schema change — already correct): ffm_product_links and ffm_stock
-- have no uniqueness constraint beyond their own id, so a product CAN already be linked to
-- more than one ffm_accounts row (e.g. a future "Brozkey" account). reconTenant()
-- (supabase/functions/_shared/ffm-core.ts) aggregates ffm_stock by product_id across ALL
-- of the tenant's active accounts (`a.total += tp` inside the loop), so Reconciliation
-- already sums multi-account stock correctly once a second account exists. To fold in the
-- 1,080 pcs reported under "Brozkey": add it as its own row in FFM → Accounts (its own
-- mchId/API key), then FFM → Products → link this same product with barcode
-- 9555277201526, then Sync products + Refresh stock on that account. Nothing here inserts
-- that account automatically — a real merchant/API key is required, which this migration
-- cannot fabricate.

-- TASK D note (no code change — working as designed, not a bug): the FFM module never
-- writes products.stock_qty from any shipment/webhook/cron path (pullStock's own comment:
-- "ffm_stock ONLY — never products.stock_qty"); applyShipment() only touches
-- delivery_orders, and only for shipments M-Core itself created via send_order (i.e. ones
-- with a delivery_order_id). An outbound FFM initiates on its own side (such as
-- RW2611020ZUR6E0LT) was never created through M-Core's Delivery Order flow, so there is
-- no delivery_order_id to update either way. When that shipment clears FFM's warehouse,
-- ffm_stock.total_qty will correctly drop to 0 (next 30-min cron pull), while
-- products.stock_qty stays unchanged by design — so the Reconciliation diff will grow
-- from +1,540 to +860 immediately after this correction (2400 fix above), and the
-- existing daily 07:15 MYT reconTenant() job already notifies logistics/inventory users
-- (bell + push, dedup'd per tenant per day) when that diff is non-zero. No new sync path
-- is being added: building one that auto-decrements products.stock_qty from FFM shipments
-- would risk double-counting against POS/invoice/GRN movements that already affect the
-- same stock_qty through other channels — a bigger, separate architectural decision than
-- this audit's scope.

-- ---------- dev roadmap ----------
do $$
declare
  pr text := 'https://github.com/mpflemedia-ux/mcore/commits/main';
begin
  insert into public.dev_roadmap_items (title, description, module, stage, pr_url)
  select v.title, v.descr, 'logistics', 'completed', pr
  from (values
    ('FFM recon audit (Brzky/KRV-HM-003): trace phantom 2,400 pcs',
     'Found stock_qty=2400 had zero stock_movements/GRN — set directly on the Add Product form at product creation (_prodSave never writes an opening-balance stock_movements row, unlike the rest of the app). PO-0001 (qty 2400, status sent) is coincidental, created 13 min after the product row, never GRN''d. Correction SQL resets stock_qty to 860 (verified FFM "Brzky" total) with a proper stock_movements audit row.'),
    ('FFM product mapping: pcs_per_unit guidance + warning',
     'pcs_per_unit already defaulted to 1 in both client (FFM.ppu) and server (saveLink) — the "24" Mike found was a manually-saved link value, not a code default. Replaced the "1 carton = 24 pcs" example copy with guidance that FFM usually counts in the base unit, and added a warning shown whenever Pcs/unit > 1, asking to confirm with the FFM portal (no API field for packing ratio exists in the current integration to auto-fill/compare against).'),
    ('FFM multi-account reconciliation: audited, already correct',
     'ffm_product_links/ffm_stock allow multiple accounts per product (no uniqueness beyond id); reconTenant() aggregates ffm_stock by product_id across every active account for the tenant, so a second account (e.g. "Brozkey") would already sum correctly into Reconciliation once connected via FFM -> Accounts + Products (same barcode-per-account link flow). No code change needed.'),
    ('FFM outbound sync: audited, working as designed',
     'Confirmed pullStock/applyShipment never write products.stock_qty (by design — ffm_stock is kept separate). An FFM-initiated outbound (no M-Core delivery_order_id, e.g. RW2611020ZUR6E0LT) has nothing in M-Core to update either way; ffm_stock drops via the next 30-min cron pull and the existing daily 07:15 MYT reconTenant() notification (bell+push, logistics/inventory recipients, dedup per tenant per day) already surfaces the resulting diff. No new sync path added — auto-decrementing stock_qty from FFM shipments risks double-counting against POS/invoice/GRN movements on the same product.')
  ) as v(title, descr)
  where not exists (select 1 from public.dev_roadmap_items d where d.title = v.title);

  update public.dev_roadmap_items set stage = 'completed', pr_url = pr
  where title in (
    'FFM recon audit (Brzky/KRV-HM-003): trace phantom 2,400 pcs',
    'FFM product mapping: pcs_per_unit guidance + warning',
    'FFM multi-account reconciliation: audited, already correct',
    'FFM outbound sync: audited, working as designed'
  );
exception when undefined_column or undefined_table then
  raise notice 'dev_roadmap schema variant; skip: %', sqlerrm;
end $$;
