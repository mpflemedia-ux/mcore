-- ============================================================================
-- DEMO TENANT — PART 5: full reseed (combined Parts 2 + 3a + 3b + 3c)
-- Run this AFTER reset_demo_tenant() (Part 4) has wiped the demo tenant's
-- operational data, to repopulate everything in one paste. Same content as
-- demo_tenant_02/03a/03b/03c.sql concatenated - those remain the source of
-- truth; update them (and re-cat this file) if the demo data ever needs to
-- change, rather than editing this file directly.
-- ============================================================================

-- session role sometimes gets stuck on 'authenticated' in this SQL Editor
-- (RLS then blocks these plain INSERTs). Reset it first.
reset role;

create or replace function public._reseed_demo_data()
returns jsonb
language plpgsql
security definer
as $$
begin


  if not exists (select 1 from tenants where code = 'DEMO') then
    raise exception 'tenant code DEMO not found — run demo_tenant_01_bootstrap.sql first';
  end if;

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
perform
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

-- ============================================================================

  if not exists (select 1 from tenants where code = 'DEMO') then
    raise exception 'tenant code DEMO not found — run Part 1 first';
  end if;

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
perform
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

-- ============================================================================

  if not exists (select 1 from tenants where code = 'DEMO') then
    raise exception 'tenant code DEMO not found — run Part 1 first';
  end if;

-- ---------- BANK ACCOUNTS (2) ----------
insert into bank_accounts (id, tenant_id, coa_id, account_name, bank_name, account_no, account_type, currency, opening_balance, current_balance, is_default, is_active)
select v.id, t.id, coa.id, v.account_name, v.bank_name, v.account_no, 'current', 'MYR', v.opening_balance, v.current_balance, v.is_default, true
from tenants t
join chart_of_accounts coa on coa.tenant_id = t.id and coa.code = '1120'
cross join (values
  ('00000000-0000-0000-0201-000000000001'::uuid,'Maju Trading Sdn Bhd','Maybank','514012345678',50000::numeric,44850::numeric,true),
  ('00000000-0000-0000-0201-000000000002'::uuid,'Maju Trading Sdn Bhd (Savings)','CIMB Bank','7012345601',8000::numeric,8000::numeric,false)
) as v(id, account_name, bank_name, account_no, opening_balance, current_balance, is_default)
where t.code = 'DEMO'
  and not exists (select 1 from bank_accounts b where b.id = v.id);

-- ---------- JOURNAL ENTRIES (4 manual entries) ----------
insert into journal_entries (id, tenant_id, fiscal_year_id, ref_no, entry_date, entry_type, description, total_debit, total_credit, status, period_month, period_year)
select v.id, t.id, fy.id, v.ref_no, v.entry_date, 'manual', v.description, v.amount, v.amount, 'posted', v.period_month, 2026
from tenants t
join fiscal_years fy on fy.tenant_id = t.id and fy.is_current = true
cross join (values
  ('00000000-0000-0000-0202-000000000001'::uuid,'JNL-2601-0001','2026-01-05'::date,'Suntikan modal awal pemilik',50000::numeric,1),
  ('00000000-0000-0000-0202-000000000002'::uuid,'JNL-2601-0002','2026-10-01'::date,'Sewa pejabat Oktober 2026',3500::numeric,10),
  ('00000000-0000-0000-0202-000000000003'::uuid,'JNL-2601-0003','2026-10-05'::date,'Bil utiliti Oktober 2026',450::numeric,10),
  ('00000000-0000-0000-0202-000000000004'::uuid,'JNL-2601-0004','2026-10-12'::date,'Perbelanjaan pemasaran - kempen media sosial',1200::numeric,10)
) as v(id, ref_no, entry_date, description, amount, period_month)
where t.code = 'DEMO'
  and not exists (select 1 from journal_entries je where je.id = v.id);

