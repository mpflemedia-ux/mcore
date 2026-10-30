-- M-Core DK kit (cards / doc / share / sign) — Phase 0 shared kit.
-- WRITE-ONLY: Mike runs this in the Supabase SQL editor. Rerun-safe (idempotent). Run BEFORE dk_phase1..5 and dk_cron.sql.
-- Adds: dk__can / dk__tid helpers, dk_signatures (generic signature/approval slots), dk_doc_events (accept/decline/received/paid/reminder log),
--       widened doc_shares / wa_templates / doc_public_links / doc_views checks (widen, never shrink; NOT VALID),
--       dk_sign_request / dk_sign / dk_sign_reset / dk_sign_state RPCs, dk_remind_run() (cron + on-open, once per day per document).
-- No amounts of salary are ever put in a notification. Every function is tenant-scoped (no cross-tenant reads).

-- ---------- 1) helpers ----------
create or replace function public.dk__tid() returns uuid
language sql stable security definer set search_path = public as $$
  select p.tenant_id from public.user_profiles p where p.id = auth.uid() and coalesce(p.is_active, true)
$$;

create or replace function public.dk__role() returns text
language sql stable security definer set search_path = public as $$
  select lower(coalesce(p.role, '')) from public.user_profiles p where p.id = auth.uid()
$$;

-- module access: owner/admin/platform_admin always; else has_module() when it exists; else plain tenant membership (has_module is missing on some live DBs)
create or replace function public.dk__can(p_mod text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare r text := public.dk__role(); ok boolean;
begin
  if auth.uid() is null or public.dk__tid() is null then return false; end if;
  if p_mod = 'core' then return true; end if;
  if r in ('owner', 'admin', 'platform_admin') then return true; end if;
  begin
    execute 'select public.has_module($1)' into ok using p_mod;
    return coalesce(ok, false);
  exception when undefined_function then
    return true;
  end;
end;
$$;

-- approver roles for 'admin' slots
create or replace function public.dk__is_approver() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.dk__role() in ('owner', 'admin', 'platform_admin', 'manager', 'finance', 'hr', 'accountant', 'supervisor'), false)
$$;

-- doc_type -> (table, module key for has_module, page, view, ref column). module 'core' = any tenant member (staff self-service docs)
create or replace function public.dk__doc(p_type text)
returns table (tbl text, module text, page text, view text, refcol text)
language sql immutable as $$
  select v.tbl, v.module, v.page, v.view, v.refcol from (values
    ('inv',   'invoices',             'sales',      'sales',         'inv-detail',  'ref_no'),
    ('quo',   'quotations',           'sales',      'sales',         'quo-form',    'ref_no'),
    ('do',    'delivery_orders',      'logistics',  'logistics',     'do-detail',   'do_no'),
    ('cn',    'credit_notes',         'sales',      'sales',         'cn',          'ref_no'),
    ('po',    'purchase_orders',      'purchasing', 'purchasing',    'po-detail',   'po_no'),
    ('bill',  'supplier_bills',       'purchasing', 'purchasing',    'bill-detail', 'bill_no'),
    ('grn',   'goods_received_notes', 'purchasing', 'purchasing',    '',            'grn_no'),
    ('exp',   'expense_claims',       'core',       'accounting',    'expense',     ''),
    ('leave', 'leave_requests',       'core',       'hr',            'leave',       ''),
    ('ot',    'ot_claims',            'core',       'hr',            'ot-approvals',''),
    ('adv',   'cash_advances',        'core',       'hr',            'advance',     ''),
    ('wo',    'work_orders',          'production', 'production',    'wo-detail',   '')
  ) v(k, tbl, module, page, view, refcol)
  where v.k = p_type
$$;

