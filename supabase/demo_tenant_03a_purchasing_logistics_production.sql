-- ============================================================================
-- DEMO TENANT — PART 3a: Purchasing + Logistics + Production
-- Run AFTER Part 1 and Part 2 have succeeded. Plain INSERTs only. Idempotent.
--
-- UUID tags used in this file:
--   0101 suppliers              0105 goods_received_items
--   0102 purchase_orders        0106 supplier_bills
--   0103 purchase_order_items   0107 supplier_payments
--   0104 goods_received_notes   0108 delivery_orders
--   0109 work_orders            0110 bom_items
-- ============================================================================

reset role;

do $$ begin
  if not exists (select 1 from tenants where code = 'DEMO') then
    raise exception 'tenant code DEMO not found — run Part 1 first';
  end if;
end $$;

-- ---------- SUPPLIERS (4) ----------
insert into suppliers (id, tenant_id, name, phone, email, address)
select v.id, t.id, v.name, v.phone, v.email, v.address
from tenants t
cross join (values
  ('00000000-0000-0000-0101-000000000001'::uuid,'Supplier Elektronik Prima Sdn Bhd','+603-77701001','sales@elektronikprima.my','No. 4, Jalan Industri 8, Shah Alam, Selangor'),
  ('00000000-0000-0000-0101-000000000002'::uuid,'Pembekal Makanan Segar Trading','+603-77701002',null,'No. 19, Jalan Pasar, Klang, Selangor'),
  ('00000000-0000-0000-0101-000000000003'::uuid,'Alat Tulis Wholesale Sdn Bhd','+603-77701003','order@atwholesale.my','No. 2, Jalan Perniagaan 6, Shah Alam, Selangor'),
  ('00000000-0000-0000-0101-000000000004'::uuid,'Perabot & Kabinet Industries','+603-77701004',null,'No. 11, Jalan Kilang 9, Klang, Selangor')
) as v(id, name, phone, email, address)
where t.code = 'DEMO'
  and not exists (select 1 from suppliers s where s.id = v.id);

-- ---------- PURCHASE ORDERS (4) ----------
insert into purchase_orders (id, tenant_id, po_no, supplier_id, order_date, expected_date, status, notes, total)
select v.id, t.id, v.po_no, v.supplier_id, v.order_date, v.expected_date, v.status, v.notes, v.total
from tenants t
cross join (values
  ('00000000-0000-0000-0102-000000000001'::uuid,'PO-2601-0001','00000000-0000-0000-0101-000000000001'::uuid,'2026-09-25'::date,'2026-10-05'::date,'received','Restock elektronik Q4',4800::numeric),
  ('00000000-0000-0000-0102-000000000002'::uuid,'PO-2601-0002','00000000-0000-0000-0101-000000000002'::uuid,'2026-10-14'::date,'2026-10-21'::date,'sent','Restock F&B bulanan',1760::numeric),
  ('00000000-0000-0000-0102-000000000003'::uuid,'PO-2601-0003','00000000-0000-0000-0101-000000000003'::uuid,'2026-10-08'::date,'2026-10-18'::date,'partial','Restock alat tulis',2400::numeric),
  ('00000000-0000-0000-0102-000000000004'::uuid,'PO-2601-0004','00000000-0000-0000-0101-000000000004'::uuid,'2026-10-17'::date,'2026-10-30'::date,'draft','Kabinet fail tambahan',1800::numeric)
) as v(id, po_no, supplier_id, order_date, expected_date, status, notes, total)
where t.code = 'DEMO'
  and not exists (select 1 from purchase_orders po where po.id = v.id);

insert into purchase_order_items (id, po_id, product_id, description, qty, unit_cost, line_total, qty_received)
select v.id, v.po_id, v.product_id, v.description, v.qty, v.unit_cost, v.line_total, v.qty_received
from (values
  ('00000000-0000-0000-0103-000000000001'::uuid,'00000000-0000-0000-0102-000000000001'::uuid,'00000000-0000-0000-0004-000000000005'::uuid,'Bluetooth Speaker',80::numeric,60::numeric,4800::numeric,80::numeric),
  ('00000000-0000-0000-0103-000000000002'::uuid,'00000000-0000-0000-0102-000000000002'::uuid,'00000000-0000-0000-0004-000000000006'::uuid,'Kopi O Kaw (1kg)',80::numeric,18::numeric,1440::numeric,0::numeric),
  ('00000000-0000-0000-0103-000000000003'::uuid,'00000000-0000-0000-0102-000000000002'::uuid,'00000000-0000-0000-0004-000000000009'::uuid,'Air Mineral 1.5L (karton)',20::numeric,16::numeric,320::numeric,0::numeric),
  ('00000000-0000-0000-0103-000000000004'::uuid,'00000000-0000-0000-0102-000000000003'::uuid,'00000000-0000-0000-0004-000000000014'::uuid,'A4 Paper (ream)',100::numeric,11::numeric,1100::numeric,60::numeric),
  ('00000000-0000-0000-0103-000000000005'::uuid,'00000000-0000-0000-0102-000000000003'::uuid,'00000000-0000-0000-0004-000000000015'::uuid,'Ballpoint Pen (box of 12)',100::numeric,6::numeric,600::numeric,60::numeric),
  ('00000000-0000-0000-0103-000000000006'::uuid,'00000000-0000-0000-0102-000000000003'::uuid,'00000000-0000-0000-0004-000000000017'::uuid,'Whiteboard Marker Set',77.78::numeric,9::numeric,700::numeric,0::numeric),
  ('00000000-0000-0000-0103-000000000007'::uuid,'00000000-0000-0000-0102-000000000004'::uuid,'00000000-0000-0000-0004-000000000018'::uuid,'Filing Cabinet 4-Drawer',10::numeric,180::numeric,1800::numeric,0::numeric)
) as v(id, po_id, product_id, description, qty, unit_cost, line_total, qty_received)
where not exists (select 1 from purchase_order_items poi where poi.id = v.id);