insert into journal_lines (id, tenant_id, entry_id, account_id, line_no, description, debit_amt, credit_amt)
select gen_random_uuid(), t.id, v.entry_id, coa.id, v.line_no, v.description, v.debit_amt, v.credit_amt
from tenants t
cross join (values
  ('00000000-0000-0000-0202-000000000001'::uuid,'1120',1,'Suntikan modal awal pemilik',50000::numeric,0::numeric),
  ('00000000-0000-0000-0202-000000000001'::uuid,'3100',2,'Suntikan modal awal pemilik',0::numeric,50000::numeric),
  ('00000000-0000-0000-0202-000000000002'::uuid,'6200',1,'Sewa pejabat Oktober 2026',3500::numeric,0::numeric),
  ('00000000-0000-0000-0202-000000000002'::uuid,'1120',2,'Sewa pejabat Oktober 2026',0::numeric,3500::numeric),
  ('00000000-0000-0000-0202-000000000003'::uuid,'6210',1,'Bil utiliti Oktober 2026',450::numeric,0::numeric),
  ('00000000-0000-0000-0202-000000000003'::uuid,'1120',2,'Bil utiliti Oktober 2026',0::numeric,450::numeric),
  ('00000000-0000-0000-0202-000000000004'::uuid,'6300',1,'Perbelanjaan pemasaran - kempen media sosial',1200::numeric,0::numeric),
  ('00000000-0000-0000-0202-000000000004'::uuid,'1120',2,'Perbelanjaan pemasaran - kempen media sosial',0::numeric,1200::numeric)
) as v(entry_id, coa_code, line_no, description, debit_amt, credit_amt)
join chart_of_accounts coa on coa.tenant_id = t.id and coa.code = v.coa_code
where t.code = 'DEMO'
  and not exists (
    select 1 from journal_lines jl where jl.entry_id = v.entry_id and jl.line_no = v.line_no
  );

-- ---------- FIXED ASSETS (2) + DEPRECIATION SCHEDULE ----------
insert into fixed_assets (id, tenant_id, coa_id, asset_no, name, category, purchase_date, purchase_price, residual_value,
  useful_life_years, depreciation_method, accumulated_dep, nbv, status, location)
select v.id, t.id, coa.id, v.asset_no, v.name, v.category, v.purchase_date, v.purchase_price, v.residual_value,
  v.useful_life_years, 'straight_line', v.accumulated_dep, v.purchase_price - v.accumulated_dep, 'active', 'Pejabat Shah Alam'
from tenants t
join chart_of_accounts coa on coa.tenant_id = t.id and coa.code = '1510'
cross join (values
  ('00000000-0000-0000-0204-000000000001'::uuid,'AST-2601-0001','Delivery Van - Toyota Hiace','Vehicle','2026-02-01'::date,85000::numeric,5000::numeric,5,12000::numeric),
  ('00000000-0000-0000-0204-000000000002'::uuid,'AST-2601-0002','Office Computer Set (x3)','Office Equipment','2026-03-15'::date,12000::numeric,0::numeric,3,2333::numeric)
) as v(id, asset_no, name, category, purchase_date, purchase_price, residual_value, useful_life_years, accumulated_dep)
where t.code = 'DEMO'
  and not exists (select 1 from fixed_assets fa where fa.id = v.id);

insert into depreciation_schedule (id, tenant_id, asset_id, period_year, period_month, dep_amount, acc_dep, nbv, is_posted)
select gen_random_uuid(), t.id, v.asset_id, 2026, v.period_month, v.dep_amount, v.acc_dep, v.nbv, true
from tenants t
cross join (values
  ('00000000-0000-0000-0204-000000000001'::uuid,9,1333.33::numeric,10666.64::numeric,74333.36::numeric),
  ('00000000-0000-0000-0204-000000000001'::uuid,10,1333.33::numeric,11999.97::numeric,73000.03::numeric),
  ('00000000-0000-0000-0204-000000000002'::uuid,9,333.33::numeric,2000::numeric,10000::numeric),
  ('00000000-0000-0000-0204-000000000002'::uuid,10,333.33::numeric,2333.33::numeric,9666.67::numeric)
) as v(asset_id, period_month, dep_amount, acc_dep, nbv)
where t.code = 'DEMO'
  and not exists (
    select 1 from depreciation_schedule ds where ds.tenant_id = t.id and ds.asset_id = v.asset_id and ds.period_month = v.period_month and ds.period_year = 2026
  );

