-- ============================================================================
-- DEMO TENANT — PART 2: CRM + Inventory + Sales + POS
-- Run AFTER demo_tenant_01_bootstrap.sql has succeeded (tenant code DEMO
-- must already exist). Plain INSERTs only (no session-dependent RPCs), so
-- this is safe to run as one script - no Unauthorized-style rollback risk.
-- Safe to re-run: every INSERT is guarded by "if not exists" at table level.
--
-- UUID convention used in every Part 2+ file so later parts can reference
-- rows created here without a lookup round-trip:
--   00000000-0000-0000-TTTT-NNNNNNNNNNNN
--   TTTT = entity type tag, NNNNNNNNNNNN = zero-padded sequence
--   0001 customers        0008 invoices
--   0002 customer_contacts 0009 invoice_items
--   0003 product_categories 0010 payments
--   0004 products          0011 payment_allocations
--   0005 warehouses        0012 pos_sessions
--   0006 quotations        0013 pos_transactions
--   0007 quotation_items   0014 pos_transaction_items
-- ============================================================================

reset role;

do $$ begin
  if not exists (select 1 from tenants where code = 'DEMO') then
    raise exception 'tenant code DEMO not found — run demo_tenant_01_bootstrap.sql first';
  end if;
end $$;

-- ---------- CUSTOMERS (15) ----------
insert into customers (id, tenant_id, code, customer_type, name, reg_no, email, phone,
  address_line1, city, state, postcode, country, credit_limit, credit_term, outstanding,
  category, source, pipeline_stage, wa_tags, is_active)
select v.id, t.id, v.code, v.customer_type, v.name, v.reg_no, v.email, v.phone,
  v.address_line1, v.city, v.state, v.postcode, 'MY', v.credit_limit, v.credit_term, v.outstanding,
  v.category, v.source, v.pipeline_stage, v.wa_tags, true
from tenants t
cross join (values
  ('00000000-0000-0000-0001-000000000001'::uuid,'C001','company','Koperasi Warga Maju Berhad','KWM-2010234','purchasing@kwmaju.my','+603-55512001','No. 8, Jalan Kenanga 3','Shah Alam','Selangor','40400',50000::numeric,30,12500::numeric,'Corporate','Referral','customer','{vip}'::text[]),
  ('00000000-0000-0000-0001-000000000002'::uuid,'C002','company','Restoran Selera Kampung Sdn Bhd','RSK-2015678',null,'+603-55512002','No. 21, Jalan Tun Razak','Shah Alam','Selangor','40000',10000::numeric,14,0::numeric,'F&B','Walk-in','customer','{}'::text[]),
  ('00000000-0000-0000-0001-000000000003'::uuid,'C003','company','Hafiz Hardware Trading','HHT-2018022',null,'+603-55512003','No. 5, Jalan Perusahaan 2','Klang','Selangor','41200',15000::numeric,30,0::numeric,'Trading','Referral','customer','{}'::text[]),
  ('00000000-0000-0000-0001-000000000004'::uuid,'C004','company','Nurul Fesyen Boutique','NFB-2019901',null,'+603-55512004','No. 12, Jalan SS15/4','Subang Jaya','Selangor','47500',8000::numeric,14,0::numeric,'Retail','Social Media','customer','{}'::text[]),
  ('00000000-0000-0000-0001-000000000005'::uuid,'C005','individual','Ahmad bin Osman',null,'ahmad.osman@example.my','+6012-3450005',null,null,null,null,2000::numeric,7,0::numeric,'Walk-in','POS','customer','{}'::text[]),
  ('00000000-0000-0000-0001-000000000006'::uuid,'C006','individual','Siti Aminah binti Yusof',null,'siti.aminah@example.my','+6013-5670006',null,null,null,null,2000::numeric,7,0::numeric,'Walk-in','POS','customer','{}'::text[]),
  ('00000000-0000-0000-0001-000000000007'::uuid,'C007','company','Teguh Bina Construction Sdn Bhd','TBC-2012345','admin@teguhbina.my','+603-55512007','No. 3, Jalan Perindustrian 7','Shah Alam','Selangor','40150',80000::numeric,45,0::numeric,'Construction','Referral','customer','{}'::text[]),
  ('00000000-0000-0000-0001-000000000008'::uuid,'C008','company','Zul Automotive Sdn Bhd','ZAS-2016789',null,'+603-55512008','No. 9, Jalan Industri 4','Klang','Selangor','41000',12000::numeric,30,0::numeric,'Automotive','Referral','customer','{}'::text[]),
  ('00000000-0000-0000-0001-000000000009'::uuid,'C009','company','Maju Jaya Enterprise','MJE-2013456',null,'+603-55512009','No. 17, Jalan Besar','Shah Alam','Selangor','40100',9000::numeric,30,6700::numeric,'Trading','Walk-in','customer','{late}'::text[]),
  ('00000000-0000-0000-0001-000000000010'::uuid,'C010','individual','Faridah Catering Services',null,'faridah.catering@example.my','+6019-8900010',null,null,null,null,3000::numeric,14,0::numeric,'F&B','Referral','customer','{}'::text[]),
  ('00000000-0000-0000-0001-000000000011'::uuid,'C011','company','TechSolve IT Services Sdn Bhd','TSI-2021001','sales@techsolve.my','+603-55512011','No. 25, Jalan Teknologi 1','Cyberjaya','Selangor','63000',0::numeric,30,0::numeric,'IT Services','Cold Call','prospect','{}'::text[]),
  ('00000000-0000-0000-0001-000000000012'::uuid,'C012','company','Global Builders Supply Sdn Bhd','GBS-2017234',null,'+603-55512012','No. 41, Jalan Kilang 2','Klang','Selangor','41300',0::numeric,30,0::numeric,'Construction','Trade Show','lead','{}'::text[]),
  ('00000000-0000-0000-0001-000000000013'::uuid,'C013','individual','Amirul bin Hassan',null,'amirul.hassan@example.my','+6017-2340013',null,null,null,null,1500::numeric,7,0::numeric,'Walk-in','POS','customer','{}'::text[]),
  ('00000000-0000-0000-0001-000000000014'::uuid,'C014','company','Bestari Stationery Sdn Bhd','BST-2014567',null,'+603-55512014','No. 6, Jalan Dataran 3','Shah Alam','Selangor','40200',6000::numeric,21,0::numeric,'Office Supplies','Referral','customer','{}'::text[]),
  ('00000000-0000-0000-0001-000000000015'::uuid,'C015','company','Delta Logistics Sdn Bhd','DLS-2011890',null,'+603-55512015','No. 33, Jalan Pelabuhan','Port Klang','Selangor','42000',20000::numeric,30,0::numeric,'Logistics','Referral','customer','{}'::text[])
) as v(id, code, customer_type, name, reg_no, email, phone, address_line1, city, state, postcode, credit_limit, credit_term, outstanding, category, source, pipeline_stage, wa_tags)
where t.code = 'DEMO'
  and not exists (select 1 from customers c where c.id = v.id);