-- ---------- GOODS RECEIVED: PO-0001 (fully received) + PO-0003 (partial) ----------
insert into goods_received_notes (id, tenant_id, grn_no, po_id, supplier_id, received_date, notes)
select v.id, t.id, v.grn_no, v.po_id, v.supplier_id, v.received_date, v.notes
from tenants t
cross join (values
  ('00000000-0000-0000-0104-000000000001'::uuid,'GRN-2601-0001','00000000-0000-0000-0102-000000000001'::uuid,'00000000-0000-0000-0101-000000000001'::uuid,'2026-10-04'::date,'Penerimaan penuh PO-2601-0001'),
  ('00000000-0000-0000-0104-000000000002'::uuid,'GRN-2601-0002','00000000-0000-0000-0102-000000000003'::uuid,'00000000-0000-0000-0101-000000000003'::uuid,'2026-10-16'::date,'Penerimaan separa PO-2601-0003 - A4 Paper & Pen sahaja')
) as v(id, grn_no, po_id, supplier_id, received_date, notes)
where t.code = 'DEMO'
  and not exists (select 1 from goods_received_notes g where g.id = v.id);

insert into goods_received_items (id, grn_id, po_item_id, product_id, qty_received, unit_cost)
select v.id, v.grn_id, v.po_item_id, v.product_id, v.qty_received, v.unit_cost
from (values
  (gen_random_uuid(),'00000000-0000-0000-0104-000000000001'::uuid,'00000000-0000-0000-0103-000000000001'::uuid,'00000000-0000-0000-0004-000000000005'::uuid,80::numeric,60::numeric),
  (gen_random_uuid(),'00000000-0000-0000-0104-000000000002'::uuid,'00000000-0000-0000-0103-000000000004'::uuid,'00000000-0000-0000-0004-000000000014'::uuid,60::numeric,11::numeric),
  (gen_random_uuid(),'00000000-0000-0000-0104-000000000002'::uuid,'00000000-0000-0000-0103-000000000005'::uuid,'00000000-0000-0000-0004-000000000015'::uuid,60::numeric,6::numeric)
) as v(id, grn_id, po_item_id, product_id, qty_received, unit_cost)
where not exists (
  select 1 from goods_received_items gi where gi.grn_id = v.grn_id and gi.po_item_id = v.po_item_id
);

-- ---------- SUPPLIER BILLS + PAYMENT ----------
insert into supplier_bills (id, tenant_id, bill_no, supplier_id, po_id, grn_id, bill_date, due_date, total, paid_amt, status)
select v.id, t.id, v.bill_no, v.supplier_id, v.po_id, v.grn_id, v.bill_date, v.due_date, v.total, v.paid_amt, v.status
from tenants t
cross join (values
  ('00000000-0000-0000-0106-000000000001'::uuid,'BILL-2601-0001','00000000-0000-0000-0101-000000000001'::uuid,'00000000-0000-0000-0102-000000000001'::uuid,'00000000-0000-0000-0104-000000000001'::uuid,'2026-10-04'::date,'2026-11-03'::date,4800::numeric,4800::numeric,'paid'),
  ('00000000-0000-0000-0106-000000000002'::uuid,'BILL-2601-0002','00000000-0000-0000-0101-000000000003'::uuid,'00000000-0000-0000-0102-000000000003'::uuid,'00000000-0000-0000-0104-000000000002'::uuid,'2026-10-16'::date,'2026-11-15'::date,1020::numeric,0::numeric,'unpaid')
) as v(id, bill_no, supplier_id, po_id, grn_id, bill_date, due_date, total, paid_amt, status)
where t.code = 'DEMO'
  and not exists (select 1 from supplier_bills sb where sb.id = v.id);

