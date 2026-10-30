-- M-Core DK revamp — Phase 1 Sales (invoice, quotation, receipt, customer SOA, delivery order, credit note).
-- WRITE-ONLY: Mike runs this in the Supabase SQL editor AFTER dk_phase0_kit.sql. Rerun-safe (idempotent).
-- Adds: delivery_orders public "Confirm received" link columns, get_public_do / public_do_confirm (anon, token-hashed, rate limited),
--       roadmap rows for Phase 1 marked completed. Widen only; nothing is dropped or narrowed.

-- ---------- 1) delivery_orders: public confirm-received columns ----------
do $$
begin
  if to_regclass('public.delivery_orders') is null then raise notice 'delivery_orders missing - skipped'; return; end if;
  alter table public.delivery_orders add column if not exists public_token text;
  alter table public.delivery_orders add column if not exists received_by_name text;
  alter table public.delivery_orders add column if not exists received_at timestamptz;
  alter table public.delivery_orders add column if not exists received_note text;
  alter table public.delivery_orders add column if not exists delivered_at timestamptz;
  if not exists (select 1 from pg_constraint where conname = 'delivery_orders_received_len_chk') then
    alter table public.delivery_orders add constraint delivery_orders_received_len_chk
      check ((received_by_name is null or length(received_by_name) <= 120) and (received_note is null or length(received_note) <= 500)) not valid;
  end if;
end $$;

-- ---------- 2) helpers ----------
-- live link row for a raw token + doc type (null when unknown / revoked / expired)
create or replace function public.dk__pub_link(p_token text, p_type text)
returns table (id uuid, tenant_id uuid, doc_id uuid)
language sql stable security definer set search_path = public as $$
  select l.id, l.tenant_id, l.doc_id from public.doc_public_links l
  where p_token is not null and length(p_token) between 16 and 64
    and l.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
    and l.doc_type = p_type and l.revoked_at is null and l.deleted_at is null and l.expires_at > now()
  limit 1
$$;
revoke all on function public.dk__pub_link(text, text) from public, anon, authenticated;