-- ---------- CUSTOMER CONTACTS (4) ----------
insert into customer_contacts (id, tenant_id, customer_id, name, designation, email, phone, is_primary)
select v.id, t.id, v.customer_id, v.name, v.designation, v.email, v.phone, true
from tenants t
cross join (values
  ('00000000-0000-0000-0002-000000000001'::uuid,'00000000-0000-0000-0001-000000000001'::uuid,'Puan Rohana Ibrahim','Pegawai Pembelian','rohana@kwmaju.my','+6012-3334001'),
  ('00000000-0000-0000-0002-000000000002'::uuid,'00000000-0000-0000-0001-000000000007'::uuid,'En. Suhaimi Razak','Pengurus Projek','suhaimi@teguhbina.my','+6012-3334002'),
  ('00000000-0000-0000-0002-000000000003'::uuid,'00000000-0000-0000-0001-000000000011'::uuid,'Ms. Clarissa Tan','Business Development Manager','clarissa@techsolve.my','+6012-3334003'),
  ('00000000-0000-0000-0002-000000000004'::uuid,'00000000-0000-0000-0001-000000000002'::uuid,'En. Zainal Kassim','Pemilik','zainal@selerakampung.my','+6012-3334004')
) as v(id, customer_id, name, designation, email, phone)
where t.code = 'DEMO'
  and not exists (select 1 from customer_contacts cc where cc.id = v.id);

-- ---------- PRODUCT CATEGORIES (5) ----------
insert into product_categories (id, tenant_id, code, name_en, name_bm, is_active)
select v.id, t.id, v.code, v.name_en, v.name_bm, true
from tenants t
cross join (values
  ('00000000-0000-0000-0003-000000000001'::uuid,'ELEK','Electronics & Accessories','Elektronik & Alat Ganti'),
  ('00000000-0000-0000-0003-000000000002'::uuid,'FNB','Food & Beverage','Makanan & Minuman'),
  ('00000000-0000-0000-0003-000000000003'::uuid,'RUMAH','Household Items','Perkakasan Rumah'),
  ('00000000-0000-0000-0003-000000000004'::uuid,'OFIS','Stationery & Office','Alat Tulis & Pejabat'),
  ('00000000-0000-0000-0003-000000000005'::uuid,'SERV','Services','Perkhidmatan')
) as v(id, code, name_en, name_bm)
where t.code = 'DEMO'
  and not exists (select 1 from product_categories pc where pc.id = v.id);

-- ---------- WAREHOUSE (1) ----------
insert into warehouses (id, tenant_id, code, name, address, is_default, is_active)
select '00000000-0000-0000-0005-000000000001'::uuid, t.id, 'WH-MAIN', 'Main Warehouse', 'No. 8, Jalan Perusahaan 2, Shah Alam', true, true
from tenants t
where t.code = 'DEMO'
  and not exists (select 1 from warehouses w where w.id = '00000000-0000-0000-0005-000000000001'::uuid);

-- ---------- PRODUCTS (20) ----------
insert into products (id, tenant_id, category_id, code, name_en, name_bm, product_type, unit,
  unit_cost, unit_price, tax_code, tax_rate, track_inventory, stock_qty, min_stock, is_active, is_pos_item, is_purchasable, is_sellable)
select v.id, t.id, v.category_id, v.code, v.name_en, v.name_bm, v.product_type, v.unit,
  v.unit_cost, v.unit_price, v.tax_code, v.tax_rate, v.track_inventory, v.stock_qty, v.min_stock, true, v.is_pos_item, v.is_purchasable, true
