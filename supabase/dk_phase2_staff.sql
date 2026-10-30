-- dk_phase2_staff.sql — DK Phase 2 · Staff (Leave, OT, Expense claim, Cash advance)
-- WRITE-ONLY artefact: review, then run once in the Supabase SQL editor AFTER dk_phase0_kit.sql. Idempotent (safe to re-run).
-- Adds bell/push notifications (via public.dk__notify from Phase 0 → notifications insert → existing push pipeline):
--   submitted (insert / status → pending|submitted)  → approvers by role in the SAME tenant (actor excluded)
--   approved / rejected / paid                         → the claimant's own user (actor excluded)
-- No amounts in any title/body (salary-sensitive). Deep link = dk__doc(page, view). One row per event per recipient
-- (status must actually change; 60s duplicate guard). Notification failure never blocks the business write.
-- Columns are read through to_jsonb(NEW) so a missing column can never break inserts/updates.

-- ---------- 1) employee → user (same tenant only) ----------
create or replace function public.dk__emp_user(p_tid uuid, p_emp uuid)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare e jsonb; u uuid; n int;
begin
  if p_tid is null or p_emp is null then return null; end if;
  select to_jsonb(x) into e from public.employees x where x.id = p_emp and x.tenant_id = p_tid;
  if e is null then return null; end if;
  if coalesce(e->>'user_id', '') <> '' then
    begin u := (e->>'user_id')::uuid; exception when others then u := null; end;
    if u is not null and exists (select 1 from public.user_profiles p where p.id = u and p.tenant_id = p_tid) then return u; end if;
    u := null;
  end if;
  if coalesce(trim(e->>'email'), '') <> '' then
    select p.id into u from public.user_profiles p where p.tenant_id = p_tid and lower(trim(to_jsonb(p)->>'email')) = lower(trim(e->>'email')) limit 1;
    if u is not null then return u; end if;
    begin
      execute 'select a.id from auth.users a join public.user_profiles p on p.id = a.id and p.tenant_id = $1 where lower(a.email) = lower($2) limit 1' into u using p_tid, trim(e->>'email');
    exception when others then u := null; end;
    if u is not null then return u; end if;
  end if;
  if coalesce(trim(e->>'name'), '') <> '' then
    select count(*), min(p.id::text)::uuid into n, u from public.user_profiles p where p.tenant_id = p_tid and lower(trim(p.full_name)) = lower(trim(e->>'name'));
    if n = 1 then return u; end if;
  end if;
  return null;
end;
$$;
revoke all on function public.dk__emp_user(uuid, uuid) from public, anon, authenticated;

-- ---------- 2) generic staff-doc trigger: TG_ARGV[0] = doc type (leave | ot | exp | adv) ----------
create or replace function public.dk__staff_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  k text := TG_ARGV[0]; n jsonb := to_jsonb(NEW); st text; ost text; tid uuid; rid uuid; emp uuid; who uuid; actor uuid;
  ename text := ''; d_en text := ''; d_bm text := ''; w_en text; w_bm text; ev text; typ text; lnk jsonb; pg text; vw text;
  roles text[];
