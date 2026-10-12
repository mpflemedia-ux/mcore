-- M-Core Onboarding Checklist - part 6: patch. Run after parts 1-5. Idempotent: safe to re-run.
-- 1) submission decision may also be 'na' (closed by Tak berkenaan) or 'superseded' (tenant resubmitted before review).
-- 2) cob_submit: resubmitting before review supersedes the older pending submission and keeps its ORIGINAL old values,
--    so a later reject restores the values from before onboarding (not the in-between value).
-- 3) cob_set_status('na') also closes the item's pending submission so it leaves the review queue.
alter table public.cob_submissions drop constraint if exists cob_submissions_decision_check;
alter table public.cob_submissions add constraint cob_submissions_decision_check check (decision in ('approved','rejected','na','superseded'));

-- Submit: data applies to the tenant IMMEDIATELY (old values stored for restore). Item -> 'submitted'.
create or replace function public.cob_submit(p_item uuid, p_values jsonb default '{}'::jsonb, p_file uuid default null,
  p_ai boolean default false, p_expiry date default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare it public.cob_items%rowtype; f jsonb; k text; col text; v text; oldv text; olds jsonb := '{}'; applied jsonb := '[]';
  sid uuid; n int; tname text; adm record; pv record; a jsonb; pk text; c_old jsonb := '{}'; c_val jsonb := '{}';
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
  -- Resubmit before review: earlier pending submissions are superseded. Keep their ORIGINAL old values and their
  -- applied columns, so a reject of this submission restores the values from before onboarding.
  for pv in select s.values_old, s.applied from public.cob_submissions s where s.item_id = p_item and s.decision is null and s.deleted_at is null order by s.seq loop
    for a in select * from jsonb_array_elements(pv.applied) loop
      pk := a->>'col';
      if not (c_old ? pk) then c_old := c_old || jsonb_build_object(pk, pv.values_old->pk); end if;
      c_val := c_val || jsonb_build_object(pk, a->>'value');
    end loop;
  end loop;
  for pk in select jsonb_object_keys(c_old) loop
    olds := olds || jsonb_build_object(pk, c_old->pk);
    if not exists (select 1 from jsonb_array_elements(applied) x where x->>'col' = pk) then
      applied := applied || jsonb_build_object('col', pk, 'value', c_val->>pk);
    end if;
  end loop;
  update public.cob_submissions set decision = 'superseded', decided_at = now()
    where item_id = p_item and decision is null and deleted_at is null;
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
  -- not applicable closes any submission still waiting for review (values stay as submitted)
  if p_status = 'na' then
    update public.cob_submissions set decision = 'na', decision_reason = nullif(btrim(coalesce(p_reason, '')), ''), decided_by = auth.uid(), decided_at = now()
    where item_id = p_item and decision is null and deleted_at is null;
  end if;
  insert into public.cob_events (tenant_id, item_id, action, detail)
    values (it.tenant_id, p_item, case when p_status = 'na' then 'na' else 'reopen' end, jsonb_build_object('reason', p_reason));
  perform public.cob_recompute(it.checklist_id);
end $$;

grant execute on function public.cob_submit(uuid, jsonb, uuid, boolean, date), public.cob_set_status(uuid, text, text) to authenticated;