from tenants t
cross join (values
  ('00000000-0000-0000-0004-000000000001'::uuid,'00000000-0000-0000-0003-000000000001'::uuid,'P001','Smartphone Case','Kes Telefon Pintar','product','unit',8::numeric,15::numeric,'SST',8::numeric,true,120::numeric,20::numeric,true,true),
  ('00000000-0000-0000-0004-000000000002'::uuid,'00000000-0000-0000-0003-000000000001'::uuid,'P002','Wireless Mouse','Tetikus Wayarles','product','unit',18::numeric,35::numeric,'SST',8::numeric,true,60::numeric,15::numeric,true,true),
  ('00000000-0000-0000-0004-000000000003'::uuid,'00000000-0000-0000-0003-000000000001'::uuid,'P003','USB-C Cable 1m','Kabel USB-C 1m','product','unit',4::numeric,10::numeric,'SST',8::numeric,true,200::numeric,50::numeric,true,true),
  ('00000000-0000-0000-0004-000000000004'::uuid,'00000000-0000-0000-0003-000000000001'::uuid,'P004','Power Bank 10000mAh','Power Bank 10000mAh','product','unit',35::numeric,65::numeric,'SST',8::numeric,true,45::numeric,10::numeric,true,true),
  ('00000000-0000-0000-0004-000000000005'::uuid,'00000000-0000-0000-0003-000000000001'::uuid,'P005','Bluetooth Speaker','Pembesar Suara Bluetooth','product','unit',60::numeric,120::numeric,'SST',8::numeric,true,8::numeric,15::numeric,true,true),
  ('00000000-0000-0000-0004-000000000006'::uuid,'00000000-0000-0000-0003-000000000002'::uuid,'P006','Kopi O Kaw (1kg)','Kopi O Kaw (1kg)','product','pkt',18::numeric,32::numeric,null,0::numeric,true,80::numeric,20::numeric,true,true),
  ('00000000-0000-0000-0004-000000000007'::uuid,'00000000-0000-0000-0003-000000000002'::uuid,'P007','Teh Tarik Premix (box)','Teh Tarik Premix (kotak)','product','box',22::numeric,38::numeric,null,0::numeric,true,65::numeric,15::numeric,true,true),
  ('00000000-0000-0000-0004-000000000008'::uuid,'00000000-0000-0000-0003-000000000002'::uuid,'P008','Biskut Raya Assorted','Biskut Raya Campuran','product','tin',12::numeric,22::numeric,null,0::numeric,true,150::numeric,30::numeric,true,true),
  ('00000000-0000-0000-0004-000000000009'::uuid,'00000000-0000-0000-0003-000000000002'::uuid,'P009','Air Mineral 1.5L (karton)','Air Mineral 1.5L (karton)','product','ctn',14::numeric,24::numeric,null,0::numeric,true,90::numeric,20::numeric,true,true),
  ('00000000-0000-0000-0004-000000000010'::uuid,'00000000-0000-0000-0003-000000000003'::uuid,'P010','Plastic Food Container Set','Set Bekas Makanan Plastik','product','set',9::numeric,18::numeric,'SST',8::numeric,true,110::numeric,25::numeric,true,true),
  ('00000000-0000-0000-0004-000000000011'::uuid,'00000000-0000-0000-0003-000000000003'::uuid,'P011','Non-stick Frying Pan 28cm','Kuali Anti Lekat 28cm','product','unit',28::numeric,55::numeric,'SST',8::numeric,true,35::numeric,10::numeric,true,false),
  ('00000000-0000-0000-0004-000000000012'::uuid,'00000000-0000-0000-0003-000000000003'::uuid,'P012','Stainless Steel Rice Cooker 1.8L','Periuk Nasi Keluli 1.8L','product','unit',65::numeric,135::numeric,'SST',8::numeric,true,20::numeric,8::numeric,true,false),
  ('00000000-0000-0000-0004-000000000013'::uuid,'00000000-0000-0000-0003-000000000003'::uuid,'P013','LED Desk Lamp','Lampu Meja LED','product','unit',22::numeric,45::numeric,'SST',8::numeric,true,40::numeric,12::numeric,true,true),
  ('00000000-0000-0000-0004-000000000014'::uuid,'00000000-0000-0000-0003-000000000004'::uuid,'P014','A4 Paper (ream)','Kertas A4 (rim)','product','ream',11::numeric,18::numeric,null,0::numeric,true,300::numeric,60::numeric,true,true),
  ('00000000-0000-0000-0004-000000000015'::uuid,'00000000-0000-0000-0003-000000000004'::uuid,'P015','Ballpoint Pen (box of 12)','Pen Mata Bulat (kotak 12)','product','box',6::numeric,12::numeric,null,0::numeric,true,180::numeric,40::numeric,true,true),
  ('00000000-0000-0000-0004-000000000016'::uuid,'00000000-0000-0000-0003-000000000004'::uuid,'P016','Office Stapler','Stapler Pejabat','product','unit',7::numeric,15::numeric,'SST',8::numeric,true,70::numeric,20::numeric,true,true),
  ('00000000-0000-0000-0004-000000000017'::uuid,'00000000-0000-0000-0003-000000000004'::uuid,'P017','Whiteboard Marker Set','Set Marker Papan Putih','product','set',9::numeric,19::numeric,null,0::numeric,true,95::numeric,25::numeric,true,true),
  ('00000000-0000-0000-0004-000000000018'::uuid,'00000000-0000-0000-0003-000000000004'::uuid,'P018','Filing Cabinet 4-Drawer','Kabinet Fail 4-Laci','product','unit',180::numeric,320::numeric,'SST',8::numeric,true,6::numeric,3::numeric,true,false),
  ('00000000-0000-0000-0004-000000000019'::uuid,'00000000-0000-0000-0003-000000000005'::uuid,'P019','IT Support Service (Monthly)','Perkhidmatan Sokongan IT (Bulanan)','service','bulan',0::numeric,500::numeric,null,0::numeric,false,0::numeric,0::numeric,true,false),
  ('00000000-0000-0000-0004-000000000020'::uuid,'00000000-0000-0000-0003-000000000005'::uuid,'P020','Delivery & Installation Service','Perkhidmatan Hantar & Pasang','service','unit',0::numeric,80::numeric,null,0::numeric,false,0::numeric,0::numeric,true,false)
) as v(id, category_id, code, name_en, name_bm, product_type, unit, unit_cost, unit_price, tax_code, tax_rate, track_inventory, stock_qty, min_stock, is_pos_item, is_purchasable)
where t.code = 'DEMO'
  and not exists (select 1 from products p where p.id = v.id);