-- ---------- EXPENSE CLAIMS (3) ----------
insert into expense_claims (id, tenant_id, ref_no, claimed_by, claim_date, description, total_amount, status, approved_by, approved_at)
select v.id, t.id, v.ref_no, claimant.id, v.claim_date, v.description, v.total_amount, v.status, approver.id, v.approved_at
from tenants t
cross join (values
  ('00000000-0000-0000-0205-000000000001'::uuid,'EXP-2601-0001','demo.owner@mpflemedia.my','2026-10-08'::date,'Tuntutan perjalanan & minyak - lawatan client',450::numeric,'approved','demo.owner@mpflemedia.my','2026-10-09 10:00:00+08'::timestamptz),
  ('00000000-0000-0000-0205-000000000002'::uuid,'EXP-2601-0002','demo.staff@mpflemedia.my','2026-10-16'::date,'Tuntutan bekalan pejabat',180::numeric,'draft',null,null),
  ('00000000-0000-0000-0205-000000000003'::uuid,'EXP-2601-0003','demo.staff@mpflemedia.my','2026-10-11'::date,'Tuntutan caj telefon & internet',220::numeric,'approved','demo.owner@mpflemedia.my','2026-10-12 09:30:00+08'::timestamptz)
) as v(id, ref_no, claimed_by_email, claim_date, description, total_amount, status, approved_by_email, approved_at)
join auth.users claimant on claimant.email = v.claimed_by_email
left join auth.users approver on approver.email = v.approved_by_email
where t.code = 'DEMO'
  and not exists (select 1 from expense_claims ec where ec.id = v.id);

insert into expense_claim_items (id, tenant_id, claim_id, account_id, date, description, amount)
select gen_random_uuid(), t.id, v.claim_id, coa.id, v.date, v.description, v.amount
from tenants t
cross join (values
  ('00000000-0000-0000-0205-000000000001'::uuid,'6500','2026-10-08'::date,'Minyak kenderaan - lawatan Koperasi Warga Maju',450::numeric),
  ('00000000-0000-0000-0205-000000000002'::uuid,'6400','2026-10-16'::date,'Bekalan pejabat pelbagai',180::numeric),
  ('00000000-0000-0000-0205-000000000003'::uuid,'6220','2026-10-11'::date,'Bil telefon & internet bulanan',220::numeric)
) as v(claim_id, coa_code, date, description, amount)
join chart_of_accounts coa on coa.tenant_id = t.id and coa.code = v.coa_code
where t.code = 'DEMO'
  and not exists (
    select 1 from expense_claim_items ei where ei.claim_id = v.claim_id and ei.description = v.description
  );

-- ---------- PAYMENT VOUCHER BATCHES (2) ----------
insert into payment_voucher_batches (id, tenant_id, ref_no, batch_date, title, status, total_amount, line_count, prepared_by, checked_by, approved_by)
select v.id, t.id, v.ref_no, v.batch_date, v.title, v.status, v.total_amount, v.line_count, v.prepared_by, v.checked_by, v.approved_by
from tenants t
cross join (values
  ('00000000-0000-0000-0207-000000000001'::uuid,'PV-2601-0001','2026-10-20'::date,'Bayaran Pembekal - Bil Oktober','approved',4800::numeric,1,'Demo Staff','Demo Owner','Demo Owner'),
  ('00000000-0000-0000-0207-000000000002'::uuid,'PV-2601-0002','2026-10-21'::date,'Bayaran Tuntutan Perbelanjaan','draft',450::numeric,1,'Demo Staff',null,null)
) as v(id, ref_no, batch_date, title, status, total_amount, line_count, prepared_by, checked_by, approved_by)
where t.code = 'DEMO'
  and not exists (select 1 from payment_voucher_batches pvb where pvb.id = v.id);

