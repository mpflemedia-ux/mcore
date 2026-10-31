-- notif_audit_01.sql — Notification audit & badge fix (bell badge 17 that "Mark read" never cleared)
-- WRITE-ONLY: review, then run ONCE in the Supabase SQL Editor (after dk_phase0..4). Idempotent: safe to re-run.
-- No has_module(), no user_profiles.email. Every table / function is guarded (to_regclass / to_regprocedure).
--
-- What it fixes
--  A) dk__staff_notify / dk__purch_notify / dk__ops_notify compared notifications.ref_id (TEXT) = rid (UUID)
--     -> "operator does not exist: text = uuid" -> caught by the exception block -> NO staff / purchasing / ops
--     bell or push was ever written. Fixed with rid::text.
--  B) dk__notify wrote EVERY row as kind='action', priority 1 (even "PO received", "Leave approved") so the bell
--     badge counted info rows as to-dos. Now: action only for things that need a decision, others for_you;
--     group_key + actor_id are stored; 1 event = 1 row per recipient (10-min group_key guard).
--  C) Outstation requests had no DB notification (client-only). Added to the same trigger (hr.os_*).
--  D) When a leave / OT / claim / advance / outstation leaves pending, the approvers' action rows are closed
--     (acted_at) so they stop counting.
--  E) Backfill (see section 6).

-- ---------- 1) kind / priority per DK type ----------
create or replace function public.dk__notif_kind(p_type text)
returns text language sql immutable as $$
  select case when coalesce(p_type, '') ~ '_submitted$'
    or p_type in ('approval.dk_sign', 'approval.dk_sign_remind', 'finance.dk_ap_due', 'finance.dk_overdue',
                  'sales.dk_quo_followup', 'inventory.wo_assigned', 'hr.applicant_new')
    then 'action' else 'for_you' end
$$;
create or replace function public.dk__notif_prio(p_type text)
returns smallint language sql immutable as $$
  select (case when coalesce(p_type, '') ~ '(_remind|overdue)$' then 1 else 0 end)::smallint
$$;

-- ---------- 2) dk__notify: same signature, correct kind, group_key, actor_id, no duplicates ----------
create or replace function public.dk__notify(p_tid uuid, p_roles text[], p_users uuid[], p_actor uuid,
  p_title_en text, p_title_bm text, p_body_en text, p_body_bm text, p_type text, p_link jsonb, p_ref_table text, p_ref_id uuid, p_group text default null)
returns int language plpgsql security definer set search_path = public as $$
declare k int;
begin
  insert into public.notifications (tenant_id, user_id, title, body, category, kind, type, priority, link, group_key, actor_id, ref_table, ref_id)
  select p_tid, u.id,
    left(case when lower(coalesce(to_jsonb(u)->>'language', '')) = 'bm' then p_title_bm else p_title_en end, 200),
    left(case when lower(coalesce(to_jsonb(u)->>'language', '')) = 'bm' then p_body_bm else p_body_en end, 500),
    split_part(p_type, '.', 1), public.dk__notif_kind(p_type), p_type, public.dk__notif_prio(p_type), p_link,
    p_group, p_actor, p_ref_table, p_ref_id::text
  from public.user_profiles u
  where u.tenant_id = p_tid and coalesce((to_jsonb(u)->>'is_active')::boolean, true)
    and (p_actor is null or u.id <> p_actor)
    and ((p_roles is not null and lower(coalesce(u.role, '')) = any(p_roles)) or (p_users is not null and u.id = any(p_users)))
    and (p_group is null or not exists (select 1 from public.notifications x
         where x.user_id = u.id and x.group_key = p_group and x.deleted_at is null and x.created_at > now() - interval '10 minutes'));
  get diagnostics k = row_count;
  return k;
end;
$$;
revoke all on function public.dk__notify(uuid, text[], uuid[], uuid, text, text, text, text, text, jsonb, text, uuid, text) from public, anon, authenticated;

-- ---------- 3) staff docs: one event function (used by the trigger AND the backfill) ----------
-- k = leave | ot | exp | adv | os ; ev = submitted | approved | rejected | paid. No amounts anywhere.
create or replace function public.dk__staff_event(k text, n jsonb, ev text, actor uuid, tbl text)
returns int language plpgsql security definer set search_path = public as $$
declare
  tid uuid; rid uuid; emp uuid; who uuid; ename text := ''; d_en text := ''; d_bm text := '';
  w_en text; w_bm text; typ text; lnk jsonb; pg text; vw text; roles text[];