-- slots per doc_type: who = 'any' (any tenant member with module access) | 'approver' (dk__is_approver)
create or replace function public.dk__slots(p_type text)
returns table (slot text, ord int, who text, label_en text, label_bm text)
language sql immutable as $$
  select s.slot, s.ord, s.who, s.en, s.bm from (values
    ('quo','prepared',1,'any','Prepared by','Disediakan oleh'), ('quo','approved',2,'approver','Approved by','Diluluskan oleh'),
    ('do','delivered',1,'any','Delivered by','Dihantar oleh'),  ('do','received',2,'any','Received by','Diterima oleh'),
    ('cn','prepared',1,'any','Prepared by','Disediakan oleh'),  ('cn','approved',2,'approver','Approved by','Diluluskan oleh'),
    ('po','prepared',1,'any','Prepared by','Disediakan oleh'),  ('po','approved',2,'approver','Approved by','Diluluskan oleh'),
    ('grn','received',1,'any','Received by','Diterima oleh'),   ('grn','checked',2,'approver','Checked by','Disemak oleh'),
    ('bill','verified',1,'any','Verified by','Disahkan oleh'),  ('bill','approved',2,'approver','Approved for payment','Diluluskan untuk bayaran'),
    ('exp','claimant',1,'any','Claimant','Penuntut'),           ('exp','approved',2,'approver','Approved by','Diluluskan oleh'),
    ('leave','applicant',1,'any','Applicant','Pemohon'),        ('leave','approved',2,'approver','Approved by','Diluluskan oleh'),
    ('ot','claimant',1,'any','Claimant','Penuntut'),            ('ot','approved',2,'approver','Approved by','Diluluskan oleh'),
    ('adv','requested',1,'any','Requested by','Dipohon oleh'),  ('adv','approved',2,'approver','Approved by','Diluluskan oleh'),
    ('wo','issued',1,'any','Issued by','Dikeluarkan oleh'),     ('wo','completed',2,'any','Completed by','Disiapkan oleh')
  ) s(k, slot, ord, who, en, bm) where s.k = p_type
$$;

-- doc belongs to my tenant? returns its ref text (or null when not found / other tenant)
create or replace function public.dk__doc_ref(p_type text, p_id uuid, p_tid uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare d record; r text;
begin
  select * into d from public.dk__doc(p_type);
  if d.tbl is null or to_regclass('public.' || d.tbl) is null then return null; end if;
  begin
    if d.refcol <> '' then
      execute format('select coalesce(%I::text, ''#'') from public.%I where id = $1 and tenant_id = $2', d.refcol, d.tbl) into r using p_id, p_tid;
    else
      execute format('select ''#'' from public.%I where id = $1 and tenant_id = $2', d.tbl) into r using p_id, p_tid;
    end if;
  exception when undefined_column then
    execute format('select ''#'' from public.%I where id = $1 and tenant_id = $2', d.tbl) into r using p_id, p_tid;
  end;
  return r;
end;
$$;

-- notify every active user with one of p_roles (or p_users) in the tenant, except the actor; BM text when the user language is bm
create or replace function public.dk__notify(p_tid uuid, p_roles text[], p_users uuid[], p_actor uuid,
  p_title_en text, p_title_bm text, p_body_en text, p_body_bm text, p_type text, p_link jsonb, p_ref_table text, p_ref_id uuid, p_group text default null)
returns int language plpgsql security definer set search_path = public as $$
declare k int;
begin
  insert into public.notifications (tenant_id, user_id, title, body, category, kind, type, priority, link, ref_table, ref_id)
  select p_tid, u.id,
    case when lower(coalesce(u.language, '')) = 'bm' then p_title_bm else p_title_en end,
    case when lower(coalesce(u.language, '')) = 'bm' then p_body_bm else p_body_en end,
    split_part(p_type, '.', 1), 'action', p_type, 1, p_link, p_ref_table, p_ref_id
  from public.user_profiles u
  where u.tenant_id = p_tid and coalesce(u.is_active, true)
    and (p_actor is null or u.id <> p_actor)
    and ((p_roles is not null and lower(coalesce(u.role, '')) = any(p_roles)) or (p_users is not null and u.id = any(p_users)));
  get diagnostics k = row_count;
  return k;
end;
$$;

-- ---------- 2) tables ----------
create table if not exists public.dk_signatures (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  doc_type text not null check (length(doc_type) between 1 and 16),
  doc_id uuid not null,
  slot text not null check (length(slot) between 1 and 24),
  requested_at timestamptz,
  requested_by uuid,
  requested_user uuid,
  signer_user_id uuid,
  signer_name text check (signer_name is null or length(signer_name) <= 120),
  note text check (note is null or length(note) <= 500),
  signed_at timestamptz,
  via text not null default 'app' check (via in ('app', 'link')),
  last_reminded_on date,
  created_at timestamptz not null default now(),
  deleted_at timestamptz);
