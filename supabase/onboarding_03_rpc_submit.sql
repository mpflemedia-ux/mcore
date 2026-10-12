-- M-Core Onboarding Checklist - part 3/5: start + submit RPCs. Run after part 2.
-- Allowlist = REAL tenants columns (company profile). Anything else is kept only as an answer in cob_items.answers.
create or replace function public.cob_allowed_cols() returns text[] language sql immutable as $$
  select array['name','ssm_no','incorporation_date','address','address_line2','city','postcode','state','email','phone',
               'bank_name','account_number','account_name','sst_gst_no','invoice_terms','logo_url']
$$;

-- Platform admins with a Telegram link (tenant_id + user id only; chat ids stay server-side in telegram-send)
create or replace function public.cob_admin_targets() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('tenant_id', l.tenant_id, 'user_id', l.subject_id)), '[]'::jsonb)
  from public.telegram_links l join public.user_profiles u on u.id = l.subject_id
  where l.subject_type = 'user' and lower(coalesce(u.role,'')) = 'platform_admin'
$$;

-- Create the tenant checklist from the latest published master (once). Owner/Admin of the tenant or platform admin.
create or replace function public.cob_start(p_tenant uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare t uuid := coalesce(p_tenant, public.cob_my_tenant()); cid uuid; vid uuid;
begin
  if t is null then raise exception 'tenant required' using errcode = '22023'; end if;
  if not (public.is_platform_admin() or public.cob_is_tenant_admin(t)) then
    raise exception 'Only owner/admin can start onboarding' using errcode = '42501';
  end if;
  select id into cid from public.cob_checklists where tenant_id = t and deleted_at is null;
  if cid is not null then return cid; end if;
  select id into vid from public.cob_master_versions where status = 'published' and deleted_at is null order by version desc limit 1;
  if vid is null then raise exception 'No published checklist master' using errcode = 'P0002'; end if;
  insert into public.cob_checklists (tenant_id, master_version_id, target_date)
    values (t, vid, (now() at time zone 'Asia/Kuala_Lumpur')::date + 21) returning id into cid;
  insert into public.cob_items (tenant_id, checklist_id, master_item_id, section_key, section_name_bm, section_name_en, section_core,
    section_sort, code, sort_order, label_bm, label_en, note_bm, note_en, requirement, item_type, fields, ai_action, template_header,
    track_expiry, urgent, module_page, module_params)
  select t, cid, i.id, i.section_key, s.name_bm, s.name_en, s.is_core, s.sort_order, i.code, i.sort_order, i.label_bm, i.label_en,
    i.note_bm, i.note_en, i.requirement, i.item_type, i.fields, i.ai_action, i.template_header, i.track_expiry, i.urgent, i.module_page, i.module_params
  from public.cob_master_items i join public.cob_master_sections s on s.version_id = i.version_id and s.key = i.section_key and s.deleted_at is null
  where i.version_id = vid and i.deleted_at is null;
  insert into public.cob_events (tenant_id, action, detail) values (t, 'start', jsonb_build_object('version_id', vid));
  return cid;
end $$;

-- Submit: data applies to the tenant IMMEDIATELY (old values stored for restore). Item -> 'submitted'.
create or replace function public.cob_submit(p_item uuid, p_values jsonb default '{}'::jsonb, p_file uuid default null,
  p_ai boolean default false, p_expiry date default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare it public.cob_items%rowtype; f jsonb; k text; col text; v text; oldv text; olds jsonb := '{}'; applied jsonb := '[]';
  sid uuid; n int; tname text; adm record;
begin
  select * into it from public.cob_items where id = p_item and deleted_at is null for update;
  if not found then raise exception 'Item not found' using errcode = 'P0002'; end if;
  if not (public.is_platform_admin() or public.cob_is_tenant_admin(it.tenant_id)) then
    raise exception 'Only owner/admin can submit onboarding items' using errcode = '42501';
  end if;
  if it.status = 'na' then raise exception 'Item is marked not applicable' using errcode = '22023'; end if;
  p_values := coalesce(p_values, '{}'::jsonb);
  if jsonb_typeof(p_values) <> 'object' then raise exception 'values must be an object' using errcode = '22023'; end if;
  if p_file is not null and not exists (select 1 from public.cob_files where id = p_file and item_id = p_item and deleted_at is null) then
    raise exception 'File does not belong to this item' using errcode = '22023';
  end if;
  if it.item_type = 'doc' and p_file is null and it.current_file_id is null then
    raise exception 'Upload a document first' using errcode = '22023';
  end if;
  for f in select * from jsonb_array_elements(it.fields) loop
    k := f->>'key'; col := f->>'target';
    if col is null or not (p_values ? k) then continue; end if;
    if not (col = any (public.cob_allowed_cols())) then continue; end if;
    v := nullif(btrim(p_values->>k), '');
    if col = 'name' and v is null then continue; end if;
    execute format('select %I::text from public.tenants where id = $1', col) into oldv using it.tenant_id;
    if oldv is not distinct from v then continue; end if;
    if col = 'incorporation_date' then
      execute format('update public.tenants set %I = $1::date where id = $2', col) using v, it.tenant_id;
    else
      execute format('update public.tenants set %I = $1 where id = $2', col) using v, it.tenant_id;
    end if;
    olds := olds || jsonb_build_object(col, oldv);
    applied := applied || jsonb_build_object('col', col, 'value', v);
  end loop;
  select coalesce(max(seq), 0) + 1 into n from public.cob_submissions where item_id = p_item;
  insert into public.cob_submissions (tenant_id, item_id, seq, values_new, values_old, applied, file_id, ai_used)
    values (it.tenant_id, p_item, n, p_values, olds, applied, coalesce(p_file, it.current_file_id), coalesce(p_ai, false))
    returning id into sid;
  update public.cob_items set status = 'submitted', status_reason = null, status_by = auth.uid(), status_at = now(),
    answers = answers || p_values, expiry_date = coalesce(p_expiry, expiry_date),
    current_file_id = coalesce(p_file, current_file_id), updated_by = auth.uid()
  where id = p_item;
  insert into public.cob_events (tenant_id, item_id, file_id, action, detail)
    values (it.tenant_id, p_item, p_file, 'submit', jsonb_build_object('submission_id', sid, 'applied', applied, 'ai', coalesce(p_ai, false)));
  if it.urgent then
    select name into tname from public.tenants where id = it.tenant_id;
    for adm in select id from public.user_profiles where lower(coalesce(role,'')) = 'platform_admin' loop
      insert into public.notifications (user_id, title, body, category)
      values (adm.id, 'SEGERA: Onboarding ' || coalesce(tname, '') || ' - ' || it.code, it.label_bm, 'onboarding');
    end loop;
  end if;
  return jsonb_build_object('submission_id', sid, 'urgent', it.urgent, 'applied', applied,
    'tenant_name', tname, 'admins', case when it.urgent then public.cob_admin_targets() else '[]'::jsonb end);
end $$;
grant execute on function public.cob_start(uuid), public.cob_submit(uuid, jsonb, uuid, boolean, date) to authenticated;
revoke execute on function public.cob_admin_targets() from public, anon, authenticated;