insert into payment_voucher_batch_lines (id, tenant_id, batch_id, sort_order, payee_name, amount, payment_method, bill_id, description)
select v.id, t.id, v.batch_id, v.sort_order, v.payee_name, v.amount, v.payment_method, v.bill_id, v.description
from tenants t
cross join (values
  (gen_random_uuid(),'00000000-0000-0000-0207-000000000001'::uuid,1,'Supplier Elektronik Prima Sdn Bhd',4800::numeric,'bank_transfer','00000000-0000-0000-0106-000000000001'::uuid,'Bayaran bil BILL-2601-0001'),
  (gen_random_uuid(),'00000000-0000-0000-0207-000000000002'::uuid,1,'Demo Owner',450::numeric,'bank_transfer',null,'Tuntutan perjalanan & minyak EXP-2601-0001')
) as v(id, batch_id, sort_order, payee_name, amount, payment_method, bill_id, description)
where t.code = 'DEMO'
  and not exists (
    select 1 from payment_voucher_batch_lines pvl where pvl.batch_id = v.batch_id and pvl.sort_order = v.sort_order
  );

-- ---------- SANITY CHECK ----------
perform
  (select count(*) from bank_accounts where tenant_id = t.id) as bank_accounts,
  (select count(*) from journal_entries where tenant_id = t.id) as journal_entries,
  (select count(*) from journal_lines jl join journal_entries je on je.id = jl.entry_id where je.tenant_id = t.id) as journal_lines,
  (select count(*) from fixed_assets where tenant_id = t.id) as fixed_assets,
  (select count(*) from depreciation_schedule where tenant_id = t.id) as depreciation_schedule,
  (select count(*) from expense_claims where tenant_id = t.id) as expense_claims,
  (select count(*) from expense_claim_items where tenant_id = t.id) as expense_claim_items,
  (select count(*) from payment_voucher_batches where tenant_id = t.id) as payment_voucher_batches,
  (select count(*) from payment_voucher_batch_lines where tenant_id = t.id) as payment_voucher_batch_lines
from tenants t
where t.code = 'DEMO';

-- ============================================================================
  if not exists (select 1 from tenants where code = 'DEMO') then
    raise exception 'tenant code DEMO not found — run Part 1 first';
  end if;

-- ---------- EMPLOYEES (4) ----------
insert into employees (id, tenant_id, name, ic_no, position, basic_salary, epf_no, socso_no,
  bank_name, bank_account_no, bank_account_name, phone, email, employment_status, join_date,
  probation_start_date, confirmed_at, staff_code)
select v.id, t.id, v.name, v.ic_no, v.position, v.basic_salary, v.epf_no, v.socso_no,
  v.bank_name, v.bank_account_no, v.name, v.phone, v.email, v.employment_status, v.join_date,
  v.join_date, v.confirmed_at, v.staff_code
from tenants t
cross join (values
  ('00000000-0000-0000-0301-000000000001'::uuid,'Siti Noraini binti Kamal','880512-10-5566','Sales Executive',2800::numeric,'EPF10001','SOC10001','Maybank','162001100001','+6012-6001001','siti.noraini@majutrading.my','permanent','2025-03-01'::date,'2025-03-01 10:00:00+08'::timestamptz,'EMP001'),
  ('00000000-0000-0000-0301-000000000002'::uuid,'Mohd Firdaus bin Rashid','900823-08-7711','Warehouse Supervisor',2500::numeric,'EPF10002','SOC10002','CIMB Bank','701234560002','+6012-6001002','firdaus.rashid@majutrading.my','permanent','2024-11-15'::date,'2024-11-15 10:00:00+08'::timestamptz,'EMP002'),
  ('00000000-0000-0000-0301-000000000003'::uuid,'Nurhidayah binti Zainal','970118-14-3322','Admin Executive',2300::numeric,'EPF10003','SOC10003','Maybank','162001100003',null,'nurhidayah.zainal@majutrading.my','probation','2026-08-01'::date,null,'EMP003'),
  ('00000000-0000-0000-0301-000000000004'::uuid,'Azman bin Yusof','850930-06-4455','Delivery Driver',2000::numeric,'EPF10004','SOC10004','Bank Islam','1201000400004',null,'azman.yusof@majutrading.my','permanent','2025-06-01'::date,'2025-06-01 10:00:00+08'::timestamptz,'EMP004')
) as v(id, name, ic_no, position, basic_salary, epf_no, socso_no, bank_name, bank_account_no, phone, email, employment_status, join_date, confirmed_at, staff_code)
where t.code = 'DEMO'
  and not exists (select 1 from employees e where e.id = v.id);