create unique index if not exists dk_signatures_live_uq on public.dk_signatures (tenant_id, doc_type, doc_id, slot) where deleted_at is null;
create index if not exists dk_signatures_pending_idx on public.dk_signatures (tenant_id) where signed_at is null and deleted_at is null;
alter table public.dk_signatures enable row level security;
drop policy if exists dk_signatures_read on public.dk_signatures;
create policy dk_signatures_read on public.dk_signatures for select to authenticated using (deleted_at is null and tenant_id = public.dk__tid());
-- writes only through the security-definer RPCs below
grant select on public.dk_signatures to authenticated;

create table if not exists public.dk_doc_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  doc_type text not null check (length(doc_type) between 1 and 16),
  doc_id uuid,
  event text not null check (event in ('accepted', 'declined', 'received', 'paid', 'reminder', 'signed', 'requested', 'reset', 'viewed', 'shared')),
  day date not null default ((now() at time zone 'Asia/Kuala_Lumpur')::date),
  actor_id uuid,
  actor_name text check (actor_name is null or length(actor_name) <= 120),
  note text check (note is null or length(note) <= 500),
  created_at timestamptz not null default now());
create index if not exists dk_doc_events_doc_idx on public.dk_doc_events (doc_type, doc_id, created_at);
-- one reminder per document per day (cron + on-open both use on conflict do nothing)
create unique index if not exists dk_doc_events_remind_uq on public.dk_doc_events (tenant_id, doc_type, coalesce(doc_id, '00000000-0000-0000-0000-000000000000'::uuid), day, coalesce(note, '')) where event = 'reminder';
alter table public.dk_doc_events enable row level security;
drop policy if exists dk_doc_events_read on public.dk_doc_events;
create policy dk_doc_events_read on public.dk_doc_events for select to authenticated using (tenant_id = public.dk__tid());
drop policy if exists dk_doc_events_ins on public.dk_doc_events;
create policy dk_doc_events_ins on public.dk_doc_events for insert to authenticated with check (
  tenant_id = public.dk__tid() and actor_id = auth.uid() and event in ('shared', 'viewed', 'paid', 'accepted', 'declined'));
grant select, insert on public.dk_doc_events to authenticated;

-- ---------- 3) widen checks (never shrink; NOT VALID so old rows are untouched) ----------
do $$
declare
  r record; c record; vals text[];
  dt text[] := array['rcpt', 'soa', 'do', 'cn', 'leave', 'ot', 'exp', 'adv', 'po', 'bill', 'grn', 'ssoa', 'wo', 'comm'];
  tp text[] := array['rcpt_send', 'soa_send', 'do_send', 'do_remind', 'cn_send', 'leave_result', 'ot_result', 'exp_result', 'adv_result',
                     'po_send', 'bill_remit', 'grn_send', 'ssoa_send', 'wo_send', 'comm_send', 'sign_req'];
begin
  for r in
    select * from (values
      ('public.doc_shares', 'doc_type', dt),
      ('public.doc_shares', 'template', tp),
      ('public.wa_templates', 'doc_type', dt),
      ('public.wa_templates', 'template_key', tp),
      ('public.doc_public_links', 'doc_type', array['do']),
      ('public.doc_views', 'doc_type', array['do'])
    ) as t(tbl, colname, add_vals)
  loop
    if to_regclass(r.tbl) is null then continue; end if;
    for c in
      select pg_get_constraintdef(k.oid) as def, k.conname from pg_constraint k
      where k.conrelid = r.tbl::regclass and k.contype = 'c'
        and pg_get_constraintdef(k.oid) ~ ('\m' || r.colname || '\M')
        and pg_get_constraintdef(k.oid) !~* 'length'
    loop
      select array_agg(distinct m[1]) into vals from regexp_matches(c.def, '''([^'']+)''', 'g') m;
      if vals is null then continue; end if;
      if (select bool_and(x = any(vals)) from unnest(r.add_vals) x) then continue; end if;
      vals := (select array_agg(distinct x) from unnest(vals || r.add_vals) x);
      execute format('alter table %s drop constraint %I', r.tbl, c.conname);
      execute format('alter table %s add constraint %I check (%I is null or %I in (%s)) not valid', r.tbl, c.conname, r.colname, r.colname,
        (select string_agg(quote_literal(x), ', ' order by x) from unnest(vals) x));
    end loop;
  end loop;
end $$;