insert into supplier_payments (id, tenant_id, bill_id, payment_date, amount, method)
select '00000000-0000-0000-0107-000000000001'::uuid, t.id, '00000000-0000-0000-0106-000000000001'::uuid, '2026-10-20'::date, 4800::numeric, 'bank_transfer'
from tenants t
where t.code = 'DEMO'
  and not exists (select 1 from supplier_payments sp where sp.id = '00000000-0000-0000-0107-000000000001'::uuid);

-- ---------- LOGISTICS: DELIVERY ORDERS (3) ----------
insert into delivery_orders (id, tenant_id, invoice_id, customer_id, do_no, driver_name, vehicle_no, delivery_address, status, notes, delivered_at)
select v.id, t.id, v.invoice_id, v.customer_id, v.do_no, v.driver_name, v.vehicle_no, v.delivery_address, v.status, v.notes, v.delivered_at
from tenants t
cross join (values
  ('00000000-0000-0000-0108-000000000001'::uuid,'00000000-0000-0000-0008-000000000001'::uuid,'00000000-0000-0000-0001-000000000001'::uuid,'DO-2601-0001','Razak Ismail','BKA 3821','No. 8, Jalan Kenanga 3, Shah Alam, Selangor','delivered','Dihantar lengkap','2026-09-16 14:00:00+08'::timestamptz),
  ('00000000-0000-0000-0108-000000000002'::uuid,'00000000-0000-0000-0008-000000000005'::uuid,'00000000-0000-0000-0001-000000000007'::uuid,'DO-2601-0002','Hafizul Anuar','BMA 7712','No. 3, Jalan Perindustrian 7, Shah Alam, Selangor','in_transit','Fasa 1 - dalam perjalanan',null::timestamptz),
  ('00000000-0000-0000-0108-000000000003'::uuid,'00000000-0000-0000-0008-000000000010'::uuid,'00000000-0000-0000-0001-000000000015'::uuid,'DO-2601-0003','Kamarul Zaman','BPL 5590','No. 33, Jalan Pelabuhan, Port Klang, Selangor','pending','Menunggu pengesahan slot pelabuhan',null::timestamptz)
) as v(id, invoice_id, customer_id, do_no, driver_name, vehicle_no, delivery_address, status, notes, delivered_at)
where t.code = 'DEMO'
  and not exists (select 1 from delivery_orders d where d.id = v.id);

-- ---------- PRODUCTION: WORK ORDERS (2) + sample BOM (1) ----------
insert into bom_items (id, tenant_id, product_id, component_id, qty_per_unit)
select '00000000-0000-0000-0110-000000000001'::uuid, t.id, '00000000-0000-0000-0004-000000000013'::uuid, '00000000-0000-0000-0004-000000000003'::uuid, 1::numeric
from tenants t
where t.code = 'DEMO'
  and not exists (select 1 from bom_items b where b.id = '00000000-0000-0000-0110-000000000001'::uuid);

insert into work_orders (id, tenant_id, product_id, qty_to_produce, status, materials_needed, notes, completed_at)
select v.id, t.id, v.product_id, v.qty_to_produce, v.status, v.materials_needed, v.notes, v.completed_at
from tenants t
cross join (values
  ('00000000-0000-0000-0109-000000000001'::uuid,'00000000-0000-0000-0004-000000000013'::uuid,30::numeric,'in_progress','USB-C Cable 1m x 30','Pemasangan LED Desk Lamp - batch Oktober',null::timestamptz),
  ('00000000-0000-0000-0109-000000000002'::uuid,'00000000-0000-0000-0004-000000000010'::uuid,50::numeric,'completed','-','Pembungkusan Plastic Food Container Set - siap','2026-10-10 17:00:00+08'::timestamptz)
) as v(id, product_id, qty_to_produce, status, materials_needed, notes, completed_at)
where t.code = 'DEMO'
  and not exists (select 1 from work_orders w where w.id = v.id);

-- ---------- SANITY CHECK ----------
select
  (select count(*) from suppliers where tenant_id = t.id) as suppliers,
  (select count(*) from purchase_orders where tenant_id = t.id) as purchase_orders,
  (select count(*) from purchase_order_items poi join purchase_orders po on po.id = poi.po_id where po.tenant_id = t.id) as po_items,
  (select count(*) from goods_received_notes where tenant_id = t.id) as grns,
  (select count(*) from supplier_bills where tenant_id = t.id) as supplier_bills,
  (select count(*) from supplier_payments where tenant_id = t.id) as supplier_payments,
  (select count(*) from delivery_orders where tenant_id = t.id) as delivery_orders,
  (select count(*) from work_orders where tenant_id = t.id) as work_orders,
  (select count(*) from bom_items where tenant_id = t.id) as bom_items
from tenants t
where t.code = 'DEMO';