-- ---------- PAYROLL RECORDS (October 2026, 4 employees) ----------
insert into payroll_records (id, tenant_id, employee_id, month, year, basic_salary, epf_employee, epf_employer,
  socso_employee, socso_employer, eis_employee, eis_employer, pcb, net_pay, amount_paid, balance_outstanding, pay_date)
select v.id, t.id, v.employee_id, 10, 2026, v.basic_salary, v.epf_employee, v.epf_employer,
  v.socso_employee, v.socso_employer, v.eis_employee, v.eis_employee, 0, v.net_pay, v.net_pay, 0, '2026-10-28'::date
from tenants t
cross join (values
  ('00000000-0000-0000-0302-000000000001'::uuid,'00000000-0000-0000-0301-000000000001'::uuid,2800::numeric,308::numeric,364::numeric,14::numeric,49::numeric,6::numeric,2472::numeric),
  ('00000000-0000-0000-0302-000000000002'::uuid,'00000000-0000-0000-0301-000000000002'::uuid,2500::numeric,275::numeric,325::numeric,13::numeric,44::numeric,5::numeric,2207::numeric),
  ('00000000-0000-0000-0302-000000000003'::uuid,'00000000-0000-0000-0301-000000000003'::uuid,2300::numeric,253::numeric,299::numeric,12::numeric,40::numeric,5::numeric,2030::numeric),
  ('00000000-0000-0000-0302-000000000004'::uuid,'00000000-0000-0000-0301-000000000004'::uuid,2000::numeric,220::numeric,260::numeric,10::numeric,35::numeric,4::numeric,1766::numeric)
) as v(id, employee_id, basic_salary, epf_employee, epf_employer, socso_employee, socso_employer, eis_employee, net_pay)
where t.code = 'DEMO'
  and not exists (select 1 from payroll_records pr where pr.id = v.id);

-- ---------- ATTENDANCE (12 rows, 3 days x 4 employees) ----------
insert into attendance (id, tenant_id, employee_id, date, status)
select gen_random_uuid(), t.id, v.employee_id, v.date, v.status
from tenants t
cross join (values
  ('00000000-0000-0000-0301-000000000001'::uuid,'2026-10-13'::date,'present'),
  ('00000000-0000-0000-0301-000000000001'::uuid,'2026-10-14'::date,'present'),
  ('00000000-0000-0000-0301-000000000001'::uuid,'2026-10-15'::date,'late'),
  ('00000000-0000-0000-0301-000000000002'::uuid,'2026-10-13'::date,'present'),
  ('00000000-0000-0000-0301-000000000002'::uuid,'2026-10-14'::date,'present'),
  ('00000000-0000-0000-0301-000000000002'::uuid,'2026-10-15'::date,'present'),
  ('00000000-0000-0000-0301-000000000003'::uuid,'2026-10-13'::date,'present'),
  ('00000000-0000-0000-0301-000000000003'::uuid,'2026-10-14'::date,'on_leave'),
  ('00000000-0000-0000-0301-000000000003'::uuid,'2026-10-15'::date,'on_leave'),
  ('00000000-0000-0000-0301-000000000004'::uuid,'2026-10-13'::date,'present'),
  ('00000000-0000-0000-0301-000000000004'::uuid,'2026-10-14'::date,'present'),
  ('00000000-0000-0000-0301-000000000004'::uuid,'2026-10-15'::date,'present')
) as v(employee_id, date, status)
where t.code = 'DEMO'
  and not exists (select 1 from attendance a where a.tenant_id = t.id and a.employee_id = v.employee_id and a.date = v.date);