-- ---------- 3) public DO page data ----------
create or replace function public.get_public_do(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare l record; d jsonb; t jsonb; items jsonb := '[]'::jsonb; inv_ref text; cust text; n int;
begin
  select * into l from public.dk__pub_link(p_token, 'do');
  if l.id is null then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  select to_jsonb(x) into d from public.delivery_orders x where x.id = l.doc_id and x.tenant_id = l.tenant_id and x.deleted_at is null;
  if d is null then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  select to_jsonb(x) into t from public.tenants x where x.id = l.tenant_id;
  if (d ->> 'customer_id') is not null then
    select c.name into cust from public.customers c where c.id = (d ->> 'customer_id')::uuid and c.tenant_id = l.tenant_id;
  end if;
  if (d ->> 'invoice_id') is not null then
    select i.ref_no into inv_ref from public.invoices i where i.id = (d ->> 'invoice_id')::uuid and i.tenant_id = l.tenant_id;
  end if;
  -- items: delivery_order_items when present, else the linked invoice lines (description + qty only, never prices)
  begin
    if to_regclass('public.delivery_order_items') is not null then
      execute 'select coalesce(jsonb_agg(jsonb_build_object(''d'', coalesce(description, ''''), ''q'', qty)), ''[]''::jsonb) from public.delivery_order_items where delivery_order_id = $1'
        into items using l.doc_id;
    end if;
  exception when others then items := '[]'::jsonb;
  end;
  if jsonb_array_length(items) = 0 and (d ->> 'invoice_id') is not null then
    select coalesce(jsonb_agg(jsonb_build_object('d', coalesce(ii.description, ''), 'q', ii.qty)), '[]'::jsonb) into items
    from public.invoice_items ii where ii.invoice_id = (d ->> 'invoice_id')::uuid;
  end if;
  -- view log (pre-marked notified so the inv/quo "Opened" poller ignores it); max 20 per link per 10 minutes
  select count(*) into n from public.doc_views v where v.link_id = l.id and v.viewed_at > now() - interval '10 minutes';
  if n < 20 then
    insert into public.doc_views (tenant_id, link_id, doc_type, doc_id, token, notified_at)
    values (l.tenant_id, l.id, 'do', l.doc_id, p_token, now());
  end if;
  return jsonb_build_object('ok', true,
    'company', jsonb_build_object('name', t ->> 'name', 'logo', t ->> 'logo_url', 'phone', t ->> 'phone',
      'address', concat_ws(', ', nullif(t ->> 'address', ''), nullif(t ->> 'postcode', ''), nullif(t ->> 'city', ''), nullif(t ->> 'state', ''))),
    'do', jsonb_build_object('no', d ->> 'do_no', 'date', d ->> 'created_at', 'status', d ->> 'status', 'address', d ->> 'delivery_address',
      'driver', d ->> 'driver_name', 'vehicle', d ->> 'vehicle_no', 'notes', d ->> 'notes', 'invoice', inv_ref, 'customer', cust,
      'received_by', d ->> 'received_by_name', 'received_at', d ->> 'received_at'),
    'items', items);
end;
$$;

-- ---------- 4) public "Confirm received" ----------
create or replace function public.public_do_confirm(p_token text, p_name text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare l record; d record; nm text := btrim(coalesce(p_name, '')); nt text := nullif(btrim(coalesce(p_note, '')), ''); sharer uuid; k int;
begin
  select * into l from public.dk__pub_link(p_token, 'do');
  if l.id is null then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  if length(nm) < 2 or length(nm) > 120 then return jsonb_build_object('ok', false, 'error', 'name'); end if;
  if nt is not null and length(nt) > 500 then nt := left(nt, 500); end if;
  -- rate limit: max 5 confirm attempts per link per 10 minutes
  select count(*) into k from public.dk_doc_events e
   where e.tenant_id = l.tenant_id and e.doc_type = 'do' and e.doc_id = l.doc_id and e.event = 'received' and e.created_at > now() - interval '10 minutes';
  if k >= 5 then return jsonb_build_object('ok', false, 'error', 'rate'); end if;
  select x.id, x.do_no, x.received_at, x.received_by_name into d from public.delivery_orders x
   where x.id = l.doc_id and x.tenant_id = l.tenant_id and x.deleted_at is null for update;
  if d.id is null then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  if d.received_at is not null then
    return jsonb_build_object('ok', true, 'already', true, 'received_by', d.received_by_name, 'received_at', d.received_at);
  end if;
  update public.delivery_orders set status = 'delivered', delivered_at = coalesce(delivered_at, now()),
    received_by_name = nm, received_at = now(), received_note = nt
  where id = d.id and tenant_id = l.tenant_id;
  -- signature slot 'received' (via link)
  update public.dk_signatures set signer_name = nm, signed_at = now(), note = nt, via = 'link', signer_user_id = null
   where tenant_id = l.tenant_id and doc_type = 'do' and doc_id = d.id and slot = 'received' and deleted_at is null;
  if not found then
    insert into public.dk_signatures (tenant_id, doc_type, doc_id, slot, signer_name, note, signed_at, via)
    values (l.tenant_id, 'do', d.id, 'received', nm, nt, now(), 'link');
  end if;
  insert into public.dk_doc_events (tenant_id, doc_type, doc_id, event, actor_name, note) values (l.tenant_id, 'do', d.id, 'received', nm, nt);
  -- notify owner/admin/manager + whoever last shared this DO (no amounts in the text)
  select s.created_by into sharer from public.doc_shares s where s.tenant_id = l.tenant_id and s.doc_type = 'do' and s.doc_id = d.id
   order by s.created_at desc limit 1;
  perform public.dk__notify(l.tenant_id, array['owner', 'admin', 'manager'], case when sharer is null then null else array[sharer] end, null,
    'Delivery received: ' || coalesce(d.do_no, 'DO'), 'Penghantaran diterima: ' || coalesce(d.do_no, 'DO'),
    'Confirmed by ' || nm, 'Disahkan oleh ' || nm, 'logistics.do_received',
    jsonb_build_object('page', 'logistics', 'params', jsonb_build_object('view', 'do-detail', 'id', d.id)), 'delivery_orders', d.id);
  return jsonb_build_object('ok', true, 'received_by', nm, 'received_at', now());
end;
$$;

grant execute on function public.get_public_do(text) to anon, authenticated;
grant execute on function public.public_do_confirm(text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';

-- ---------- 5) roadmap ----------
do $$
declare r record;
begin
  if to_regclass('public.dev_roadmap_items') is null then return; end if;
  for r in select * from (values
    ('DK Phase 1 — Sales cards & documents', 'Invoice, quotation, delivery order and credit note lists as cards; invoice / DO / CN / customer SOA card documents with print + PDF; official receipt per payment (PDF + WhatsApp); DO public "Confirm received" link with signer name and owner bell.', 'sales')
  ) v(title, descr, module) loop
    update public.dev_roadmap_items set stage = 'completed', module = r.module, description = r.descr where title = r.title;
    if not found then
      insert into public.dev_roadmap_items (title, description, module, stage) values (r.title, r.descr, r.module, 'completed');
    end if;
  end loop;
end $$;