begin
  tid := nullif(n->>'tenant_id', '')::uuid; rid := nullif(n->>'id', '')::uuid;
  if tid is null or rid is null then return 0; end if;
  select x.page, x.view into pg, vw from public.dk__doc(k) x;
  if k = 'os' then pg := 'hr'; vw := 'attendance'; end if;
  lnk := jsonb_build_object('page', coalesce(pg, 'hr'), 'params', jsonb_build_object('view', coalesce(vw, ''))
         || case when k = 'exp' then jsonb_build_object('view', 'exp-form', 'id', rid) else '{}'::jsonb end);
  emp := nullif(n->>'employee_id', '')::uuid;
  if k = 'exp' then
    who := nullif(n->>'claimed_by', '')::uuid;
    if who is not null and not exists (select 1 from public.user_profiles p where p.id = who and p.tenant_id = tid) then who := null; end if;
    select coalesce(p.full_name, '') into ename from public.user_profiles p where p.id = who and p.tenant_id = tid;
    d_en := concat_ws(' · ', nullif(n->>'ref_no', ''), nullif(left(n->>'description', 60), '')); d_bm := d_en;
    w_en := 'Expense claim'; w_bm := 'Tuntutan perbelanjaan'; roles := array['owner', 'admin', 'finance', 'accountant'];
  else
    who := public.dk__emp_user(tid, emp);
    select coalesce(e.name, '') into ename from public.employees e where e.id = emp and e.tenant_id = tid;
    if k = 'leave' then
      w_en := 'Leave request'; w_bm := 'Permohonan cuti';
      d_en := concat_ws(' · ', initcap(replace(coalesce(n->>'leave_type', ''), '_', ' ')), nullif(concat_ws(' – ', n->>'start_date', n->>'end_date'), ''), case when n->>'days_count' is not null then (n->>'days_count') || ' day(s)' end);
      d_bm := concat_ws(' · ', initcap(replace(coalesce(n->>'leave_type', ''), '_', ' ')), nullif(concat_ws(' – ', n->>'start_date', n->>'end_date'), ''), case when n->>'days_count' is not null then (n->>'days_count') || ' hari' end);
    elsif k = 'ot' then
      w_en := 'OT claim'; w_bm := 'Tuntutan OT';
      d_en := concat_ws(' · ', n->>'claim_date', case when n->>'ot_hours' is not null then (n->>'ot_hours') || ' h' end);
      d_bm := concat_ws(' · ', n->>'claim_date', case when n->>'ot_hours' is not null then (n->>'ot_hours') || ' jam' end);
    elsif k = 'os' then
      w_en := 'Outstation request'; w_bm := 'Permohonan outstation';
      d_en := concat_ws(' · ', nullif(concat_ws(' – ', n->>'start_date', n->>'end_date'), ''), nullif(left(n->>'location', 60), '')); d_bm := d_en;
    else
      w_en := 'Cash advance'; w_bm := 'Pendahuluan tunai';
    end if;
    roles := array['owner', 'admin', 'manager', 'hr'];
  end if;
  typ := 'hr.' || k || '_' || ev;
  if ev = 'submitted' then
    return public.dk__notify(tid, roles, null, actor,
      w_en || ' awaiting approval' || case when ename <> '' then ': ' || ename else '' end,
      w_bm || ' menunggu kelulusan' || case when ename <> '' then ': ' || ename else '' end,
      coalesce(nullif(d_en, ''), 'Tap to review.'), coalesce(nullif(d_bm, ''), 'Ketik untuk semak.'), typ, lnk, tbl, rid, typ || ':' || rid);
  elsif who is not null then
    return public.dk__notify(tid, null, array[who], actor,
      'Your ' || lower(w_en) || ' was ' || ev,
      w_bm || ' anda telah ' || case ev when 'approved' then 'diluluskan' when 'rejected' then 'ditolak' else 'dibayar' end,
      coalesce(nullif(d_en, ''), 'Tap to view.'), coalesce(nullif(d_bm, ''), 'Ketik untuk lihat.'), typ, lnk, tbl, rid, typ || ':' || rid);
  end if;
  return 0;
end;
$$;
revoke all on function public.dk__staff_event(text, jsonb, text, uuid, text) from public, anon, authenticated;

create or replace function public.dk__staff_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare k text := TG_ARGV[0]; n jsonb := to_jsonb(NEW); st text; ost text; rid uuid; tid uuid; ev text; typ text;
begin
  begin
    tid := nullif(n->>'tenant_id', '')::uuid; rid := nullif(n->>'id', '')::uuid;
    if tid is null or rid is null then return NEW; end if;
    st := lower(coalesce(n->>'status', 'pending'));
    if TG_OP = 'UPDATE' then
      ost := lower(coalesce(to_jsonb(OLD)->>'status', 'pending'));
      if st = ost then return NEW; end if;
      -- left pending -> the approvers' to-do rows stop counting (all approvers, every device)
      if ost in ('pending', 'submitted') and st not in ('pending', 'submitted') then
        update public.notifications set acted_at = now(), read_at = coalesce(read_at, now())
        where tenant_id = tid and ref_id = rid::text and type = 'hr.' || k || '_submitted' and acted_at is null;
      end if;
    end if;
    if st in ('pending', 'submitted') then ev := 'submitted';
    elsif st in ('approved', 'rejected', 'paid') then ev := st;
    else return NEW; end if;
    if TG_OP = 'INSERT' and ev <> 'submitted' then return NEW; end if;
    typ := 'hr.' || k || '_' || ev;
    if exists (select 1 from public.notifications x where x.tenant_id = tid and x.ref_id = rid::text and x.type = typ and x.created_at > now() - interval '60 seconds') then return NEW; end if;
    perform public.dk__staff_event(k, n, ev, auth.uid(), TG_TABLE_NAME);
  exception when others then
    raise warning 'dk__staff_notify(%): %', k, sqlerrm;
  end;
  return NEW;