-- ---------- LEAVE REQUESTS (2) ----------
insert into leave_requests (id, tenant_id, employee_id, leave_type, start_date, end_date, days_count, status, approved_by)
select v.id, t.id, v.employee_id, v.leave_type, v.start_date, v.end_date, v.days_count, v.status,
  case when v.status = 'approved' then owner.id else null end
from tenants t
join user_profiles owner on owner.tenant_id = t.id and owner.role = 'owner'
cross join (values
  ('00000000-0000-0000-0304-000000000001'::uuid,'00000000-0000-0000-0301-000000000001'::uuid,'annual','2026-11-02'::date,'2026-11-04'::date,3::numeric,'approved'),
  ('00000000-0000-0000-0304-000000000002'::uuid,'00000000-0000-0000-0301-000000000003'::uuid,'medical','2026-10-14'::date,'2026-10-15'::date,2::numeric,'pending')
) as v(id, employee_id, leave_type, start_date, end_date, days_count, status)
where t.code = 'DEMO'
  and not exists (select 1 from leave_requests lr where lr.id = v.id);

-- ---------- JOB APPLICANTS (2) ----------
insert into job_applicants (id, tenant_id, ref_no, position_applied, full_name, gender, marital_status, status)
select v.id, t.id, v.ref_no, v.position_applied, v.full_name, v.gender, v.marital_status, v.status
from tenants t
cross join (values
  ('00000000-0000-0000-0305-000000000001'::uuid,'APP-2601-0001','Sales Executive','Khairul Anwar bin Salleh','male','single','interviewed'),
  ('00000000-0000-0000-0305-000000000002'::uuid,'APP-2601-0002','Admin Executive','Farah Liyana binti Ahmad','female','single','pending')
) as v(id, ref_no, position_applied, full_name, gender, marital_status, status)
where t.code = 'DEMO'
  and not exists (select 1 from job_applicants ja where ja.id = v.id);

-- ---------- SALES COMMISSION: link 2 of Part 2's paid invoices to Siti Noraini ----------
update invoices set sales_person_id = '00000000-0000-0000-0301-000000000001'::uuid
where id in ('00000000-0000-0000-0008-000000000002'::uuid,'00000000-0000-0000-0008-000000000004'::uuid)
  and sales_person_id is null;

insert into sales_commission_rules (id, tenant_id, sales_person_id, channel, rate_percent)
select '00000000-0000-0000-0306-000000000001'::uuid, t.id, '00000000-0000-0000-0301-000000000001'::uuid, 'retail', 3.00
from tenants t
where t.code = 'DEMO'
  and not exists (select 1 from sales_commission_rules r where r.id = '00000000-0000-0000-0306-000000000001'::uuid);

insert into sales_commissions (id, tenant_id, sales_person_id, source_type, source_id, source_item_id, channel,
  sale_amount, rate_applied, commission_amount, earned_month, earned_year, payout_month, payout_year, status)
select v.id, t.id, '00000000-0000-0000-0301-000000000001'::uuid, 'invoice', v.source_id, v.source_item_id, 'retail',
  v.sale_amount, 3.00, v.commission_amount, 9, 2026, 10, 2026, 'confirmed'
from tenants t
cross join (values
  ('00000000-0000-0000-0307-000000000001'::uuid,'00000000-0000-0000-0008-000000000002'::uuid,'00000000-0000-0000-0009-000000000003'::uuid,3200::numeric,96::numeric),
  ('00000000-0000-0000-0307-000000000002'::uuid,'00000000-0000-0000-0008-000000000004'::uuid,'00000000-0000-0000-0009-000000000009'::uuid,1800::numeric,54::numeric)
) as v(id, source_id, source_item_id, sale_amount, commission_amount)
where t.code = 'DEMO'
  and not exists (select 1 from sales_commissions sc where sc.id = v.id);

insert into sales_achievements (id, tenant_id, sales_person_id, badge_key, period_month, period_year)
select '00000000-0000-0000-0308-000000000001'::uuid, t.id, '00000000-0000-0000-0301-000000000001'::uuid, 'first_sale', 9, 2026
from tenants t
where t.code = 'DEMO'
  and not exists (select 1 from sales_achievements sa where sa.id = '00000000-0000-0000-0308-000000000001'::uuid);