-- ---------- OPENING STOCK MOVEMENTS (1 per physical product, matching stock_qty) ----------
insert into stock_movements (id, tenant_id, product_id, warehouse_id, movement_type, ref_type, ref_no, qty_in, qty_out, qty_balance, unit_cost, total_cost, notes)
select gen_random_uuid(), t.id, p.id, '00000000-0000-0000-0005-000000000001'::uuid, 'in', 'opening_balance', 'OPEN-STOCK', p.stock_qty, 0, p.stock_qty, p.unit_cost, p.stock_qty * p.unit_cost, 'Opening stock balance'
from tenants t
join products p on p.tenant_id = t.id and p.track_inventory = true
where t.code = 'DEMO'
  and not exists (
    select 1 from stock_movements sm where sm.tenant_id = t.id and sm.ref_type = 'opening_balance' and sm.product_id = p.id
  );

-- ---------- QUOTATIONS (6) ----------
insert into quotations (id, tenant_id, ref_no, customer_id, customer_name, status, issue_date, valid_until,
  converted_to, subtotal, tax_total, total, notes, customer_response, customer_response_reason)
select v.id, t.id, v.ref_no, v.customer_id, v.customer_name, v.status, v.issue_date, v.valid_until,
  v.converted_to, v.subtotal, v.tax_total, v.total, v.notes, v.customer_response, v.customer_response_reason
from tenants t
cross join (values
  ('00000000-0000-0000-0006-000000000001'::uuid,'QUO-2601-0001','00000000-0000-0000-0001-000000000011'::uuid,'TechSolve IT Services Sdn Bhd','sent','2026-09-20'::date,'2026-10-20'::date,null::uuid,1500::numeric,0::numeric,1500::numeric,'IT support package - menunggu respons',null,null),
  ('00000000-0000-0000-0006-000000000002'::uuid,'QUO-2601-0002','00000000-0000-0000-0001-000000000012'::uuid,'Global Builders Supply Sdn Bhd','sent','2026-09-18'::date,'2026-10-18'::date,null::uuid,4200::numeric,0::numeric,4200::numeric,'Bulk hardware supply','declined','Budget tidak mencukupi buat masa ini'),
  ('00000000-0000-0000-0006-000000000003'::uuid,'QUO-2601-0003','00000000-0000-0000-0001-000000000013'::uuid,'Amirul bin Hassan','draft','2026-10-05'::date,'2026-11-05'::date,null::uuid,340::numeric,27.2::numeric,367.2::numeric,'Household bundle',null,null),
  ('00000000-0000-0000-0006-000000000004'::uuid,'QUO-2601-0004','00000000-0000-0000-0001-000000000001'::uuid,'Koperasi Warga Maju Berhad','sent','2026-09-10'::date,'2026-10-10'::date,'00000000-0000-0000-0008-000000000001'::uuid,15000::numeric,0::numeric,15000::numeric,'Elektronik bulk order','accepted',null),
  ('00000000-0000-0000-0006-000000000005'::uuid,'QUO-2601-0005','00000000-0000-0000-0001-000000000007'::uuid,'Teguh Bina Construction Sdn Bhd','sent','2026-09-05'::date,'2026-10-05'::date,'00000000-0000-0000-0008-000000000005'::uuid,42000::numeric,0::numeric,42000::numeric,'Pembekalan peralatan tapak','accepted',null),
  ('00000000-0000-0000-0006-000000000006'::uuid,'QUO-2601-0006','00000000-0000-0000-0001-000000000014'::uuid,'Bestari Stationery Sdn Bhd','draft','2026-10-12'::date,'2026-11-12'::date,null::uuid,650::numeric,0::numeric,650::numeric,'Office supplies restock',null,null)
) as v(id, ref_no, customer_id, customer_name, status, issue_date, valid_until, converted_to, subtotal, tax_total, total, notes, customer_response, customer_response_reason)
where t.code = 'DEMO'
  and not exists (select 1 from quotations q where q.id = v.id);

