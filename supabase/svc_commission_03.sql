-- M-Core — Service commission: free-text signatory names (same concept as SD Prepared By / Checked By / ... name fields).
-- svc_commission_03.sql — WRITE-ONLY: Mike runs this in Supabase SQL editor AFTER svc_commission_02.sql. Rerun-safe (idempotent), guarded.
--
-- What changes:
--   svc_comm_months.prepared_by_name / approved_by_name   typed names for the two slots (any name, not locked to staff / Owner/HR),
--                                                          like sd batches' prepared_by_name / first_approval_name columns.
--   svc_sign_names(...)        RPC to save them (Owner/HR: both slots; the staff member: own Prepared by only). Works on draft,
--                              submitted and approved months (names never change amounts, so signatures are NOT voided).
--   svc__sign_slots(uuid)      now also returns 'name' (signed name, else the typed name) so public-svc.html prefills it.
-- Unchanged: who may SIGN (prepared: staff-self or Owner/HR; approved: Owner/HR), status gates, links, notifications.
--   svc_sign_app / svc_sign_public already take a free p_name; svc__sign_label has no staff/Owner/HR suffix.
-- Seed / data: none. Tenant data is untouched (new columns start empty; the app falls back to the employee name).

begin;

select 1 / (case when to_regclass('public.svc_signatures') is null then 0 else 1 end) as svc_commission_02_present;

-- ---------- 1) name columns ----------
alter table public.svc_comm_months add column if not exists prepared_by_name text;
alter table public.svc_comm_months add column if not exists approved_by_name text;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.svc_comm_months'::regclass and conname = 'svc_comm_months_signames_ck') then
    alter table public.svc_comm_months add constraint svc_comm_months_signames_ck
      check ((prepared_by_name is null or length(prepared_by_name) <= 120) and (approved_by_name is null or length(approved_by_name) <= 120));
  end if;
end $$;
-- no direct column grants: writes go through svc_sign_names() only

-- ---------- 2) save names ----------
-- p_prepared / p_approved: null = leave as is, '' = clear, text = set (trimmed, max 120)
create or replace function public.svc_sign_names(p_emp uuid, p_month int, p_year int, p_prepared text default null, p_approved text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tid uuid := public.svc__my_tenant();
  hr boolean; me boolean; rid uuid;
  np text := case when p_prepared is null then null else left(btrim(p_prepared), 120) end;
  na text := case when p_approved is null then null else left(btrim(p_approved), 120) end;
  m public.svc_comm_months%rowtype;
begin
  if auth.uid() is null or tid is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  if p_month is null or p_month not between 1 and 12 or p_year is null or p_year not between 2000 and 2100 then raise exception 'Invalid period' using errcode = '22023'; end if;
  hr := public.svc__is_hr(tid);
  me := public.svc__is_me(tid, p_emp);
  if not hr and not me then raise exception 'not allowed' using errcode = '42501'; end if;
  if not hr and na is not null then raise exception 'Only HR managers can change Approved by' using errcode = '42501'; end if;
  rid := public.svc__sign_month(tid, p_emp, p_month, p_year);
  if rid is null then rid := public.svc__month_row(tid, p_emp, p_month, p_year); end if;
  update public.svc_comm_months set
    prepared_by_name = case when np is null then prepared_by_name else nullif(np, '') end,
    approved_by_name = case when na is null then approved_by_name else nullif(na, '') end
  where id = rid
  returning * into m;
  return jsonb_build_object('month_id', m.id, 'prepared_by_name', m.prepared_by_name, 'approved_by_name', m.approved_by_name);
end;
$$;

-- ---------- 3) slots carry the typed name (public page prefill) ----------
create or replace function public.svc__sign_slots(p_mid uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'role', r.role,
    'signed', s.id is not null,
    'signer_name', s.signer_name,
    'signed_at', s.signed_at,
    'signed_via', s.signed_via,
    'name', coalesce(s.signer_name, case r.role when 'prepared' then m.prepared_by_name else m.approved_by_name end)
  ) order by r.ord), '[]'::jsonb)
  from (values ('prepared', 1), ('approved', 2)) r(role, ord)
  left join public.svc_comm_months m on m.id = p_mid
  left join public.svc_signatures s on s.month_id = p_mid and s.role = r.role and s.voided_at is null
$$;

-- ---------- 4) grants ----------
revoke all on function public.svc__sign_slots(uuid) from public, anon, authenticated;
revoke all on function public.svc_sign_names(uuid, int, int, text, text) from public, anon;
grant execute on function public.svc_sign_names(uuid, int, int, text, text) to authenticated;

-- ---------- 5) dev roadmap ----------
update public.dev_roadmap_items set stage = 'completed', module = 'hr',
  description = 'Service Commission signatures card now works like SD: labels are just "Prepared by" / "Approved by" (no staff / Owner/HR suffix) and each slot has an editable name field (any name). The typed name is saved per employee-month (svc_comm_months.prepared_by_name / approved_by_name), used in the WhatsApp message, prefilled on the sign pad and on public-svc.html, and shown on the A4 statement + PDF. Who may sign is unchanged.'
where title = 'Service commission: free-text signatory names';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Service commission: free-text signatory names',
  'Service Commission signatures card now works like SD: labels are just "Prepared by" / "Approved by" (no staff / Owner/HR suffix) and each slot has an editable name field (any name). The typed name is saved per employee-month (svc_comm_months.prepared_by_name / approved_by_name), used in the WhatsApp message, prefilled on the sign pad and on public-svc.html, and shown on the A4 statement + PDF. Who may sign is unchanged.',
  'hr', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Service commission: free-text signatory names');

commit;

notify pgrst, 'reload schema';

-- ---------- checks (read-only) ----------
select (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'svc_comm_months'
          and column_name in ('prepared_by_name', 'approved_by_name')) as name_cols_2,
       to_regprocedure('public.svc_sign_names(uuid,integer,integer,text,text)') is not null as svc_sign_names_fn,
       (select pg_get_functiondef('public.svc__sign_slots(uuid)'::regprocedure) like '%prepared_by_name%') as slots_have_name,
       (select stage from public.dev_roadmap_items where title = 'Service commission: free-text signatory names' limit 1) as roadmap_stage;