-- ---------- PROJECTS (2) + TASKS (4) ----------
insert into projects (id, tenant_id, name, kind, customer_id, color)
select v.id, t.id, v.name, v.kind, v.customer_id, v.color
from tenants t
cross join (values
  ('00000000-0000-0000-0309-000000000001'::uuid,'Projek Pembekalan Tapak - Teguh Bina','client','00000000-0000-0000-0001-000000000007'::uuid,'#2563EB'),
  ('00000000-0000-0000-0309-000000000002'::uuid,'Peningkatan Proses Dalaman Q4','internal',null::uuid,'#7C3AED')
) as v(id, name, kind, customer_id, color)
where t.code = 'DEMO'
  and not exists (select 1 from projects p where p.id = v.id);

insert into project_tasks (id, tenant_id, project_id, title, column_key, assignee_employee_id, due_date, progress, sort_order)
select v.id, t.id, v.project_id, v.title, v.column_key, v.assignee_employee_id, v.due_date, v.progress, v.sort_order
from tenants t
cross join (values
  ('00000000-0000-0000-0310-000000000001'::uuid,'00000000-0000-0000-0309-000000000001'::uuid,'Sediakan senarai peralatan','done','00000000-0000-0000-0301-000000000002'::uuid,'2026-10-10'::date,100,1),
  ('00000000-0000-0000-0310-000000000002'::uuid,'00000000-0000-0000-0309-000000000001'::uuid,'Hantar & pasang di tapak','progress','00000000-0000-0000-0301-000000000004'::uuid,'2026-10-27'::date,60,2),
  ('00000000-0000-0000-0310-000000000003'::uuid,'00000000-0000-0000-0309-000000000002'::uuid,'Semak proses invois','backlog',null::uuid,'2026-11-05'::date,0,1),
  ('00000000-0000-0000-0310-000000000004'::uuid,'00000000-0000-0000-0309-000000000002'::uuid,'Automasi laporan jualan mingguan','review','00000000-0000-0000-0301-000000000003'::uuid,'2026-10-24'::date,80,2)
) as v(id, project_id, title, column_key, assignee_employee_id, due_date, progress, sort_order)
where t.code = 'DEMO'
  and not exists (select 1 from project_tasks pt where pt.id = v.id);

-- ---------- PLANNER (platform_activities, 2 entries for the demo owner) ----------
insert into platform_activities (id, owner_user_id, tenant_id, related_tenant_id, title, activity_type, status, due_at, starts_at, ends_at, notes)
select v.id, u.id, t.id, t.id, v.title, v.activity_type, 'open', v.due_at, v.starts_at, v.ends_at, v.notes
from tenants t
join auth.users u on u.email = 'demo.owner@mpflemedia.my'
cross join (values
  ('00000000-0000-0000-0311-000000000001'::uuid,'Panggilan susulan - invois tertunggak Koperasi Warga Maju','follow_up','2026-10-22 10:00:00+08'::timestamptz,null::timestamptz,null::timestamptz,'Baki belum jelas RM12,500 - INV-2601-0001'),
  ('00000000-0000-0000-0311-000000000002'::uuid,'Mesyuarat semakan jualan bulanan','appointment',null::timestamptz,'2026-10-25 14:00:00+08'::timestamptz,'2026-10-25 15:00:00+08'::timestamptz,'Semak prestasi jualan Oktober dengan pasukan')
) as v(id, title, activity_type, due_at, starts_at, ends_at, notes)
where t.code = 'DEMO'
  and not exists (select 1 from platform_activities pa where pa.id = v.id);

-- ---------- SALES PLAN (lightweight, financing disabled) ----------
insert into sales_plans (id, tenant_id, name, start_date, end_date, pic_employee_id, pic_name)
select '00000000-0000-0000-0312-000000000001'::uuid, t.id, 'Pelan Jualan Q4 2026', '2026-10-01'::date, '2026-12-31'::date,
  '00000000-0000-0000-0301-000000000001'::uuid, 'Siti Noraini binti Kamal'