-- ---------- 4) signature RPCs ----------
create or replace function public.dk_sign_state(p_type text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t uuid := public.dk__tid(); bm boolean;
begin
  if t is null or public.dk__doc_ref(p_type, p_id, t) is null then return null; end if;
  select lower(coalesce(language, '')) = 'bm' into bm from public.user_profiles where id = auth.uid();
  return jsonb_build_object('doc_type', p_type, 'doc_id', p_id, 'approver', public.dk__is_approver(), 'slots', coalesce((
    select jsonb_agg(jsonb_build_object('slot', s.slot, 'ord', s.ord, 'who', s.who,
      'label', case when bm then s.label_bm else s.label_en end,
      'signed_at', g.signed_at, 'signer_name', g.signer_name, 'via', g.via, 'note', g.note,
      'requested_at', g.requested_at, 'requested_user', g.requested_user,
      'can', g.signed_at is null and (s.who = 'any' or public.dk__is_approver())) order by s.ord)
    from public.dk__slots(p_type) s
    left join public.dk_signatures g on g.tenant_id = t and g.doc_type = p_type and g.doc_id = p_id and g.slot = s.slot and g.deleted_at is null), '[]'::jsonb));
end;
$$;

-- request a signature (creates the pending slot) and notify the signer (named user, or every approver for approver slots)
create or replace function public.dk_sign_request(p_type text, p_id uuid, p_slot text, p_user uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t uuid := public.dk__tid(); s record; d record; ref text; nm text; n int := 0;
begin
  if t is null then raise exception 'not signed in'; end if;
  select * into d from public.dk__doc(p_type);
  if d.tbl is null or not public.dk__can(d.module) then raise exception 'no access'; end if;
  ref := public.dk__doc_ref(p_type, p_id, t);
  if ref is null then raise exception 'document not found'; end if;
  select * into s from public.dk__slots(p_type) x where x.slot = p_slot;
  if s.slot is null then raise exception 'unknown slot'; end if;
  if p_user is not null and not exists (select 1 from public.user_profiles where id = p_user and tenant_id = t) then raise exception 'user not in tenant'; end if;
  insert into public.dk_signatures (tenant_id, doc_type, doc_id, slot, requested_at, requested_by, requested_user)
  values (t, p_type, p_id, p_slot, now(), auth.uid(), p_user)
  on conflict (tenant_id, doc_type, doc_id, slot) where deleted_at is null
  do update set requested_at = now(), requested_by = auth.uid(), requested_user = coalesce(excluded.requested_user, dk_signatures.requested_user)
  where dk_signatures.signed_at is null;
  select full_name into nm from public.user_profiles where id = auth.uid();
  insert into public.dk_doc_events (tenant_id, doc_type, doc_id, event, actor_id, actor_name, note) values (t, p_type, p_id, 'requested', auth.uid(), nm, p_slot);
  n := public.dk__notify(t,
    case when p_user is null and s.who = 'approver' then array['owner', 'admin', 'manager', 'finance', 'hr'] else null end,
    case when p_user is not null then array[p_user] else null end, auth.uid(),
    'Signature needed · ' || coalesce(nullif(ref, '#'), upper(p_type)), 'Tandatangan diperlukan · ' || coalesce(nullif(ref, '#'), upper(p_type)),
    coalesce(nm, 'A teammate') || ' asks you to sign as "' || s.label_en || '". Tap to review and sign.',
    coalesce(nm, 'Rakan sepasukan') || ' minta anda tandatangan sebagai "' || s.label_bm || '". Ketik untuk semak dan tandatangan.',
    'approval.dk_sign', jsonb_build_object('page', d.page, 'params', jsonb_build_object('view', d.view, 'id', p_id, 'hl', p_id, 'sign', p_slot), 'icon', 'ti-signature'),
    d.tbl, p_id, 'dk_sign:' || p_id);
  return jsonb_build_object('ok', true, 'notified', n, 'state', public.dk_sign_state(p_type, p_id));
end;
$$;

create or replace function public.dk_sign(p_type text, p_id uuid, p_slot text, p_name text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t uuid := public.dk__tid(); s record; d record; ref text; nxt record; done int; total int; req uuid;
begin
  if t is null then raise exception 'not signed in'; end if;
  select * into d from public.dk__doc(p_type);
  if d.tbl is null or not public.dk__can(d.module) then raise exception 'no access'; end if;
  ref := public.dk__doc_ref(p_type, p_id, t);
  if ref is null then raise exception 'document not found'; end if;
  select * into s from public.dk__slots(p_type) x where x.slot = p_slot;
  if s.slot is null then raise exception 'unknown slot'; end if;
  if s.who = 'approver' and not public.dk__is_approver() then raise exception 'approver role required'; end if;
  if coalesce(length(trim(p_name)), 0) < 2 then raise exception 'name required'; end if;
  if exists (select 1 from public.dk_signatures where tenant_id = t and doc_type = p_type and doc_id = p_id and slot = p_slot and deleted_at is null and signed_at is not null) then
    raise exception 'already signed';
  end if;
  insert into public.dk_signatures (tenant_id, doc_type, doc_id, slot, signer_user_id, signer_name, note, signed_at, via)
  values (t, p_type, p_id, p_slot, auth.uid(), left(trim(p_name), 120), left(p_note, 500), now(), 'app')
  on conflict (tenant_id, doc_type, doc_id, slot) where deleted_at is null
  do update set signer_user_id = auth.uid(), signer_name = left(trim(p_name), 120), note = left(p_note, 500), signed_at = now(), via = 'app'
  returning requested_by into req;
  insert into public.dk_doc_events (tenant_id, doc_type, doc_id, event, actor_id, actor_name, note) values (t, p_type, p_id, 'signed', auth.uid(), left(trim(p_name), 120), p_slot);
  select count(*) filter (where g.signed_at is not null), count(*) into done, total
  from public.dk__slots(p_type) x left join public.dk_signatures g on g.tenant_id = t and g.doc_type = p_type and g.doc_id = p_id and g.slot = x.slot and g.deleted_at is null;
  -- tell the requester (when someone else) that the slot is signed
  if req is not null then
    perform public.dk__notify(t, null, array[req], auth.uid(),
      'Signed · ' || coalesce(nullif(ref, '#'), upper(p_type)), 'Ditandatangani · ' || coalesce(nullif(ref, '#'), upper(p_type)),
      left(trim(p_name), 60) || ' signed "' || s.label_en || '" (' || done || '/' || total || ').',
      left(trim(p_name), 60) || ' menandatangani "' || s.label_bm || '" (' || done || '/' || total || ').',
      'approval.dk_signed', jsonb_build_object('page', d.page, 'params', jsonb_build_object('view', d.view, 'id', p_id, 'hl', p_id), 'icon', 'ti-signature'),
      d.tbl, p_id, 'dk_sign:' || p_id);
  end if;
  return jsonb_build_object('ok', true, 'done', done, 'total', total, 'state', public.dk_sign_state(p_type, p_id));
end;
$$;

create or replace function public.dk_sign_reset(p_type text, p_id uuid, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t uuid := public.dk__tid(); n int;
begin
  if t is null or public.dk__role() not in ('owner', 'admin', 'platform_admin') then raise exception 'owner/admin only'; end if;
  if public.dk__doc_ref(p_type, p_id, t) is null then raise exception 'document not found'; end if;
  update public.dk_signatures set deleted_at = now() where tenant_id = t and doc_type = p_type and doc_id = p_id and deleted_at is null;
  get diagnostics n = row_count;
  insert into public.dk_doc_events (tenant_id, doc_type, doc_id, event, actor_id, note) values (t, p_type, p_id, 'reset', auth.uid(), left(p_reason, 500));
  return jsonb_build_object('ok', true, 'cleared', n);
end;
$$;

-- ---------- 5) reminders: overdue invoices, unanswered quotations, pending signers ----------
-- Once per day per document (dk_doc_events unique). One digest notification per tenant per kind per day for invoices/quotations,
-- one per pending signature slot per day. App calls it on open (own tenant only); dk_cron.sql runs it daily for all tenants.
create or replace function public.dk_remind_run() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  tid uuid := case when auth.uid() is null then null else public.dk__tid() end;
  today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  r record; n_inv int := 0; n_quo int := 0; n_sig int := 0; k int; d record; ref text;
begin
  if auth.uid() is not null and tid is null then return jsonb_build_object('ok', false); end if;

  -- 5a) overdue invoices (balance > 0, due date passed, not paid/void/draft)
  if to_regclass('public.invoices') is not null then
    begin
      for r in execute $q$
        select i.tenant_id, count(*) n, string_agg(coalesce(i.ref_no, '?'), ', ' order by i.due_date) filter (where rn <= 3) refs, array_agg(i.id) ids
        from (select i.*, row_number() over (partition by i.tenant_id order by i.due_date) rn from public.invoices i
              where i.deleted_at is null and i.due_date < $1
                and lower(coalesce(i.status, '')) not in ('paid', 'void', 'voided', 'cancelled', 'draft', 'written_off')
                and coalesce(i.total, 0) - coalesce(i.paid_amt, 0) > 0.005
                and ($2::uuid is null or i.tenant_id = $2)
                and not exists (select 1 from public.dk_doc_events e where e.tenant_id = i.tenant_id and e.doc_type = 'inv' and e.doc_id = i.id and e.event = 'reminder' and e.day = $1)) i
        group by i.tenant_id $q$ using today, tid
      loop
        insert into public.dk_doc_events (tenant_id, doc_type, doc_id, event, day, note)
        select r.tenant_id, 'inv', x, 'reminder', today, 'overdue' from unnest(r.ids) x on conflict do nothing;
        perform public.dk__notify(r.tenant_id, array['owner', 'admin', 'finance', 'accountant'], null, null,
          r.n || ' overdue invoice' || case when r.n > 1 then 's' else '' end, r.n || ' invois tertunggak',
          'Past due: ' || r.refs || case when r.n > 3 then ' +' || (r.n - 3) else '' end || '. Tap to send WhatsApp reminders.',
          'Lewat tempoh: ' || r.refs || case when r.n > 3 then ' +' || (r.n - 3) else '' end || '. Ketik untuk hantar peringatan WhatsApp.',
          'finance.dk_overdue', jsonb_build_object('page', 'reports', 'params', jsonb_build_object('view', 'ar-aging'), 'icon', 'ti-alarm'),
          'invoices', null, 'dk_overdue:' || today);
        n_inv := n_inv + r.n;
      end loop;
    exception when undefined_column or undefined_table then null;
    end;
  end if;

  -- 5b) quotations sent 3+ days ago with no customer response
  if to_regclass('public.quotations') is not null then
    begin
      for r in execute $q$
        select q.tenant_id, count(*) n, string_agg(coalesce(q.ref_no, '?'), ', ') filter (where rn <= 3) refs, array_agg(q.id) ids
        from (select q.*, row_number() over (partition by q.tenant_id order by q.created_at) rn from public.quotations q
              where q.deleted_at is null
                and lower(coalesce(q.status, '')) not in ('converted', 'accepted', 'declined', 'rejected', 'cancelled', 'void', 'expired')
                and q.created_at < now() - interval '3 days'
                and (q.valid_until is null or q.valid_until >= $1)
                and (lower(coalesce(q.status, '')) = 'sent'
                     or (to_regclass('public.doc_shares') is not null and exists (select 1 from public.doc_shares ds where ds.doc_type = 'quo' and ds.doc_id = q.id and ds.deleted_at is null and ds.created_at < now() - interval '3 days')))
                and ($2::uuid is null or q.tenant_id = $2)
                and (to_regclass('public.doc_responses') is null or not exists (select 1 from public.doc_responses dr where dr.doc_id = q.id and dr.deleted_at is null))
                and not exists (select 1 from public.dk_doc_events e where e.tenant_id = q.tenant_id and e.doc_type = 'quo' and e.doc_id = q.id and e.event = 'reminder' and e.day = $1)) q
        group by q.tenant_id $q$ using today, tid
      loop
        insert into public.dk_doc_events (tenant_id, doc_type, doc_id, event, day, note)
        select r.tenant_id, 'quo', x, 'reminder', today, 'unanswered' from unnest(r.ids) x on conflict do nothing;
        perform public.dk__notify(r.tenant_id, array['owner', 'admin', 'sales', 'manager'], null, null,
          r.n || ' quotation' || case when r.n > 1 then 's' else '' end || ' awaiting reply', r.n || ' sebut harga menunggu jawapan',
          'No answer yet: ' || r.refs || case when r.n > 3 then ' +' || (r.n - 3) else '' end || '. Tap to follow up on WhatsApp.',
          'Belum dijawab: ' || r.refs || case when r.n > 3 then ' +' || (r.n - 3) else '' end || '. Ketik untuk susulan WhatsApp.',
          'sales.dk_quo_followup', jsonb_build_object('page', 'sales', 'params', jsonb_build_object('tab', 'quotations'), 'icon', 'ti-message-circle'),
          'quotations', null, 'dk_quo:' || today);
        n_quo := n_quo + r.n;
      end loop;
    exception when undefined_column or undefined_table then null;
    end;
  end if;

  -- 5c) pending signature slots requested 24h+ ago
  for r in
    select g.* from public.dk_signatures g
    where g.deleted_at is null and g.signed_at is null and g.requested_at < now() - interval '24 hours'
      and (tid is null or g.tenant_id = tid) and (g.last_reminded_on is null or g.last_reminded_on < today)
  loop
    select * into d from public.dk__doc(r.doc_type);
    if d.tbl is null then continue; end if;
    ref := public.dk__doc_ref(r.doc_type, r.doc_id, r.tenant_id);
    if ref is null then continue; end if;
    insert into public.dk_doc_events (tenant_id, doc_type, doc_id, event, day, note) values (r.tenant_id, r.doc_type, r.doc_id, 'reminder', today, 'sign:' || r.slot) on conflict do nothing;
    get diagnostics k = row_count;
    update public.dk_signatures set last_reminded_on = today where id = r.id;
    if k = 0 then continue; end if;
    perform public.dk__notify(r.tenant_id,
      case when r.requested_user is null and exists (select 1 from public.dk__slots(r.doc_type) s where s.slot = r.slot and s.who = 'approver') then array['owner', 'admin', 'manager', 'finance', 'hr'] else null end,
      case when r.requested_user is not null then array[r.requested_user] else case when r.requested_by is not null and not exists (select 1 from public.dk__slots(r.doc_type) s where s.slot = r.slot and s.who = 'approver') then array[r.requested_by] else null end end,
      null,
      'Signature reminder · ' || coalesce(nullif(ref, '#'), upper(r.doc_type)), 'Peringatan tandatangan · ' || coalesce(nullif(ref, '#'), upper(r.doc_type)),
      'Still waiting for the "' || (select s.label_en from public.dk__slots(r.doc_type) s where s.slot = r.slot) || '" signature. Tap to sign.',
      'Masih menunggu tandatangan "' || (select s.label_bm from public.dk__slots(r.doc_type) s where s.slot = r.slot) || '". Ketik untuk tandatangan.',
      'approval.dk_sign_remind', jsonb_build_object('page', d.page, 'params', jsonb_build_object('view', d.view, 'id', r.doc_id, 'hl', r.doc_id, 'sign', r.slot), 'icon', 'ti-bell-ringing'),
      d.tbl, r.doc_id, 'dk_sign:' || r.doc_id);
    n_sig := n_sig + 1;
  end loop;

  return jsonb_build_object('ok', true, 'invoices', n_inv, 'quotations', n_quo, 'signatures', n_sig);
