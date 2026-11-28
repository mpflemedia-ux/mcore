-- M-Core · Delivery Order signatures, PV style (draw pad + WhatsApp link). DO only; other DK docs untouched.
-- WRITE-ONLY: Mike runs this in the Supabase SQL editor. Idempotent / rerun-safe. Needs dk_phase0_kit.sql + dk_phase1_sales.sql.
-- 1) delivery_order_items table (repo copy of what was already run live)
-- 2) dk_signatures.storage_path (drawn signature PNG in bucket doc-files)
-- 3) dk_do_sign_links: per-slot public sign links (Delivered by). Received by keeps the DO confirm link (doc_public_links).
-- 4) RPCs: dk_do_sign_state, dk_do_sign, dk_do_sign_reset, dk_do_sign_link_create, get_public_do (+tid/sigs), get_public_do_sign,
--    public_do_confirm (NO status change any more), public_do_sign
-- 5) storage policies for {tenant}/do-signatures/{do_id}/... (app) and {tenant}/do-sign/{token_hash}/... (public)
-- Status 'delivered' stays MANUAL: no function here changes delivery_orders.status or delivered_at.

-- ---------- 1) delivery_order_items ----------
do $$
begin
  if to_regclass('public.delivery_orders') is null then raise notice 'delivery_orders missing - skipped items'; return; end if;
  create table if not exists public.delivery_order_items (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null,
    delivery_order_id uuid not null references public.delivery_orders(id) on delete cascade,
    product_id uuid,
    description text,
    qty numeric not null default 0,
    created_at timestamptz not null default now());
  alter table public.delivery_order_items add column if not exists product_id uuid;
  alter table public.delivery_order_items add column if not exists description text;
  alter table public.delivery_order_items add column if not exists created_at timestamptz not null default now();
  create index if not exists delivery_order_items_do_idx on public.delivery_order_items (delivery_order_id);
  alter table public.delivery_order_items enable row level security;
  drop policy if exists delivery_order_items_tenant on public.delivery_order_items;
  create policy delivery_order_items_tenant on public.delivery_order_items for all to authenticated
    using (tenant_id = public.get_my_tenant_id() or public.is_platform_admin())
    with check (tenant_id = public.get_my_tenant_id() or public.is_platform_admin());
  drop policy if exists platform_admin_all on public.delivery_order_items;
  create policy platform_admin_all on public.delivery_order_items for all to authenticated
    using (public.is_platform_admin()) with check (public.is_platform_admin());
  grant select, insert, update, delete on public.delivery_order_items to authenticated;
  grant all on public.delivery_order_items to service_role;
  revoke all on public.delivery_order_items from anon;
end $$;

-- ---------- 2) dk_signatures.storage_path ----------
alter table public.dk_signatures add column if not exists storage_path text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'dk_signatures_storage_path_chk') then
    alter table public.dk_signatures add constraint dk_signatures_storage_path_chk
      check (storage_path is null or (length(storage_path) between 10 and 300 and storage_path ~ '\.png$')) not valid;
  end if;
end $$;

-- ---------- 3) per-slot public sign links ----------
create table if not exists public.dk_do_sign_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  doc_id uuid not null,
  slot text not null check (slot in ('delivered', 'received')),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null default (now() + interval '30 days'),
  revoked_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now());
create index if not exists dk_do_sign_links_doc_idx on public.dk_do_sign_links (tenant_id, doc_id, slot);
alter table public.dk_do_sign_links enable row level security;
drop policy if exists dk_do_sign_links_read on public.dk_do_sign_links;
create policy dk_do_sign_links_read on public.dk_do_sign_links for select to authenticated using (tenant_id = public.get_my_tenant_id() or public.is_platform_admin());
drop policy if exists platform_admin_all on public.dk_do_sign_links;
create policy platform_admin_all on public.dk_do_sign_links for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
revoke all on public.dk_do_sign_links from anon;
grant select on public.dk_do_sign_links to authenticated;
grant all on public.dk_do_sign_links to service_role;