end;
$$;
revoke all on function public.dk__staff_notify() from public, anon, authenticated;

do $$
declare r record;
begin
  for r in select * from (values ('leave_requests', 'leave'), ('ot_claims', 'ot'), ('expense_claims', 'exp'), ('cash_advances', 'adv'), ('outstation_requests', 'os')) v(tbl, k) loop
    if to_regclass('public.' || r.tbl) is null then raise notice 'notif_audit: table % missing — skipped', r.tbl; continue; end if;
    execute format('drop trigger if exists dk_staff_notify_ins on public.%I', r.tbl);
    execute format('drop trigger if exists dk_staff_notify_upd on public.%I', r.tbl);
    execute format('create trigger dk_staff_notify_ins after insert on public.%I for each row execute function public.dk__staff_notify(%L)', r.tbl, r.k);
    execute format('create trigger dk_staff_notify_upd after update on public.%I for each row execute function public.dk__staff_notify(%L)', r.tbl, r.k);
  end loop;
end $$;

-- ---------- 4) purchasing / ops triggers: same text = uuid bug, patched in place (no other change) ----------
do $$
declare f text; d text;
begin
  foreach f in array array['dk__purch_notify', 'dk__ops_notify'] loop
    if to_regprocedure('public.' || f || '()') is null then raise notice 'notif_audit: % missing — skipped', f; continue; end if;
    d := pg_get_functiondef(('public.' || f || '()')::regprocedure);
    if position('x.ref_id = rid and' in d) > 0 then
      execute replace(d, 'x.ref_id = rid and', 'x.ref_id = rid::text and');
      raise notice 'notif_audit: % patched (ref_id = rid::text)', f;
    end if;
  end loop;
end $$;

-- ---------- 5) normalise existing DK rows (badge counted info rows) ----------
update public.notifications set kind = 'for_you', priority = 0
where kind = 'action' and deleted_at is null and type is not null
  and type ~ '^(hr|purchasing|inventory|logistics|finance|sales|approval)\.'
  and (type ~ '^hr\.(leave|ot|exp|adv|os)_(approved|rejected|paid)$'
    or type in ('purchasing.po_partial', 'purchasing.po_received', 'purchasing.po_cancelled', 'purchasing.grn_new',
                'purchasing.bill_new', 'purchasing.bill_paid', 'inventory.wo_completed', 'logistics.do_received',
                'approval.dk_signed', 'hr.applicant_interview'));
update public.notifications set priority = 0
where kind = 'action' and priority = 1 and deleted_at is null and type is not null
  and public.dk__notif_kind(type) = 'action' and public.dk__notif_prio(type) = 0
  and type ~ '^(hr|purchasing|inventory|logistics|finance|sales|approval)\.';

-- ---------- 6) backfill ----------
-- 6a) close stale action rows whose source is no longer waiting (staff docs)
do $$
declare r record; c int;
begin
  for r in select * from (values ('leave_requests', 'leave'), ('ot_claims', 'ot'), ('expense_claims', 'exp'), ('cash_advances', 'adv'), ('outstation_requests', 'os')) v(tbl, k) loop
    if to_regclass('public.' || r.tbl) is null then continue; end if;
    execute format($q$update public.notifications n set acted_at = now(), read_at = coalesce(n.read_at, now())
      where n.acted_at is null and n.deleted_at is null and n.type = %L and n.ref_id is not null
        and not exists (select 1 from public.%I s where s.id::text = n.ref_id and lower(coalesce(s.status, 'pending')) in ('pending', 'submitted'))$q$,
      'hr.' || r.k || '_submitted', r.tbl);
    get diagnostics c = row_count; raise notice 'notif_audit 6a: % stale % rows closed', c, r.k;
  end loop;
end $$;

