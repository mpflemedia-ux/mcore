-- dk_phase4_ops.sql — DK Phase 4 · Operations (work orders, job applicants)
-- WRITE-ONLY artefact: review, then run once in the Supabase SQL editor AFTER dk_phase0_kit.sql (+ phase 1/2/3). Idempotent.
-- Bell + push notifications via public.dk__notify (Phase 0) — same tenant only, actor excluded, one row per event per recipient:
--   work_orders INSERT with assigned_to / UPDATE assigned_to changed → the assignee            (inventory.wo_assigned)
--   work_orders UPDATE status → completed                         → owner/admin/manager/production + assignee (inventory.wo_completed)
--   job_applicants INSERT                                         → owner/admin/hr               (hr.applicant_new)
--   job_applicants UPDATE interview_date set / changed            → owner/admin/hr               (hr.applicant_interview)
-- Titles/bodies carry product name, quantity, applicant name, position and date only (no salary / expected salary).
-- Low stock is NOT added here — the app already raises it client-side (notification pref "low_stock").
-- Columns read through to_jsonb(NEW); every failure is swallowed (warning) so operational writes never break.

create or replace function public.dk__ops_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  k text := TG_ARGV[0]; n jsonb := to_jsonb(NEW); o jsonb; tid uuid; rid uuid; actor uuid; st text; ost text;
  typ text; lnk jsonb; roles text[] := array[]::text[]; users uuid[]; ref text := ''; prod text := ''; asg uuid; grp text;
  t_en text; t_bm text; b_en text; b_bm text;
begin
  begin
    tid := nullif(n->>'tenant_id', '')::uuid; rid := nullif(n->>'id', '')::uuid;
    if tid is null or rid is null or to_regprocedure('public.dk__notify(uuid,text[],uuid[],uuid,text,text,text,text,text,jsonb,text,uuid,text)') is null then return NEW; end if;
    actor := auth.uid();
    if TG_OP = 'UPDATE' then o := to_jsonb(OLD); else o := '{}'::jsonb; end if;
    if k = 'wo' then
      ref := coalesce(n->>'ref_no', n->>'wo_no', 'WO-' || upper(left(rid::text, 8)));
      if nullif(n->>'product_id', '') is not null and to_regclass('public.products') is not null then
        select coalesce(nullif(p.name_en, ''), p.name_bm, '') into prod from public.products p where p.id = (n->>'product_id')::uuid and p.tenant_id = tid;
      end if;
      begin asg := nullif(n->>'assigned_to', '')::uuid; exception when others then asg := null; end;
      lnk := jsonb_build_object('page', 'production', 'params', jsonb_build_object('view', 'wo-detail', 'id', rid));
      st := lower(coalesce(n->>'status', '')); ost := lower(coalesce(o->>'status', ''));
      if TG_OP = 'UPDATE' and st = 'completed' and ost <> 'completed' then
        typ := 'inventory.wo_completed'; roles := array['owner', 'admin', 'manager', 'production'];
        t_en := 'Work order completed: ' || ref; t_bm := 'Arahan kerja selesai: ' || ref;
        b_en := concat_ws(' · ', nullif(prod, ''), 'qty ' || coalesce(n->>'qty_to_produce', '-')); b_bm := concat_ws(' · ', nullif(prod, ''), 'kuantiti ' || coalesce(n->>'qty_to_produce', '-'));
        if asg is not null then users := array[asg]; end if;
      elsif asg is not null and (TG_OP = 'INSERT' or coalesce(o->>'assigned_to', '') <> coalesce(n->>'assigned_to', '')) then
        typ := 'inventory.wo_assigned';
        t_en := 'Work order assigned to you: ' || ref; t_bm := 'Arahan kerja ditugaskan kepada anda: ' || ref;
        b_en := concat_ws(' · ', nullif(prod, ''), 'qty ' || coalesce(n->>'qty_to_produce', '-')); b_bm := concat_ws(' · ', nullif(prod, ''), 'kuantiti ' || coalesce(n->>'qty_to_produce', '-'));
        users := array[asg];
      else return NEW; end if;
    elsif k = 'app' then
      ref := coalesce(nullif(n->>'full_name', ''), n->>'ref_no', 'Applicant');
      lnk := jsonb_build_object('page', 'applicants', 'params', jsonb_build_object('view', 'applicant-form', 'id', rid));
      roles := array['owner', 'admin', 'hr'];
      if TG_OP = 'INSERT' then
        typ := 'hr.applicant_new';
        t_en := 'New job applicant: ' || ref; t_bm := 'Pemohon kerja baharu: ' || ref;
        b_en := coalesce(nullif(n->>'position_applied', ''), 'Tap to view.'); b_bm := coalesce(nullif(n->>'position_applied', ''), 'Ketik untuk lihat.');
      elsif nullif(n->>'interview_date', '') is not null and coalesce(o->>'interview_date', '') <> coalesce(n->>'interview_date', '') then
        typ := 'hr.applicant_interview';
        t_en := 'Interview scheduled: ' || ref; t_bm := 'Temu duga dijadualkan: ' || ref;
        b_en := concat_ws(' · ', nullif(n->>'position_applied', ''), n->>'interview_date'); b_bm := b_en;
      else return NEW; end if;
    else return NEW; end if;
    if users is not null then
      select array_agg(u) into users from unnest(users) u where exists (select 1 from public.user_profiles p where p.id = u and p.tenant_id = tid);
    end if;
    grp := typ || ':' || rid || case when typ = 'inventory.wo_assigned' then ':' || coalesce(asg::text, '') when typ = 'hr.applicant_interview' then ':' || coalesce(n->>'interview_date', '') else '' end;
    if exists (select 1 from public.notifications x where x.tenant_id = tid and x.ref_id = rid and x.type = typ and x.created_at > now() - interval '60 seconds') then return NEW; end if;
    perform public.dk__notify(tid, roles, users, actor, t_en, t_bm,
      coalesce(nullif(b_en, ''), 'Tap to view.'), coalesce(nullif(b_bm, ''), 'Ketik untuk lihat.'), typ, lnk, TG_TABLE_NAME, rid, grp);
  exception when others then
    raise warning 'dk__ops_notify(%): %', k, sqlerrm;
  end;
  return NEW;
end;
$$;
revoke all on function public.dk__ops_notify() from public, anon, authenticated;

do $$
declare r record;
begin
  for r in select * from (values ('work_orders', 'wo'), ('job_applicants', 'app')) v(tbl, k) loop
    if to_regclass('public.' || r.tbl) is null then raise notice 'dk phase4: table % missing — skipped', r.tbl; continue; end if;
    execute format('drop trigger if exists dk_ops_notify on public.%I', r.tbl);
    execute format('create trigger dk_ops_notify after insert or update on public.%I for each row execute function public.dk__ops_notify(%L)', r.tbl, r.k);
  end loop;
end $$;

do $$
begin
  if to_regclass('public.dev_roadmap_items') is null then return; end if;
  update public.dev_roadmap_items set stage = 'completed' where title = 'DK Phase 4 — Operations cards & work-order slip';
  if not found then
    insert into public.dev_roadmap_items (title, description, module, stage)
    values ('DK Phase 4 — Operations cards & work-order slip', 'CRM / petty cash / products / stock / work orders / employees / applicants / POS history & shifts → card lists at all widths; WO slip document card (PDF/Print, issued/completed signatures); employee bulk delete via card selection; ops bell + push notifications (WO assigned/completed, new applicant, interview scheduled — no salary).', 'production', 'completed');
  end if;
end $$;
