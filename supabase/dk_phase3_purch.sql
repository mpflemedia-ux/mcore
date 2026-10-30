-- dk_phase3_purch.sql — DK Phase 3 · Purchasing (PO, GRN, Supplier bills, Supplier payments)
-- WRITE-ONLY artefact: review, then run once in the Supabase SQL editor AFTER dk_phase0_kit.sql (+ phase 1/2). Idempotent.
-- Bell + push notifications via public.dk__notify (Phase 0) — same tenant only, actor excluded, one row per event per recipient:
--   purchase_orders  status → partial | received | cancelled  → owner/admin/manager/purchasing + PO creator
--   goods_received_notes INSERT                              → owner/admin/manager/purchasing/finance/accountant + PO creator
--   supplier_bills INSERT                                    → owner/admin/finance/accountant
--   supplier_payments INSERT                                 → owner/admin/finance/accountant
-- Titles/bodies carry document numbers + supplier name only (no amounts). Deep links open the PO / bill detail.
-- Columns read through to_jsonb(NEW); every failure is swallowed (warning) so purchasing writes never break.

create or replace function public.dk__purch_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  k text := TG_ARGV[0]; n jsonb := to_jsonb(NEW); tid uuid; rid uuid; actor uuid; st text; ost text;
  typ text; lnk jsonb; roles text[]; users uuid[]; sup text := ''; ref text := ''; poref text := ''; po uuid; creator uuid; bill jsonb;
  t_en text; t_bm text; b_en text; b_bm text;