from tenants t
where t.code = 'DEMO'
  and not exists (select 1 from sales_plans sp where sp.id = '00000000-0000-0000-0312-000000000001'::uuid);

insert into sales_plan_periods (id, tenant_id, plan_id, kind, label, start_date, end_date, gmv_target, units_target, orders_target)
select '00000000-0000-0000-0313-000000000001'::uuid, t.id, '00000000-0000-0000-0312-000000000001'::uuid, 'month', 'Oktober 2026', '2026-10-01'::date, '2026-10-31'::date, 50000::numeric, 500::numeric, 50::numeric
from tenants t
where t.code = 'DEMO'
  and not exists (select 1 from sales_plan_periods p where p.id = '00000000-0000-0000-0313-000000000001'::uuid);

insert into sales_plan_weeks (id, tenant_id, plan_id, period_id, code, start_date, end_date, gmv_target, units_target, orders_target)
select v.id, t.id, '00000000-0000-0000-0312-000000000001'::uuid, '00000000-0000-0000-0313-000000000001'::uuid, v.code, v.start_date, v.end_date, v.gmv_target, v.units_target, v.orders_target
from tenants t
cross join (values
  ('00000000-0000-0000-0314-000000000001'::uuid,'W01','2026-10-01'::date,'2026-10-07'::date,12500::numeric,125::numeric,12::numeric),
  ('00000000-0000-0000-0314-000000000002'::uuid,'W02','2026-10-08'::date,'2026-10-14'::date,12500::numeric,125::numeric,12::numeric)
) as v(id, code, start_date, end_date, gmv_target, units_target, orders_target)
where t.code = 'DEMO'
  and not exists (select 1 from sales_plan_weeks w where w.id = v.id);

insert into sales_plan_milestones (id, tenant_id, plan_id, code, title, due_date, metric, target)
select v.id, t.id, '00000000-0000-0000-0312-000000000001'::uuid, v.code, v.title, v.due_date, v.metric, v.target
from tenants t
cross join (values
  ('00000000-0000-0000-0315-000000000001'::uuid,'M1','Capai RM50,000 GMV Oktober','2026-10-31'::date,'rm',50000::numeric),
  ('00000000-0000-0000-0315-000000000002'::uuid,'M2','Capai 500 unit terjual Oktober','2026-10-31'::date,'units',500::numeric)
) as v(id, code, title, due_date, metric, target)
where t.code = 'DEMO'
  and not exists (select 1 from sales_plan_milestones m where m.id = v.id);

-- ---------- SANITY CHECK ----------
perform
  (select count(*) from employees where tenant_id = t.id) as employees,
  (select count(*) from payroll_records pr join employees e on e.id = pr.employee_id where e.tenant_id = t.id) as payroll_records,
  (select count(*) from attendance where tenant_id = t.id) as attendance,
  (select count(*) from leave_requests where tenant_id = t.id) as leave_requests,
  (select count(*) from job_applicants where tenant_id = t.id) as job_applicants,
  (select count(*) from sales_commission_rules where tenant_id = t.id) as sales_commission_rules,
  (select count(*) from sales_commissions where tenant_id = t.id) as sales_commissions,
  (select count(*) from sales_achievements where tenant_id = t.id) as sales_achievements,
  (select count(*) from projects where tenant_id = t.id) as projects,
  (select count(*) from project_tasks pt join projects p on p.id = pt.project_id where p.tenant_id = t.id) as project_tasks,
  (select count(*) from platform_activities where tenant_id = t.id) as planner_activities,
  (select count(*) from sales_plans where tenant_id = t.id) as sales_plans,
  (select count(*) from sales_plan_periods where tenant_id = t.id) as sales_plan_periods,
  (select count(*) from sales_plan_weeks where tenant_id = t.id) as sales_plan_weeks,
  (select count(*) from sales_plan_milestones where tenant_id = t.id) as sales_plan_milestones
from tenants t
where t.code = 'DEMO';

  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public._reseed_demo_data() to authenticated;

select public._reseed_demo_data();

drop function if exists public._reseed_demo_data();