-- 6b) close stale Service Desk action rows (SR already triaged / delivered / closed)
do $$
declare c int;
begin
  if to_regclass('public.service_requests') is null then return; end if;
  update public.notifications n set acted_at = now(), read_at = coalesce(n.read_at, now())
  from public.service_requests s
  where n.acted_at is null and n.deleted_at is null and n.kind = 'action' and n.ref_table = 'service_requests'
    and n.ref_id = s.id::text
    and ((n.type = 'sd.new' and s.status <> 'submitted')
      or (n.type = 'sd.revision' and s.status not in ('revision', 'triaged', 'in_progress'))
      or (n.type = 'sd.delivered' and s.status <> 'delivered'));
  get diagnostics c = row_count; raise notice 'notif_audit 6b: % stale SD rows closed', c;
  update public.notifications n set acted_at = now(), read_at = coalesce(n.read_at, now())
  where n.acted_at is null and n.deleted_at is null and n.kind = 'action' and n.ref_table = 'service_requests'
    and n.type in ('sd.new', 'sd.revision', 'sd.delivered') and n.ref_id is not null
    and not exists (select 1 from public.service_requests s where s.id::text = n.ref_id);
end $$;

-- 6c) pending staff docs (last 30 days) that never got an approver notification (trigger bug A).
--     created_at = the document's created_at, so push-send (only flushes the last 10 min) does NOT push them.
do $$
declare r record; d jsonb; c int := 0; g text; typ text;
begin
  for r in select * from (values ('leave_requests', 'leave'), ('ot_claims', 'ot'), ('expense_claims', 'exp'), ('cash_advances', 'adv'), ('outstation_requests', 'os')) v(tbl, k) loop
    if to_regclass('public.' || r.tbl) is null then continue; end if;
    typ := 'hr.' || r.k || '_submitted';
    for d in execute format($q$select to_jsonb(s) from public.%I s
        where lower(coalesce(s.status, 'pending')) in ('pending', 'submitted')
          and coalesce((to_jsonb(s)->>'deleted_at'), '') = ''
          and s.created_at > now() - interval '30 days' and s.created_at < now() - interval '10 minutes'
          and not exists (select 1 from public.notifications x where x.ref_id = s.id::text and x.type = %L)$q$, r.tbl, typ) loop
      g := typ || ':' || (d->>'id');
      c := c + public.dk__staff_event(r.k, d, 'submitted', null, r.tbl);
      update public.notifications set created_at = (d->>'created_at')::timestamptz where group_key = g and created_at = now();
    end loop;
  end loop;
  raise notice 'notif_audit 6c: % approver rows backfilled', c;
end $$;

-- 6d) OT / expense decisions of the last 7 days the claimant never heard about (they had no client copy).
do $$
declare r record; d jsonb; c int := 0; g text; ev text; ts timestamptz;
begin
  for r in select * from (values ('ot_claims', 'ot'), ('expense_claims', 'exp')) v(tbl, k) loop
    if to_regclass('public.' || r.tbl) is null then continue; end if;
    for d in execute format($q$select to_jsonb(s) from public.%I s
        where lower(coalesce(s.status, '')) in ('approved', 'rejected', 'paid')
          and coalesce((to_jsonb(s)->>'deleted_at'), '') = ''
          and coalesce((to_jsonb(s)->>'updated_at')::timestamptz, s.created_at) > now() - interval '7 days'
          and coalesce((to_jsonb(s)->>'updated_at')::timestamptz, s.created_at) < now() - interval '10 minutes'
          and not exists (select 1 from public.notifications x where x.ref_id = s.id::text and x.type = 'hr.' || %L || '_' || lower(s.status))$q$, r.tbl, r.k) loop
      ev := lower(d->>'status'); g := 'hr.' || r.k || '_' || ev || ':' || (d->>'id');
      ts := coalesce((d->>'updated_at')::timestamptz, (d->>'created_at')::timestamptz);
      c := c + public.dk__staff_event(r.k, d, ev, null, r.tbl);
      update public.notifications set created_at = ts where group_key = g and created_at = now();
    end loop;
  end loop;
  raise notice 'notif_audit 6d: % claimant rows backfilled', c;
end $$;

-- ---------- 7) roadmap ----------
do $$
begin
  if to_regclass('public.dev_roadmap_items') is null then return; end if;
  update public.dev_roadmap_items set stage = 'completed' where title = 'Notification audit & badge fix';
  if not found then
    insert into public.dev_roadmap_items (title, description, module, stage)
    values ('Notification audit & badge fix',
      'Bell/sidebar/app-icon badge = unread count; Mark all read clears all three. DK triggers fixed (ref_id text vs uuid), correct action vs for_you, 1 event = 1 notif per recipient, outstation notifications, stale to-dos closed, backfill of missed staff notifications.',
      'core', 'completed');
  end if;
end $$;

-- ---------- 8) check (read-only) ----------
select type, kind, count(*) filter (where read_at is null and acted_at is null) as unread_open, count(*) as total
from public.notifications
where deleted_at is null and created_at > now() - interval '30 days'
group by 1, 2 order by 4 desc limit 40;