-- quotation_items (for QUO-0001 and QUO-0003 as representative examples)
insert into quotation_items (id, tenant_id, quotation_id, line_no, product_id, description, qty, unit_price, tax_rate, tax_amt, line_total)
select v.id, t.id, v.quotation_id, v.line_no, v.product_id, v.description, v.qty, v.unit_price, v.tax_rate, v.tax_amt, v.line_total
from tenants t
cross join (values
  ('00000000-0000-0000-0007-000000000001'::uuid,'00000000-0000-0000-0006-000000000001'::uuid,1,'00000000-0000-0000-0004-000000000019'::uuid,'IT Support Service (Monthly) x 3 bulan',3::numeric,500::numeric,0::numeric,0::numeric,1500::numeric),
  ('00000000-0000-0000-0007-000000000002'::uuid,'00000000-0000-0000-0006-000000000003'::uuid,1,'00000000-0000-0000-0004-000000000012'::uuid,'Stainless Steel Rice Cooker 1.8L',2::numeric,135::numeric,8::numeric,21.6::numeric,291.6::numeric),
  ('00000000-0000-0000-0007-000000000003'::uuid,'00000000-0000-0000-0006-000000000003'::uuid,2,'00000000-0000-0000-0004-000000000011'::uuid,'Non-stick Frying Pan 28cm',1::numeric,55::numeric,8::numeric,4.4::numeric,59.4::numeric)
) as v(id, quotation_id, line_no, product_id, description, qty, unit_price, tax_rate, tax_amt, line_total)
where t.code = 'DEMO'
  and not exists (select 1 from quotation_items qi where qi.id = v.id);

-- ---------- INVOICES (10) ----------
insert into invoices (id, tenant_id, ref_no, quotation_id, customer_id, customer_name, status, invoice_type,
  issue_date, due_date, paid_date, subtotal, tax_total, total, paid_amt, balance, notes, channel)
select v.id, t.id, v.ref_no, v.quotation_id, v.customer_id, v.customer_name, v.status, 'invoice',
  v.issue_date, v.due_date, v.paid_date, v.subtotal, v.tax_total, v.total, v.paid_amt, v.balance, v.notes, 'retail'
from tenants t
cross join (values
  ('00000000-0000-0000-0008-000000000001'::uuid,'INV-2601-0001','00000000-0000-0000-0006-000000000004'::uuid,'00000000-0000-0000-0001-000000000001'::uuid,'Koperasi Warga Maju Berhad','sent','2026-09-15'::date,'2026-10-15'::date,null::date,15000::numeric,0::numeric,15000::numeric,2500::numeric,12500::numeric,'Elektronik bulk order - deposit diterima'),
  ('00000000-0000-0000-0008-000000000002'::uuid,'INV-2601-0002',null,'00000000-0000-0000-0001-000000000002'::uuid,'Restoran Selera Kampung Sdn Bhd','paid','2026-09-22'::date,'2026-10-06'::date,'2026-09-25'::date,3200::numeric,0::numeric,3200::numeric,3200::numeric,0::numeric,'F&B supplies'),
  ('00000000-0000-0000-0008-000000000003'::uuid,'INV-2601-0003',null,'00000000-0000-0000-0001-000000000003'::uuid,'Hafiz Hardware Trading','sent','2026-10-10'::date,'2026-11-09'::date,null::date,4700::numeric,400::numeric,5100::numeric,0::numeric,5100::numeric,'Hardware restock'),
  ('00000000-0000-0000-0008-000000000004'::uuid,'INV-2601-0004',null,'00000000-0000-0000-0001-000000000004'::uuid,'Nurul Fesyen Boutique','paid','2026-09-28'::date,'2026-10-12'::date,'2026-10-01'::date,1800::numeric,0::numeric,1800::numeric,1800::numeric,0::numeric,'Fesyen retail order'),
  ('00000000-0000-0000-0008-000000000005'::uuid,'INV-2601-0005','00000000-0000-0000-0006-000000000005'::uuid,'00000000-0000-0000-0001-000000000007'::uuid,'Teguh Bina Construction Sdn Bhd','sent','2026-09-12'::date,'2026-10-27'::date,null::date,42000::numeric,0::numeric,42000::numeric,0::numeric,42000::numeric,'Pembekalan peralatan tapak - projek fasa 1'),
  ('00000000-0000-0000-0008-000000000006'::uuid,'INV-2601-0006',null,'00000000-0000-0000-0001-000000000008'::uuid,'Zul Automotive Sdn Bhd','paid','2026-10-01'::date,'2026-10-15'::date,'2026-10-08'::date,2130::numeric,170.4::numeric,2300.4::numeric,2300.4::numeric,0::numeric,'Alat ganti automotif'),
  ('00000000-0000-0000-0008-000000000007'::uuid,'INV-2601-0007',null,'00000000-0000-0000-0001-000000000009'::uuid,'Maju Jaya Enterprise','sent','2026-08-25'::date,'2026-09-24'::date,null::date,6700::numeric,0::numeric,6700::numeric,0::numeric,6700::numeric,'Trading goods - overdue, susulan diperlukan'),
  ('00000000-0000-0000-0008-000000000008'::uuid,'INV-2601-0008',null,'00000000-0000-0000-0001-000000000014'::uuid,'Bestari Stationery Sdn Bhd','paid','2026-10-03'::date,'2026-10-24'::date,'2026-10-09'::date,980::numeric,0::numeric,980::numeric,980::numeric,0::numeric,'Office stationery'),
  ('00000000-0000-0000-0008-000000000009'::uuid,'INV-2601-0009',null,'00000000-0000-0000-0001-000000000010'::uuid,'Faridah Catering Services','draft','2026-10-18'::date,'2026-11-01'::date,null::date,1500::numeric,0::numeric,1500::numeric,0::numeric,1500::numeric,'Katering acara korporat'),
  ('00000000-0000-0000-0008-000000000010'::uuid,'INV-2601-0010',null,'00000000-0000-0000-0001-000000000015'::uuid,'Delta Logistics Sdn Bhd','paid','2026-09-30'::date,'2026-10-14'::date,'2026-10-05'::date,8240::numeric,659.2::numeric,8899.2::numeric,8899.2::numeric,0::numeric,'Peralatan gudang')
) as v(id, ref_no, quotation_id, customer_id, customer_name, status, issue_date, due_date, paid_date, subtotal, tax_total, total, paid_amt, balance, notes)
where t.code = 'DEMO'
  and not exists (select 1 from invoices i where i.id = v.id);