end;
$$;

revoke all on function public.dk_remind_run() from public, anon;
grant execute on function public.dk_remind_run() to authenticated;
grant execute on function public.dk_sign_state(text, uuid) to authenticated;
grant execute on function public.dk_sign_request(text, uuid, text, uuid) to authenticated;
grant execute on function public.dk_sign(text, uuid, text, text, text) to authenticated;
grant execute on function public.dk_sign_reset(text, uuid, text) to authenticated;
revoke all on function public.dk__notify(uuid, text[], uuid[], uuid, text, text, text, text, text, jsonb, text, uuid, text) from public, anon, authenticated;
revoke all on function public.dk__doc_ref(text, uuid, uuid) from public, anon, authenticated;

notify pgrst, 'reload schema';

-- ---------- 6) roadmap ----------
update public.dev_roadmap_items set stage = 'completed', module = 'platform',
  description = 'DK kit: cards at all widths (search, status/date chips, lazy 20 + infinite scroll, swipe actions, bulk select + queued WhatsApp share, deep-link highlight, timeline), light A4 print + PDF builder, WhatsApp share registry with tenant EN/BM templates, generic signature/approval slots, daily reminders.'
where title = 'DK kit: cards, documents, share, signatures';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'DK kit: cards, documents, share, signatures',
  'DK kit: cards at all widths (search, status/date chips, lazy 20 + infinite scroll, swipe actions, bulk select + queued WhatsApp share, deep-link highlight, timeline), light A4 print + PDF builder, WhatsApp share registry with tenant EN/BM templates, generic signature/approval slots, daily reminders.',
  'platform', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'DK kit: cards, documents, share, signatures');