begin
  begin
    tid := nullif(n->>'tenant_id', '')::uuid; rid := nullif(n->>'id', '')::uuid;
    if tid is null or rid is null or to_regprocedure('public.dk__notify(uuid,text[],uuid[],uuid,text,text,text,text,text,jsonb,text,uuid,text)') is null then return NEW; end if;
    st := lower(coalesce(n->>'status', 'pending'));
    if TG_OP = 'UPDATE' then
      ost := lower(coalesce(to_jsonb(OLD)->>'status', 'pending'));
      if st = ost then return NEW; end if;
    end if;
    if st in ('pending', 'submitted') then ev := 'submitted';
    elsif st in ('approved', 'rejected', 'paid') then ev := st;
    else return NEW; end if;
    if TG_OP = 'INSERT' and ev <> 'submitted' then return NEW; end if;
    actor := auth.uid();
    select x.page, x.view into pg, vw from public.dk__doc(k) x;
    lnk := jsonb_build_object('page', coalesce(pg, 'hr'), 'params', jsonb_build_object('view', coalesce(vw, '')) || case when k = 'exp' then jsonb_build_object('view', 'exp-form', 'id', rid) else '{}'::jsonb end);
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
        d_en := concat_ws(' · ', n->>'claim_date', case when n->>'ot_hours' is not null then (n->>'ot_hours') || ' h' end); d_bm := concat_ws(' · ', n->>'claim_date', case when n->>'ot_hours' is not null then (n->>'ot_hours') || ' jam' end);
      else
        w_en := 'Cash advance'; w_bm := 'Pendahuluan tunai';
      end if;
      roles := array['owner', 'admin', 'manager', 'hr'];
    end if;
    typ := 'hr.' || k || '_' || ev;
    if exists (select 1 from public.notifications x where x.tenant_id = tid and x.ref_id = rid and x.type = typ and x.created_at > now() - interval '60 seconds') then return NEW; end if;
    if ev = 'submitted' then
      perform public.dk__notify(tid, roles, null, actor,
        w_en || ' awaiting approval' || case when ename <> '' then ': ' || ename else '' end,
        w_bm || ' menunggu kelulusan' || case when ename <> '' then ': ' || ename else '' end,
        coalesce(nullif(d_en, ''), 'Tap to review.'), coalesce(nullif(d_bm, ''), 'Ketik untuk semak.'), typ, lnk, TG_TABLE_NAME, rid, typ || ':' || rid);
    elsif who is not null then
      perform public.dk__notify(tid, null, array[who], actor,
        'Your ' || lower(w_en) || ' was ' || ev, w_bm || ' anda telah ' || case ev when 'approved' then 'diluluskan' when 'rejected' then 'ditolak' else 'dibayar' end,
        coalesce(nullif(d_en, ''), 'Tap to view.'), coalesce(nullif(d_bm, ''), 'Ketik untuk lihat.'), typ, lnk, TG_TABLE_NAME, rid, typ || ':' || rid);
    end if;
  exception when others then
    raise warning 'dk__staff_notify(%): %', k, sqlerrm;
  end;
  return NEW;
end;
$$;
revoke all on function public.dk__staff_notify() from public, anon, authenticated;

-- ---------- 3) attach triggers only where the table exists ----------
do $$
declare r record;
begin
  for r in select * from (values ('leave_requests', 'leave'), ('ot_claims', 'ot'), ('expense_claims', 'exp'), ('cash_advances', 'adv')) v(tbl, k) loop
    if to_regclass('public.' || r.tbl) is null then raise notice 'dk phase2: table % missing — skipped', r.tbl; continue; end if;
    execute format('drop trigger if exists dk_staff_notify_ins on public.%I', r.tbl);
    execute format('drop trigger if exists dk_staff_notify_upd on public.%I', r.tbl);
    execute format('create trigger dk_staff_notify_ins after insert on public.%I for each row execute function public.dk__staff_notify(%L)', r.tbl, r.k);
    execute format('create trigger dk_staff_notify_upd after update on public.%I for each row execute function public.dk__staff_notify(%L)', r.tbl, r.k);
  end loop;
end $$;

-- ---------- 4) roadmap ----------
do $$
begin
  if to_regclass('public.dev_roadmap_items') is null then return; end if;
  update public.dev_roadmap_items set stage = 'completed' where title = 'DK Phase 2 — Staff cards & slips';
  if not found then
    insert into public.dev_roadmap_items (title, description, module, stage)
    values ('DK Phase 2 — Staff cards & slips', 'Leave, OT, Expense claim, Cash advance: card lists (all widths), printable A4 slips + PDF with signature boxes, approver/claimant bell + push notifications (no amounts).', 'hr', 'completed');
  end if;
end $$;