-- invoice_items (2 lines each for a representative subset of invoices)
insert into invoice_items (id, tenant_id, invoice_id, line_no, product_id, description, qty, unit_price, tax_rate, tax_amt, line_total)
select v.id, t.id, v.invoice_id, v.line_no, v.product_id, v.description, v.qty, v.unit_price, v.tax_rate, v.tax_amt, v.line_total
from tenants t
cross join (values
  ('00000000-0000-0000-0009-000000000001'::uuid,'00000000-0000-0000-0008-000000000001'::uuid,1,'00000000-0000-0000-0004-000000000001'::uuid,'Smartphone Case x 500',500::numeric,15::numeric,0::numeric,0::numeric,7500::numeric),
  ('00000000-0000-0000-0009-000000000002'::uuid,'00000000-0000-0000-0008-000000000001'::uuid,2,'00000000-0000-0000-0004-000000000003'::uuid,'USB-C Cable 1m x 750',750::numeric,10::numeric,0::numeric,0::numeric,7500::numeric),
  ('00000000-0000-0000-0009-000000000003'::uuid,'00000000-0000-0000-0008-000000000002'::uuid,1,'00000000-0000-0000-0004-000000000006'::uuid,'Kopi O Kaw (1kg) x 100',100::numeric,32::numeric,0::numeric,0::numeric,3200::numeric),
  ('00000000-0000-0000-0009-000000000004'::uuid,'00000000-0000-0000-0008-000000000003'::uuid,1,'00000000-0000-0000-0004-000000000016'::uuid,'Office Stapler x 100',100::numeric,15::numeric,8::numeric,120::numeric,1500::numeric),
  ('00000000-0000-0000-0009-000000000005'::uuid,'00000000-0000-0000-0008-000000000003'::uuid,2,'00000000-0000-0000-0004-000000000018'::uuid,'Filing Cabinet 4-Drawer x 10',10::numeric,320::numeric,8::numeric,280::numeric,3200::numeric),
  ('00000000-0000-0000-0009-000000000006'::uuid,'00000000-0000-0000-0008-000000000005'::uuid,1,'00000000-0000-0000-0004-000000000018'::uuid,'Filing Cabinet 4-Drawer x 30',30::numeric,320::numeric,0::numeric,0::numeric,9600::numeric),
  ('00000000-0000-0000-0009-000000000007'::uuid,'00000000-0000-0000-0008-000000000005'::uuid,2,'00000000-0000-0000-0004-000000000020'::uuid,'Delivery & Installation Service x 405',405::numeric,80::numeric,0::numeric,0::numeric,32400::numeric),
  ('00000000-0000-0000-0009-000000000008'::uuid,'00000000-0000-0000-0008-000000000007'::uuid,1,'00000000-0000-0000-0004-000000000010'::uuid,'Plastic Food Container Set x 372.22',372.22::numeric,18::numeric,0::numeric,0::numeric,6700::numeric),
  ('00000000-0000-0000-0009-000000000009'::uuid,'00000000-0000-0000-0008-000000000004'::uuid,1,null,'Pakaian pelbagai - borong',1::numeric,1800::numeric,0::numeric,0::numeric,1800::numeric),
  ('00000000-0000-0000-0009-000000000010'::uuid,'00000000-0000-0000-0008-000000000006'::uuid,1,null,'Alat ganti automotif - pelbagai',1::numeric,2130::numeric,8::numeric,170.4::numeric,2130::numeric),
  ('00000000-0000-0000-0009-000000000011'::uuid,'00000000-0000-0000-0008-000000000008'::uuid,1,null,'Pembekalan alat tulis pejabat',1::numeric,980::numeric,0::numeric,0::numeric,980::numeric),
  ('00000000-0000-0000-0009-000000000012'::uuid,'00000000-0000-0000-0008-000000000009'::uuid,1,null,'Pakej katering acara korporat (50 pax)',1::numeric,1500::numeric,0::numeric,0::numeric,1500::numeric),
  ('00000000-0000-0000-0009-000000000013'::uuid,'00000000-0000-0000-0008-000000000010'::uuid,1,null,'Peralatan gudang - pelbagai',1::numeric,8240::numeric,8::numeric,659.2::numeric,8240::numeric)
) as v(id, invoice_id, line_no, product_id, description, qty, unit_price, tax_rate, tax_amt, line_total)
where t.code = 'DEMO'
  and not exists (select 1 from invoice_items ii where ii.id = v.id);