-- ---------- 4) helpers ----------
-- live dk_do_sign_links row for a raw token
create or replace function public.dk__do_sign_link(p_token text)
returns table (id uuid, tenant_id uuid, doc_id uuid, slot text, token_hash text, created_by uuid)
language sql stable security definer set search_path = public as $$
  select l.id, l.tenant_id, l.doc_id, l.slot, l.token_hash, l.created_by from public.dk_do_sign_links l
  where p_token is not null and length(p_token) between 16 and 64
    and l.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
    and l.revoked_at is null and l.expires_at > now()
  limit 1
$$;
revoke all on function public.dk__do_sign_link(text) from public, anon, authenticated;

-- storage insert check for public uploads: {tenant}/do-sign/{token_hash}/... must match a live DO link of that tenant
create or replace function public.dk_do_sign_path_ok(p_tid text, p_hash text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(p_hash ~ '^[0-9a-f]{64}$', false) and (
    exists (select 1 from public.dk_do_sign_links l where l.token_hash = p_hash and l.tenant_id::text = p_tid
             and l.revoked_at is null and l.expires_at > now())
    or exists (select 1 from public.doc_public_links l where l.token_hash = p_hash and l.tenant_id::text = p_tid and l.doc_type = 'do'
             and l.revoked_at is null and l.deleted_at is null and l.expires_at > now()))
$$;

-- shared public payload (no prices, no phones of customers): company, DO, items, slot status
create or replace function public.dk__do_pub_payload(p_tid uuid, p_doc uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare d jsonb; t jsonb; items jsonb := '[]'::jsonb; inv_ref text; cust text; sigs jsonb;
begin
  select to_jsonb(x) into d from public.delivery_orders x where x.id = p_doc and x.tenant_id = p_tid and x.deleted_at is null;
  if d is null then return null; end if;
  select to_jsonb(x) into t from public.tenants x where x.id = p_tid;
  if (d ->> 'customer_id') is not null then
    select c.name into cust from public.customers c where c.id = (d ->> 'customer_id')::uuid and c.tenant_id = p_tid;
  end if;
  if (d ->> 'invoice_id') is not null then
    select i.ref_no into inv_ref from public.invoices i where i.id = (d ->> 'invoice_id')::uuid and i.tenant_id = p_tid;
  end if;
  begin
    if to_regclass('public.delivery_order_items') is not null then
      execute 'select coalesce(jsonb_agg(jsonb_build_object(''d'', coalesce(description, ''''), ''q'', qty) order by created_at), ''[]''::jsonb) from public.delivery_order_items where delivery_order_id = $1'
        into items using p_doc;
    end if;
  exception when others then items := '[]'::jsonb;
  end;
  if jsonb_array_length(items) = 0 and (d ->> 'invoice_id') is not null then
    select coalesce(jsonb_agg(jsonb_build_object('d', coalesce(ii.description, ''), 'q', ii.qty)), '[]'::jsonb) into items
    from public.invoice_items ii where ii.invoice_id = (d ->> 'invoice_id')::uuid;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('slot', s.slot, 'ord', s.ord, 'label_en', s.label_en, 'label_bm', s.label_bm,
           'signer_name', g.signer_name, 'signed_at', g.signed_at) order by s.ord), '[]'::jsonb)
    into sigs
  from public.dk__slots('do') s
  left join public.dk_signatures g on g.tenant_id = p_tid and g.doc_type = 'do' and g.doc_id = p_doc and g.slot = s.slot
    and g.deleted_at is null and g.signed_at is not null;
  return jsonb_build_object('tid', p_tid,
    'company', jsonb_build_object('name', t ->> 'name', 'logo', t ->> 'logo_url', 'phone', t ->> 'phone',
      'address', concat_ws(', ', nullif(t ->> 'address', ''), nullif(t ->> 'postcode', ''), nullif(t ->> 'city', ''), nullif(t ->> 'state', ''))),
    'do', jsonb_build_object('no', d ->> 'do_no', 'date', d ->> 'created_at', 'status', d ->> 'status', 'address', d ->> 'delivery_address',
      'driver', d ->> 'driver_name', 'vehicle', d ->> 'vehicle_no', 'notes', d ->> 'notes', 'invoice', inv_ref, 'customer', cust,
      'received_by', d ->> 'received_by_name', 'received_at', d ->> 'received_at'),
    'items', items, 'sigs', sigs);
end;
$$;
revoke all on function public.dk__do_pub_payload(uuid, uuid) from public, anon, authenticated;

-- one signing core for app + link. Never touches status / delivered_at.
create or replace function public.dk__do_sign_core(p_tid uuid, p_doc uuid, p_slot text, p_name text, p_path text, p_note text,
  p_via text, p_user uuid, p_prefix text, p_need_path boolean, p_notify_extra uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d record; s record; nm text := btrim(coalesce(p_name, '')); nt text := left(nullif(btrim(coalesce(p_note, '')), ''), 500);
  pth text := nullif(btrim(coalesce(p_path, '')), ''); req uuid; done int; total int; k int; ref text;
begin
  select * into s from public.dk__slots('do') x where x.slot = p_slot;
  if s.slot is null then return jsonb_build_object('ok', false, 'error', 'slot'); end if;
  if length(nm) < 2 or length(nm) > 120 then return jsonb_build_object('ok', false, 'error', 'name'); end if;
  if pth is null and p_need_path then return jsonb_build_object('ok', false, 'error', 'signature'); end if;
  if pth is not null then
    if left(pth, length(p_prefix)) <> p_prefix or pth !~ '\.png$' or length(pth) > 300 or pth ~ '\.\.' then
      return jsonb_build_object('ok', false, 'error', 'path');
    end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'doc-files' and o.name = pth) then
      return jsonb_build_object('ok', false, 'error', 'upload');
    end if;
  end if;
  select x.id, x.do_no, x.received_at into d from public.delivery_orders x
   where x.id = p_doc and x.tenant_id = p_tid and x.deleted_at is null for update;
  if d.id is null then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  ref := coalesce(d.do_no, 'DO');
  if exists (select 1 from public.dk_signatures g where g.tenant_id = p_tid and g.doc_type = 'do' and g.doc_id = p_doc and g.slot = p_slot
             and g.deleted_at is null and g.signed_at is not null) then
    return jsonb_build_object('ok', true, 'already', true);
  end if;
  insert into public.dk_signatures (tenant_id, doc_type, doc_id, slot, signer_user_id, signer_name, note, signed_at, via, storage_path)
  values (p_tid, 'do', p_doc, p_slot, p_user, nm, nt, now(), p_via, pth)
  on conflict (tenant_id, doc_type, doc_id, slot) where deleted_at is null
  do update set signer_user_id = p_user, signer_name = nm, note = nt, signed_at = now(), via = p_via, storage_path = pth
  returning requested_by into req;
  if p_slot = 'received' then
    update public.delivery_orders set received_by_name = nm, received_at = coalesce(received_at, now()), received_note = coalesce(nt, received_note)
     where id = p_doc and tenant_id = p_tid;
  end if;
  insert into public.dk_doc_events (tenant_id, doc_type, doc_id, event, actor_id, actor_name, note)
  values (p_tid, 'do', p_doc, case when p_slot = 'received' then 'received' else 'signed' end, p_user, nm, p_slot || case when p_via = 'link' then ' (link)' else '' end);
  select count(*) filter (where g.signed_at is not null), count(*) into done, total
  from public.dk__slots('do') x left join public.dk_signatures g on g.tenant_id = p_tid and g.doc_type = 'do' and g.doc_id = p_doc and g.slot = x.slot and g.deleted_at is null;
  -- bell + push: owner/admin/manager + requester + link creator; actor never notifies self; no amounts
  k := public.dk__notify(p_tid, array['owner', 'admin', 'manager'],
    (select array_agg(u) from unnest(array[req, p_notify_extra]) u where u is not null), p_user,
    'Signed · ' || ref, 'Ditandatangani · ' || ref,
    nm || ' signed "' || s.label_en || '" (' || done || '/' || total || ').',
    nm || ' menandatangani "' || s.label_bm || '" (' || done || '/' || total || ').',
    case when p_slot = 'received' then 'logistics.do_received' else 'approval.dk_signed' end, jsonb_build_object('page', 'logistics', 'params', jsonb_build_object('view', 'do-detail', 'id', p_doc, 'hl', p_doc), 'icon', 'ti-signature'),
    'delivery_orders', p_doc, 'dk_sign:' || p_doc);
  return jsonb_build_object('ok', true, 'done', done, 'total', total, 'signer_name', nm, 'signed_at', now());
end;
$$;
revoke all on function public.dk__do_sign_core(uuid, uuid, text, text, text, text, text, uuid, text, boolean, uuid) from public, anon, authenticated;

-- ---------- 5) app RPCs ----------
create or replace function public.dk_do_sign_state(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t uuid := public.dk__tid(); bm boolean; st text;
begin
  if t is null or not public.dk__can('logistics') then return null; end if;
  select x.status into st from public.delivery_orders x where x.id = p_id and x.tenant_id = t and x.deleted_at is null;
  if not found then return null; end if;
  select lower(coalesce(language, '')) = 'bm' into bm from public.user_profiles where id = auth.uid();
  return jsonb_build_object('doc_id', p_id, 'status', st, 'can_reset', public.dk__role() in ('owner', 'admin', 'platform_admin'),
    'slots', coalesce((
      select jsonb_agg(jsonb_build_object('slot', s.slot, 'ord', s.ord,
        'label', case when bm then s.label_bm else s.label_en end, 'label_en', s.label_en, 'label_bm', s.label_bm,
        'signed_at', g.signed_at, 'signer_name', g.signer_name, 'via', g.via, 'note', g.note, 'storage_path', g.storage_path,
        'requested_at', g.requested_at,
        'link_at', (select max(l.created_at) from public.dk_do_sign_links l where l.tenant_id = t and l.doc_id = p_id and l.slot = s.slot and l.revoked_at is null),
        'can', g.signed_at is null) order by s.ord)
      from public.dk__slots('do') s
      left join public.dk_signatures g on g.tenant_id = t and g.doc_type = 'do' and g.doc_id = p_id and g.slot = s.slot and g.deleted_at is null), '[]'::jsonb));
end;
$$;

create or replace function public.dk_do_sign(p_id uuid, p_slot text, p_name text, p_path text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t uuid := public.dk__tid(); r jsonb;
begin
  if t is null then raise exception 'not signed in'; end if;
  if not public.dk__can('logistics') then raise exception 'no access'; end if;
  r := public.dk__do_sign_core(t, p_id, p_slot, p_name, p_path, p_note, 'app', auth.uid(),
         t::text || '/do-signatures/' || p_id::text || '/', true, null);
  if coalesce((r ->> 'ok')::boolean, false) is false then raise exception '%', coalesce(r ->> 'error', 'sign failed'); end if;
  if coalesce((r ->> 'already')::boolean, false) then raise exception 'already signed'; end if;
  return r || jsonb_build_object('state', public.dk_do_sign_state(p_id));
end;
$$;

-- owner/admin: clear one slot (or both). Clearing Received also clears received_* so the confirm link works again. Status untouched.
create or replace function public.dk_do_sign_reset(p_id uuid, p_slot text default null, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t uuid := public.dk__tid(); n int;
begin
  if t is null or public.dk__role() not in ('owner', 'admin', 'platform_admin') then raise exception 'owner/admin only'; end if;
  if not exists (select 1 from public.delivery_orders x where x.id = p_id and x.tenant_id = t and x.deleted_at is null) then raise exception 'document not found'; end if;
  if p_slot is not null and p_slot not in ('delivered', 'received') then raise exception 'unknown slot'; end if;
  update public.dk_signatures set deleted_at = now()
   where tenant_id = t and doc_type = 'do' and doc_id = p_id and deleted_at is null and (p_slot is null or slot = p_slot);
  get diagnostics n = row_count;
  update public.dk_do_sign_links set revoked_at = now()
   where tenant_id = t and doc_id = p_id and revoked_at is null and (p_slot is null or slot = p_slot);
  if p_slot is null or p_slot = 'received' then
    update public.delivery_orders set received_by_name = null, received_at = null, received_note = null where id = p_id and tenant_id = t;
  end if;
  insert into public.dk_doc_events (tenant_id, doc_type, doc_id, event, actor_id, note)
  values (t, 'do', p_id, 'reset', auth.uid(), left(coalesce(p_slot, 'all') || coalesce(': ' || p_reason, ''), 500));
  return jsonb_build_object('ok', true, 'cleared', n, 'state', public.dk_do_sign_state(p_id));
end;
$$;

-- per-slot public link (used for Delivered by; Received by uses the DO confirm link)
create or replace function public.dk_do_sign_link_create(p_id uuid, p_slot text default 'delivered') returns jsonb
language plpgsql security definer set search_path = public as $$
declare t uuid := public.dk__tid(); tok text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''); l public.dk_do_sign_links%rowtype; nm text;
begin
  if t is null then raise exception 'not signed in'; end if;
  if not public.dk__can('logistics') then raise exception 'no access'; end if;
  if p_slot is null or p_slot not in ('delivered', 'received') then raise exception 'unknown slot'; end if;
  if not exists (select 1 from public.delivery_orders x where x.id = p_id and x.tenant_id = t and x.deleted_at is null) then raise exception 'document not found'; end if;
  if exists (select 1 from public.dk_signatures g where g.tenant_id = t and g.doc_type = 'do' and g.doc_id = p_id and g.slot = p_slot and g.deleted_at is null and g.signed_at is not null) then
    raise exception 'already signed';
  end if;
  insert into public.dk_do_sign_links (tenant_id, doc_id, slot, token_hash, created_by)
  values (t, p_id, p_slot, encode(sha256(convert_to(tok, 'UTF8')), 'hex'), auth.uid()) returning * into l;
  select full_name into nm from public.user_profiles where id = auth.uid();
  insert into public.dk_doc_events (tenant_id, doc_type, doc_id, event, actor_id, actor_name, note) values (t, 'do', p_id, 'shared', auth.uid(), nm, 'sign link: ' || p_slot);
  return jsonb_build_object('token', tok, 'link_id', l.id, 'expires_at', l.expires_at, 'slot', p_slot);
end;
$$;

-- ---------- 6) public RPCs ----------
-- DO confirm link (doc_public_links): same output as before + tid, sigs, slot = 'received'
create or replace function public.get_public_do(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare l record; p jsonb; n int;
begin
  select * into l from public.dk__pub_link(p_token, 'do');
  if l.id is null then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  p := public.dk__do_pub_payload(l.tenant_id, l.doc_id);
  if p is null then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  select count(*) into n from public.doc_views v where v.link_id = l.id and v.viewed_at > now() - interval '10 minutes';
  if n < 20 then
    insert into public.doc_views (tenant_id, link_id, doc_type, doc_id, token, notified_at)
    values (l.tenant_id, l.id, 'do', l.doc_id, p_token, now());
  end if;
  return p || jsonb_build_object('ok', true, 'slot', 'received', 'hash', encode(sha256(convert_to(p_token, 'UTF8')), 'hex'));
end;
$$;

-- per-slot sign link (dk_do_sign_links)
create or replace function public.get_public_do_sign(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare l record; p jsonb;
begin
  select * into l from public.dk__do_sign_link(p_token);
  if l.id is null then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  p := public.dk__do_pub_payload(l.tenant_id, l.doc_id);
  if p is null then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  return p || jsonb_build_object('ok', true, 'slot', l.slot, 'hash', l.token_hash);
end;
$$;

-- rate limit shared by both public sign RPCs: max 10 sign events per DO per 10 minutes
create or replace function public.dk__do_pub_rate(p_tid uuid, p_doc uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select count(*) < 10 from public.dk_doc_events e
   where e.tenant_id = p_tid and e.doc_type = 'do' and e.doc_id = p_doc and e.event in ('received', 'signed') and e.created_at > now() - interval '10 minutes'
$$;
revoke all on function public.dk__do_pub_rate(uuid, uuid) from public, anon, authenticated;

-- Received by via the DO confirm link. Records signature + received_by_name/received_at ONLY (status stays manual).
drop function if exists public.public_do_confirm(text, text, text);
create or replace function public.public_do_confirm(p_token text, p_name text, p_note text default null, p_path text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare l record; h text; sharer uuid; r jsonb; ra timestamptz; rb text;
begin
  select * into l from public.dk__pub_link(p_token, 'do');
  if l.id is null then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  select x.received_at, x.received_by_name into ra, rb from public.delivery_orders x where x.id = l.doc_id and x.tenant_id = l.tenant_id and x.deleted_at is null;
  if ra is not null then return jsonb_build_object('ok', true, 'already', true, 'received_by', rb, 'received_at', ra); end if;
  if not public.dk__do_pub_rate(l.tenant_id, l.doc_id) then return jsonb_build_object('ok', false, 'error', 'rate'); end if;
  h := encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
  select s.created_by into sharer from public.doc_shares s where s.tenant_id = l.tenant_id and s.doc_type = 'do' and s.doc_id = l.doc_id
   order by s.created_at desc limit 1;
  r := public.dk__do_sign_core(l.tenant_id, l.doc_id, 'received', p_name, p_path, p_note, 'link', null,
         l.tenant_id::text || '/do-sign/' || h || '/', false, sharer);
  if coalesce((r ->> 'ok')::boolean, false) and not coalesce((r ->> 'already')::boolean, false) then
    return jsonb_build_object('ok', true, 'received_by', r ->> 'signer_name', 'received_at', r ->> 'signed_at');
  end if;
  return r;
end;
$$;

-- per-slot link sign (Delivered by). Drawn signature required.
create or replace function public.public_do_sign(p_token text, p_name text, p_path text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare l record;
begin
  select * into l from public.dk__do_sign_link(p_token);
  if l.id is null then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  if not public.dk__do_pub_rate(l.tenant_id, l.doc_id) then return jsonb_build_object('ok', false, 'error', 'rate'); end if;
  return public.dk__do_sign_core(l.tenant_id, l.doc_id, l.slot, p_name, p_path, p_note, 'link', null,
           l.tenant_id::text || '/do-sign/' || l.token_hash || '/', true, l.created_by);
end;
$$;

-- ---------- 7) grants ----------
grant execute on function public.dk_do_sign_path_ok(text, text) to anon, authenticated;
grant execute on function public.dk_do_sign_state(uuid) to authenticated;
grant execute on function public.dk_do_sign(uuid, text, text, text, text) to authenticated;
grant execute on function public.dk_do_sign_reset(uuid, text, text) to authenticated;
grant execute on function public.dk_do_sign_link_create(uuid, text) to authenticated;
revoke all on function public.dk_do_sign_state(uuid) from public, anon;
revoke all on function public.dk_do_sign(uuid, text, text, text, text) from public, anon;
revoke all on function public.dk_do_sign_reset(uuid, text, text) from public, anon;
revoke all on function public.dk_do_sign_link_create(uuid, text) from public, anon;
grant execute on function public.get_public_do(text) to anon, authenticated;
grant execute on function public.get_public_do_sign(text) to anon, authenticated;
grant execute on function public.public_do_confirm(text, text, text, text) to anon, authenticated;
grant execute on function public.public_do_sign(text, text, text, text) to anon, authenticated;

-- ---------- 8) storage (bucket doc-files, private). Read for staff = existing doc_files_read (tenant folder). ----------
drop policy if exists doc_files_dosig_app_ins on storage.objects;
create policy doc_files_dosig_app_ins on storage.objects for insert to authenticated with check (
  bucket_id = 'doc-files'
  and (storage.foldername(name))[1] = public.get_my_tenant_id()::text
  and (storage.foldername(name))[2] = 'do-signatures');
drop policy if exists doc_files_dosig_pub_ins on storage.objects;
create policy doc_files_dosig_pub_ins on storage.objects for insert to anon, authenticated with check (
  bucket_id = 'doc-files'
  and (storage.foldername(name))[2] = 'do-sign'
  and public.dk_do_sign_path_ok((storage.foldername(name))[1], (storage.foldername(name))[3]));

notify pgrst, 'reload schema';

-- ---------- 9) roadmap ----------
update public.dev_roadmap_items set stage = 'completed', module = 'logistics',
  description = 'Delivery Order signatures PV style: 2 slots (Delivered by / Received by) with N/2 counter, draw pad in app + public link, WhatsApp send link, signature images on DO print/PDF, status stays manual.'
where title = 'DO signatures: draw pad + WhatsApp link (PV style)';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'DO signatures: draw pad + WhatsApp link (PV style)',
  'Delivery Order signatures PV style: 2 slots (Delivered by / Received by) with N/2 counter, draw pad in app + public link, WhatsApp send link, signature images on DO print/PDF, status stays manual.',
  'logistics', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'DO signatures: draw pad + WhatsApp link (PV style)');