begin
  begin
    tid := nullif(n->>'tenant_id', '')::uuid; rid := nullif(n->>'id', '')::uuid;
    if tid is null or rid is null or to_regprocedure('public.dk__notify(uuid,text[],uuid[],uuid,text,text,text,text,text,jsonb,text,uuid,text)') is null then return NEW; end if;
    actor := auth.uid();
    if nullif(n->>'supplier_id', '') is not null and to_regclass('public.suppliers') is not null then
      select coalesce(s.name, '') into sup from public.suppliers s where s.id = (n->>'supplier_id')::uuid and s.tenant_id = tid;
    end if;
    if k = 'po' then
      if TG_OP <> 'UPDATE' then return NEW; end if;
      st := lower(coalesce(n->>'status', '')); ost := lower(coalesce(to_jsonb(OLD)->>'status', ''));
      if st = ost or st not in ('partial', 'received', 'cancelled') then return NEW; end if;
      ref := coalesce(n->>'po_no', 'PO'); po := rid;
      typ := 'purchasing.po_' || st;
      roles := array['owner', 'admin', 'manager', 'purchasing'];
      t_en := 'PO ' || ref || ' ' || case st when 'partial' then 'partially received' when 'received' then 'fully received' else 'cancelled' end;
      t_bm := 'PO ' || ref || ' ' || case st when 'partial' then 'diterima separa' when 'received' then 'diterima sepenuhnya' else 'dibatalkan' end;
      b_en := coalesce(nullif(sup, ''), 'Tap to view.'); b_bm := coalesce(nullif(sup, ''), 'Ketik untuk lihat.');
      lnk := jsonb_build_object('page', 'purchasing', 'params', jsonb_build_object('view', 'po-detail', 'id', rid));
      begin creator := nullif(n->>'created_by', '')::uuid; exception when others then creator := null; end;
    elsif k = 'grn' then
      if TG_OP <> 'INSERT' then return NEW; end if;
      ref := coalesce(n->>'grn_no', 'GRN'); po := nullif(n->>'po_id', '')::uuid;
      if po is not null then
        select to_jsonb(p) into bill from public.purchase_orders p where p.id = po and p.tenant_id = tid;
        poref := coalesce(bill->>'po_no', '');
        begin creator := nullif(bill->>'created_by', '')::uuid; exception when others then creator := null; end;
      end if;
      typ := 'purchasing.grn_new';
      roles := array['owner', 'admin', 'manager', 'purchasing', 'finance', 'accountant'];
      t_en := 'Goods received: ' || ref; t_bm := 'Barang diterima: ' || ref;
      b_en := concat_ws(' · ', nullif(poref, ''), nullif(sup, '')); b_bm := b_en;
      lnk := case when po is not null then jsonb_build_object('page', 'purchasing', 'params', jsonb_build_object('view', 'po-detail', 'id', po))
                  else jsonb_build_object('page', 'purchasing', 'params', jsonb_build_object('view', 'po')) end;
    elsif k = 'bill' then
      if TG_OP <> 'INSERT' then return NEW; end if;
      ref := coalesce(n->>'bill_no', n->>'ref_no', 'Bill');
      typ := 'purchasing.bill_new'; roles := array['owner', 'admin', 'finance', 'accountant'];
      t_en := 'New supplier bill: ' || ref; t_bm := 'Bil pembekal baharu: ' || ref;
      b_en := concat_ws(' · ', nullif(sup, ''), case when n->>'due_date' is not null then 'due ' || (n->>'due_date') end);
      b_bm := concat_ws(' · ', nullif(sup, ''), case when n->>'due_date' is not null then 'tamat ' || (n->>'due_date') end);
      lnk := jsonb_build_object('page', 'purchasing', 'params', jsonb_build_object('view', 'bill-detail', 'id', rid));
    elsif k = 'spay' then
      if TG_OP <> 'INSERT' or nullif(n->>'bill_id', '') is null then return NEW; end if;
      select to_jsonb(b) into bill from public.supplier_bills b where b.id = (n->>'bill_id')::uuid and b.tenant_id = tid;
      if bill is null then return NEW; end if;
      ref := coalesce(bill->>'bill_no', bill->>'ref_no', 'Bill');
      if nullif(bill->>'supplier_id', '') is not null then select coalesce(s.name, '') into sup from public.suppliers s where s.id = (bill->>'supplier_id')::uuid and s.tenant_id = tid; end if;
      typ := 'purchasing.bill_paid'; roles := array['owner', 'admin', 'finance', 'accountant'];
      t_en := 'Supplier payment recorded: ' || ref; t_bm := 'Bayaran pembekal direkod: ' || ref;
      b_en := concat_ws(' · ', nullif(sup, ''), n->>'payment_date'); b_bm := b_en;
      lnk := jsonb_build_object('page', 'purchasing', 'params', jsonb_build_object('view', 'bill-detail', 'id', (n->>'bill_id')::uuid));
    else return NEW; end if;
    if creator is not null and exists (select 1 from public.user_profiles p where p.id = creator and p.tenant_id = tid) then users := array[creator]; end if;
    if exists (select 1 from public.notifications x where x.tenant_id = tid and x.ref_id = rid and x.type = typ and x.created_at > now() - interval '60 seconds') then return NEW; end if;
    perform public.dk__notify(tid, roles, users, actor, t_en, t_bm,
      coalesce(nullif(b_en, ''), 'Tap to view.'), coalesce(nullif(b_bm, ''), 'Ketik untuk lihat.'), typ, lnk, TG_TABLE_NAME, rid, typ || ':' || rid);
  exception when others then
    raise warning 'dk__purch_notify(%): %', k, sqlerrm;
  end;
  return NEW;
end;
$$;
revoke all on function public.dk__purch_notify() from public, anon, authenticated;

do $$
declare r record;
begin
  for r in select * from (values ('purchase_orders', 'po', 'update'), ('goods_received_notes', 'grn', 'insert'), ('supplier_bills', 'bill', 'insert'), ('supplier_payments', 'spay', 'insert')) v(tbl, k, ev) loop
    if to_regclass('public.' || r.tbl) is null then raise notice 'dk phase3: table % missing — skipped', r.tbl; continue; end if;
    execute format('drop trigger if exists dk_purch_notify on public.%I', r.tbl);
    execute format('create trigger dk_purch_notify after %s on public.%I for each row execute function public.dk__purch_notify(%L)', r.ev, r.tbl, r.k);
  end loop;
end $$;

do $$
begin
  if to_regclass('public.dev_roadmap_items') is null then return; end if;
  update public.dev_roadmap_items set stage = 'completed' where title = 'DK Phase 3 — Purchasing cards & documents';
  if not found then
    insert into public.dev_roadmap_items (title, description, module, stage)
    values ('DK Phase 3 — Purchasing cards & documents', 'PO / Bill / Supplier card lists (all widths); PO document card + prepared/approved signatures; GRN slips (received/checked); bill voucher (verified/approved-for-payment) + remittance advice; supplier SOA PDF; purchasing bell + push notifications (no amounts).', 'purchasing', 'completed');
  end if;
end $$;
