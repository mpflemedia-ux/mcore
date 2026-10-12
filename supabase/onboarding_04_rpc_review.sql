-- M-Core Onboarding Checklist - part 4/5: review, status, view log, reminders, master publish. Run after part 3.
-- Completion badge: every item approved or not-applicable.
create or replace function public.cob_recompute(p_checklist uuid) returns void
language plpgsql security definer set search_path = public as $$
declare open_n int;
begin
  select count(*) into open_n from public.cob_items where checklist_id = p_checklist and deleted_at is null and status not in ('approved','na');
  update public.cob_checklists set
    status = case when open_n = 0 then 'completed' else 'active' end,
    completed_at = case when open_n = 0 then coalesce(completed_at, now()) else null end
  where id = p_checklist;
end $$;

create or replace function public.cob_notify_tenant(p_tenant uuid, p_title text, p_body text) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, title, body, category)
  select id, p_title, p_body, 'onboarding' from public.user_profiles
  where tenant_id = p_tenant and lower(coalesce(role,'')) in ('owner','admin')
$$;

-- Platform admin decision on the latest submission. Reject restores old values only where the tenant still holds
-- the submitted value; anything changed since is reported in restore_result.conflicts for manual follow-up.
create or replace function public.cob_review(p_submission uuid, p_decision text, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.cob_submissions%rowtype; it public.cob_items%rowtype; a jsonb; col text; cur text;
  restored jsonb := '[]'; conflicts jsonb := '[]';
begin
  if not public.is_platform_admin() then raise exception 'Only platform admin can review' using errcode = '42501'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'bad decision' using errcode = '22023'; end if;
  select * into s from public.cob_submissions where id = p_submission and deleted_at is null for update;
  if not found then raise exception 'Submission not found' using errcode = 'P0002'; end if;
  if s.decision is not null then raise exception 'Already decided' using errcode = '22023'; end if;
  if exists (select 1 from public.cob_submissions where item_id = s.item_id and seq > s.seq and deleted_at is null) then
    raise exception 'A newer submission exists for this item' using errcode = '22023';
  end if;
  select * into it from public.cob_items where id = s.item_id for update;
  if p_decision = 'rejected' then
    if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'Reason required' using errcode = '22023'; end if;
    for a in select * from jsonb_array_elements(s.applied) loop
      col := a->>'col';
      if not (col = any (public.cob_allowed_cols())) then continue; end if;
      execute format('select %I::text from public.tenants where id = $1', col) into cur using s.tenant_id;
      if cur is not distinct from (a->>'value') then
        if col = 'name' and s.values_old->>col is null then conflicts := conflicts || to_jsonb(col); continue; end if;
        if col = 'incorporation_date' then
          execute format('update public.tenants set %I = $1::date where id = $2', col) using s.values_old->>col, s.tenant_id;
        else
          execute format('update public.tenants set %I = $1 where id = $2', col) using s.values_old->>col, s.tenant_id;
        end if;
        restored := restored || to_jsonb(col);
      else
        conflicts := conflicts || to_jsonb(col);
      end if;
    end loop;
  end if;
  update public.cob_submissions set decision = p_decision, decision_reason = nullif(btrim(coalesce(p_reason, '')), ''),
    decided_by = auth.uid(), decided_at = now(),
    restore_result = case when p_decision = 'rejected' then jsonb_build_object('restored', restored, 'conflicts', conflicts) end
  where id = s.id;
  update public.cob_items set status = p_decision, status_reason = case when p_decision = 'rejected' then btrim(p_reason) end,
    status_by = auth.uid(), status_at = now(), updated_by = auth.uid()
  where id = it.id;
  insert into public.cob_events (tenant_id, item_id, action, detail)
    values (s.tenant_id, it.id, case when p_decision = 'approved' then 'approve' else 'reject' end,
      jsonb_build_object('submission_id', s.id, 'reason', p_reason, 'restored', restored, 'conflicts', conflicts));
  perform public.cob_notify_tenant(s.tenant_id,
    'Onboarding ' || it.code || case when p_decision = 'approved' then ' diluluskan' else ' ditolak' end,
    case when p_decision = 'approved' then it.label_bm else it.label_bm || ': ' || btrim(p_reason) end);
  perform public.cob_recompute(it.checklist_id);
  return jsonb_build_object('decision', p_decision, 'restored', restored, 'conflicts', conflicts);
end $$;

-- Tak berkenaan (platform admin ONLY) or reopen to pending.
create or replace function public.cob_set_status(p_item uuid, p_status text, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare it public.cob_items%rowtype;
begin
  if not public.is_platform_admin() then raise exception 'Only platform admin can change this status' using errcode = '42501'; end if;
  if p_status not in ('na','pending') then raise exception 'bad status' using errcode = '22023'; end if;
  select * into it from public.cob_items where id = p_item and deleted_at is null for update;
  if not found then raise exception 'Item not found' using errcode = 'P0002'; end if;
  update public.cob_items set status = p_status, status_reason = nullif(btrim(coalesce(p_reason, '')), ''),
    status_by = auth.uid(), status_at = now(), updated_by = auth.uid() where id = p_item;
  insert into public.cob_events (tenant_id, item_id, action, detail)
    values (it.tenant_id, p_item, case when p_status = 'na' then 'na' else 'reopen' end, jsonb_build_object('reason', p_reason));
  perform public.cob_recompute(it.checklist_id);
end $$;

-- Every document open / unmasked value view is logged.
create or replace function public.cob_log_view(p_item uuid, p_file uuid default null, p_full boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  select tenant_id into t from public.cob_items where id = p_item;
  if t is null or not public.cob_can_read(t) then raise exception 'not allowed' using errcode = '42501'; end if;
  insert into public.cob_events (tenant_id, item_id, file_id, action) values (t, p_item, p_file, case when p_full then 'view_full' else 'view_doc' end);
end $$;

-- Reminder to tenant owners/admins (bell). Returns owner Telegram targets for the client to send.
create or replace function public.cob_remind(p_tenant uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n_open int; n_core int;
begin
  if not public.is_platform_admin() then raise exception 'Only platform admin can send reminders' using errcode = '42501'; end if;
  select count(*) filter (where status in ('pending','rejected')), count(*) filter (where status in ('pending','rejected') and section_core)
    into n_open, n_core from public.cob_items where tenant_id = p_tenant and deleted_at is null;
  perform public.cob_notify_tenant(p_tenant, 'Peringatan onboarding M-Core',
    n_open || ' item belum lengkap (' || n_core || ' UTAMA).');
  update public.cob_checklists set last_reminder_at = now() where tenant_id = p_tenant and deleted_at is null;
  insert into public.cob_events (tenant_id, action, detail) values (p_tenant, 'reminder', jsonb_build_object('open', n_open, 'core', n_core));
  return jsonb_build_object('open', n_open, 'core', n_core, 'owners', (
    select coalesce(jsonb_agg(jsonb_build_object('tenant_id', l.tenant_id, 'user_id', l.subject_id)), '[]'::jsonb)
    from public.telegram_links l join public.user_profiles u on u.id = l.subject_id
    where l.tenant_id = p_tenant and l.subject_type = 'user' and lower(coalesce(u.role,'')) in ('owner','admin')));
end $$;

-- Master: copy latest published into a new draft; publish a draft (previous published -> archived).
create or replace function public.cob_new_draft() returns uuid
language plpgsql security definer set search_path = public as $$
declare src uuid; nv int; vid uuid;
begin
  if not public.is_platform_admin() then raise exception 'Only platform admin' using errcode = '42501'; end if;
  select id into vid from public.cob_master_versions where status = 'draft' and deleted_at is null order by version desc limit 1;
  if vid is not null then return vid; end if;
  select id into src from public.cob_master_versions where status = 'published' and deleted_at is null order by version desc limit 1;
  select coalesce(max(version), 0) + 1 into nv from public.cob_master_versions;
  insert into public.cob_master_versions (version, note) values (nv, 'draft') returning id into vid;
  insert into public.cob_master_sections (version_id, key, name_bm, name_en, is_core, sort_order)
    select vid, key, name_bm, name_en, is_core, sort_order from public.cob_master_sections where version_id = src and deleted_at is null;
  insert into public.cob_master_items (version_id, section_key, code, sort_order, label_bm, label_en, note_bm, note_en, requirement,
    item_type, fields, ai_action, template_header, track_expiry, urgent, module_page, module_params)
  select vid, section_key, code, sort_order, label_bm, label_en, note_bm, note_en, requirement, item_type, fields, ai_action,
    template_header, track_expiry, urgent, module_page, module_params from public.cob_master_items where version_id = src and deleted_at is null;
  return vid;
end $$;
create or replace function public.cob_publish(p_version uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'Only platform admin' using errcode = '42501'; end if;
  update public.cob_master_versions set status = 'archived' where status = 'published' and id <> p_version;
  update public.cob_master_versions set status = 'published', published_at = now(), published_by = auth.uid()
    where id = p_version and deleted_at is null;
  if not found then raise exception 'Version not found' using errcode = 'P0002'; end if;
end $$;
grant execute on function public.cob_review(uuid, text, text), public.cob_set_status(uuid, text, text), public.cob_log_view(uuid, uuid, boolean),
  public.cob_remind(uuid), public.cob_new_draft(), public.cob_publish(uuid) to authenticated;
revoke execute on function public.cob_recompute(uuid), public.cob_notify_tenant(uuid, text, text) from public, anon, authenticated;