-- ---------- PAYMENTS (6, for the 6 'paid' invoices) + ALLOCATIONS ----------
insert into payments (id, tenant_id, ref_no, payment_type, customer_id, customer_name, payment_date, payment_method, amount, status)
select v.id, t.id, v.ref_no, 'receipt', v.customer_id, v.customer_name, v.payment_date, v.payment_method, v.amount, 'confirmed'
from tenants t
cross join (values
  ('00000000-0000-0000-0010-000000000001'::uuid,'RCP-2601-0001','00000000-0000-0000-0001-000000000001'::uuid,'Koperasi Warga Maju Berhad','2026-09-20'::date,'bank_transfer',2500::numeric),
  ('00000000-0000-0000-0010-000000000002'::uuid,'RCP-2601-0002','00000000-0000-0000-0001-000000000002'::uuid,'Restoran Selera Kampung Sdn Bhd','2026-09-25'::date,'cash',3200::numeric),
  ('00000000-0000-0000-0010-000000000003'::uuid,'RCP-2601-0003','00000000-0000-0000-0001-000000000004'::uuid,'Nurul Fesyen Boutique','2026-10-01'::date,'bank_transfer',1800::numeric),
  ('00000000-0000-0000-0010-000000000004'::uuid,'RCP-2601-0004','00000000-0000-0000-0001-000000000008'::uuid,'Zul Automotive Sdn Bhd','2026-10-08'::date,'card',2300.4::numeric),
  ('00000000-0000-0000-0010-000000000005'::uuid,'RCP-2601-0005','00000000-0000-0000-0001-000000000014'::uuid,'Bestari Stationery Sdn Bhd','2026-10-09'::date,'cash',980::numeric),
  ('00000000-0000-0000-0010-000000000006'::uuid,'RCP-2601-0006','00000000-0000-0000-0001-000000000015'::uuid,'Delta Logistics Sdn Bhd','2026-10-05'::date,'bank_transfer',8899.2::numeric)
) as v(id, ref_no, customer_id, customer_name, payment_date, payment_method, amount)
where t.code = 'DEMO'
  and not exists (select 1 from payments p where p.id = v.id);

insert into payment_allocations (id, tenant_id, payment_id, invoice_id, amount)
select v.id, t.id, v.payment_id, v.invoice_id, v.amount
from tenants t
cross join (values
  (gen_random_uuid(),'00000000-0000-0000-0010-000000000001'::uuid,'00000000-0000-0000-0008-000000000001'::uuid,2500::numeric),
  (gen_random_uuid(),'00000000-0000-0000-0010-000000000002'::uuid,'00000000-0000-0000-0008-000000000002'::uuid,3200::numeric),
  (gen_random_uuid(),'00000000-0000-0000-0010-000000000003'::uuid,'00000000-0000-0000-0008-000000000004'::uuid,1800::numeric),
  (gen_random_uuid(),'00000000-0000-0000-0010-000000000004'::uuid,'00000000-0000-0000-0008-000000000006'::uuid,2300.4::numeric),
  (gen_random_uuid(),'00000000-0000-0000-0010-000000000005'::uuid,'00000000-0000-0000-0008-000000000008'::uuid,980::numeric),
  (gen_random_uuid(),'00000000-0000-0000-0010-000000000006'::uuid,'00000000-0000-0000-0008-000000000010'::uuid,8899.2::numeric)
) as v(id, payment_id, invoice_id, amount)
where t.code = 'DEMO'
  and not exists (
    select 1 from payment_allocations pa where pa.tenant_id = t.id and pa.payment_id = v.payment_id and pa.invoice_id = v.invoice_id
  );

-- ---------- POS: 1 closed session + 5 transactions ----------
insert into pos_sessions (id, tenant_id, cashier_id, session_no, opened_at, closed_at, opening_cash, closing_cash,
  expected_cash, cash_variance, total_sales, total_refunds, total_txn, status)
select '00000000-0000-0000-0012-000000000001'::uuid, t.id, up.id, 'POS-2601-0001',
  '2026-10-15 09:00:00+08'::timestamptz, '2026-10-15 18:00:00+08'::timestamptz,
  200::numeric, 364::numeric, 364::numeric, 0::numeric, 452::numeric, 0::numeric, 5, 'closed'
from tenants t
join user_profiles up on up.tenant_id = t.id and up.role = 'staff'
where t.code = 'DEMO'
  and not exists (select 1 from pos_sessions ps where ps.id = '00000000-0000-0000-0012-000000000001'::uuid);

insert into pos_transactions (id, tenant_id, session_id, receipt_no, customer_id, txn_type, subtotal, tax_total, total,
  cash_tendered, change_given, payment_method, status, channel, created_at)
select v.id, t.id, '00000000-0000-0000-0012-000000000001'::uuid, v.receipt_no, v.customer_id, 'sale',
  v.subtotal, v.tax_total, v.total, v.cash_tendered, v.change_given, v.payment_method, 'completed', 'retail', v.created_at
from tenants t
cross join (values
  ('00000000-0000-0000-0013-000000000001'::uuid,'POS-2601-0001','00000000-0000-0000-0001-000000000005'::uuid,32.4::numeric,2.6::numeric,35::numeric,50::numeric,15::numeric,'cash','2026-10-15 09:20:00+08'::timestamptz),
  ('00000000-0000-0000-0013-000000000002'::uuid,'POS-2601-0002','00000000-0000-0000-0001-000000000006'::uuid,24::numeric,0::numeric,24::numeric,24::numeric,0::numeric,'cash','2026-10-15 10:45:00+08'::timestamptz),
  ('00000000-0000-0000-0013-000000000003'::uuid,'POS-2601-0003',null,78::numeric,0::numeric,78::numeric,null,null,'card','2026-10-15 13:10:00+08'::timestamptz),
  ('00000000-0000-0000-0013-000000000004'::uuid,'POS-2601-0004','00000000-0000-0000-0001-000000000013'::uuid,194.4::numeric,15.6::numeric,210::numeric,210::numeric,0::numeric,'card','2026-10-15 15:30:00+08'::timestamptz),
  ('00000000-0000-0000-0013-000000000005'::uuid,'POS-2601-0005',null,105::numeric,0::numeric,105::numeric,150::numeric,45::numeric,'cash','2026-10-15 17:05:00+08'::timestamptz)
) as v(id, receipt_no, customer_id, subtotal, tax_total, total, cash_tendered, change_given, payment_method, created_at)
where t.code = 'DEMO'
  and not exists (select 1 from pos_transactions pt where pt.id = v.id);

