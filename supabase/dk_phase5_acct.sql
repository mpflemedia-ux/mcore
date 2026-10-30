-- dk_phase5_acct.sql — DK Phase 5 · Accounting & reports (AR aging bulk reminders, AP due-soon digest)
-- WRITE-ONLY artefact: review, then run once in the Supabase SQL editor AFTER dk_phase0_kit.sql (+ phase 1-4). Idempotent.
-- 1) widen doc_shares / wa_templates checks for the new WhatsApp payment-reminder template ('arrem' / 'ar_remind')
--    so AR-aging bulk reminders are logged like every other share (never shrinks; NOT VALID).
-- 2) public.dk_ap_due_run() — daily digest of supplier bills overdue or due within 3 days (MYT), once per bill per day:
--      → owner/admin/finance/accountant (finance.dk_ap_due), deep link reports → AP aging. Counts + bill numbers only, no amounts.
--    (Overdue CUSTOMER invoices are already digested by dk_remind_run() from Phase 0 → reports/ar-aging, where the
--     new bulk reminder lives.) Cron caller = all tenants; signed-in caller = own tenant only, approver roles only.
-- 3) pg_cron job 'mcore-dk-ap-due' 01:05 UTC (09:05 MYT) — skipped with a notice when pg_cron is unavailable.
-- 4) roadmap row → completed.

-- ---------- 1) widen checks ----------
do $$
declare
  r record; c record; vals text[];
begin
  for r in
    select * from (values
      ('public.doc_shares', 'doc_type', array['arrem']),
      ('public.doc_shares', 'template', array['ar_remind']),
      ('public.wa_templates', 'doc_type', array['arrem']),
      ('public.wa_templates', 'template_key', array['ar_remind'])
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

-- ---------- 2) AP due-soon digest ----------
create or replace function public.dk_ap_due_run() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  tid uuid; today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  r record; n_bill int := 0; refs text;
begin
  if to_regclass('public.supplier_bills') is null or to_regclass('public.dk_doc_events') is null
     or to_regprocedure('public.dk__notify(uuid,text[],uuid[],uuid,text,text,text,text,text,jsonb,text,uuid,text)') is null then
    return jsonb_build_object('ok', false, 'reason', 'missing');
  end if;
  if auth.uid() is not null then
    tid := public.dk__tid();
    if tid is null or not coalesce(public.dk__is_approver(), false) then return jsonb_build_object('ok', false); end if;
  end if;
  begin
    for r in execute $q$
      select b.tenant_id, count(*) n, count(*) filter (where b.due_date < $1) n_over,
             string_agg(coalesce(nullif(b.bill_no, ''), '?'), ', ' order by b.due_date) filter (where rn <= 3) refs, array_agg(b.id) ids
      from (select b.*, row_number() over (partition by b.tenant_id order by b.due_date) rn from public.supplier_bills b
            where b.deleted_at is null and b.due_date is not null and b.due_date <= $1 + 3
              and lower(coalesce(b.status, '')) not in ('paid', 'cancelled', 'void', 'voided', 'draft')
              and coalesce(b.total, 0) - coalesce(b.paid_amt, 0) > 0.005
              and ($2::uuid is null or b.tenant_id = $2)
              and not exists (select 1 from public.dk_doc_events e where e.tenant_id = b.tenant_id and e.doc_type = 'bill' and e.doc_id = b.id
                              and e.event = 'reminder' and e.day = $1 and e.note = 'ap_due')) b
      group by b.tenant_id $q$ using today, tid
    loop
      insert into public.dk_doc_events (tenant_id, doc_type, doc_id, event, day, note)
      select r.tenant_id, 'bill', x, 'reminder', today, 'ap_due' from unnest(r.ids) x on conflict do nothing;
      refs := r.refs || case when r.n > 3 then ' +' || (r.n - 3) else '' end;
      perform public.dk__notify(r.tenant_id, array['owner', 'admin', 'finance', 'accountant'], null, null,
        r.n || ' supplier bill' || case when r.n > 1 then 's' else '' end || ' to pay', r.n || ' bil pembekal perlu dibayar',
        concat_ws(', ', case when r.n_over > 0 then r.n_over || ' overdue' end, case when r.n > r.n_over then (r.n - r.n_over) || ' due within 3 days' end) || ': ' || refs || '. Tap for AP aging.',
        concat_ws(', ', case when r.n_over > 0 then r.n_over || ' lewat tempoh' end, case when r.n > r.n_over then (r.n - r.n_over) || ' perlu dibayar dalam 3 hari' end) || ': ' || refs || '. Ketik untuk aging AP.',
        'finance.dk_ap_due', jsonb_build_object('page', 'reports', 'params', jsonb_build_object('view', 'ap-aging'), 'icon', 'ti-calendar-due'),
        'supplier_bills', null, 'dk_ap_due:' || today);
      n_bill := n_bill + r.n;
    end loop;
  exception when undefined_column or undefined_table then
    return jsonb_build_object('ok', false, 'reason', sqlerrm);
  end;
  return jsonb_build_object('ok', true, 'bills', n_bill);
end;
$$;
revoke all on function public.dk_ap_due_run() from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on function public.dk_ap_due_run() from anon'; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then execute 'grant execute on function public.dk_ap_due_run() to authenticated'; end if;
end $$;

-- ---------- 3) daily cron (09:05 MYT) ----------
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron not available (%); schedule dk_ap_due_run() manually', sqlerrm; return;
  end;
  if to_regclass('cron.job') is null then raise notice 'pg_cron schema missing'; return; end if;
  perform cron.unschedule(jobid) from cron.job where jobname = 'mcore-dk-ap-due';
  perform cron.schedule('mcore-dk-ap-due', '5 1 * * *', 'select public.dk_ap_due_run()');
end $$;

-- ---------- 4) roadmap ----------
do $$
begin
  if to_regclass('public.dev_roadmap_items') is null then return; end if;
  update public.dev_roadmap_items set stage = 'completed' where title = 'DK Phase 5 — Accounting cards & AR aging reminders';
  if not found then
    insert into public.dev_roadmap_items (title, description, module, stage)
    values ('DK Phase 5 — Accounting cards & AR aging reminders', 'Chart of accounts / journals / fiscal years / fixed assets / payment vouchers / disbursements / AR & AP aging → card lists at all widths; AR aging bulk payment reminders (one WhatsApp per customer via the share queue, or per-customer mailto), logged on the invoice timeline; daily AP due-soon digest (bell + push, no amounts) via pg_cron.', 'accounting', 'completed');
  end if;
end $$;