insert into pos_transaction_items (id, tenant_id, txn_id, product_id, name, qty, unit_price, tax_rate, tax_amt, line_total)
select v.id, t.id, v.txn_id, v.product_id, v.name, v.qty, v.unit_price, v.tax_rate, v.tax_amt, v.line_total
from tenants t
cross join (values
  (gen_random_uuid(),'00000000-0000-0000-0013-000000000001'::uuid,'00000000-0000-0000-0004-000000000001'::uuid,'Smartphone Case',2::numeric,15::numeric,8::numeric,2.4::numeric,32.4::numeric),
  (gen_random_uuid(),'00000000-0000-0000-0013-000000000002'::uuid,'00000000-0000-0000-0004-000000000009'::uuid,'Air Mineral 1.5L (karton)',1::numeric,24::numeric,0::numeric,0::numeric,24::numeric),
  (gen_random_uuid(),'00000000-0000-0000-0013-000000000003'::uuid,'00000000-0000-0000-0004-000000000006'::uuid,'Kopi O Kaw (1kg)',1::numeric,32::numeric,0::numeric,0::numeric,32::numeric),
  (gen_random_uuid(),'00000000-0000-0000-0013-000000000003'::uuid,'00000000-0000-0000-0004-000000000008'::uuid,'Biskut Raya Assorted',2::numeric,22::numeric,0::numeric,0::numeric,44::numeric),
  (gen_random_uuid(),'00000000-0000-0000-0013-000000000004'::uuid,'00000000-0000-0000-0004-000000000005'::uuid,'Bluetooth Speaker',1::numeric,120::numeric,8::numeric,9.6::numeric,129.6::numeric),
  (gen_random_uuid(),'00000000-0000-0000-0013-000000000004'::uuid,'00000000-0000-0000-0004-000000000002'::uuid,'Wireless Mouse',2::numeric,35::numeric,8::numeric,5.6::numeric,75.6::numeric),
  (gen_random_uuid(),'00000000-0000-0000-0013-000000000005'::uuid,'00000000-0000-0000-0004-000000000014'::uuid,'A4 Paper (ream)',5::numeric,18::numeric,0::numeric,0::numeric,90::numeric),
  (gen_random_uuid(),'00000000-0000-0000-0013-000000000005'::uuid,'00000000-0000-0000-0004-000000000015'::uuid,'Ballpoint Pen (box of 12)',1.25::numeric,12::numeric,0::numeric,0::numeric,15::numeric)
) as v(id, txn_id, product_id, name, qty, unit_price, tax_rate, tax_amt, line_total)
where t.code = 'DEMO'
  and not exists (
    select 1 from pos_transaction_items pti where pti.tenant_id = t.id and pti.txn_id = v.txn_id and pti.name = v.name
  );

-- ---------- doc_counters (best-effort — NOT verified against generate_ref_no()'s
-- actual counter_key format, since that function's source wasn't inspected.
-- If wrong, the only consequence is the app's next auto-generated ref_no for
-- this tenant may visually repeat a seeded number - cosmetic only, no ref_no
-- uniqueness constraint was found on these tables. ----------
insert into doc_counters (tenant_id, counter_key, last_seq)
select t.id, v.counter_key, v.last_seq
from tenants t
cross join (values ('QUO-2601',6),('INV-2601',10),('RCP-2601',6),('POS-2601',5)) as v(counter_key, last_seq)
where t.code = 'DEMO'
  and not exists (select 1 from doc_counters dc where dc.tenant_id = t.id and dc.counter_key = v.counter_key);

-- ---------- SANITY CHECK ----------
select
  (select count(*) from customers where tenant_id = t.id) as customers,
  (select count(*) from customer_contacts where tenant_id = t.id) as customer_contacts,
  (select count(*) from product_categories where tenant_id = t.id) as product_categories,
  (select count(*) from products where tenant_id = t.id) as products,
  (select count(*) from warehouses where tenant_id = t.id) as warehouses,
  (select count(*) from stock_movements where tenant_id = t.id) as stock_movements,
  (select count(*) from quotations where tenant_id = t.id) as quotations,
  (select count(*) from quotation_items where tenant_id = t.id) as quotation_items,
  (select count(*) from invoices where tenant_id = t.id) as invoices,
  (select count(*) from invoice_items where tenant_id = t.id) as invoice_items,
  (select count(*) from payments where tenant_id = t.id) as payments,
  (select count(*) from payment_allocations where tenant_id = t.id) as payment_allocations,
  (select count(*) from pos_sessions where tenant_id = t.id) as pos_sessions,
  (select count(*) from pos_transactions where tenant_id = t.id) as pos_transactions,
  (select count(*) from pos_transaction_items where tenant_id = t.id) as pos_transaction_items
from tenants t
where t.code = 'DEMO';
