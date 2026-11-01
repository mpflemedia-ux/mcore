-- Reports: Share via WhatsApp (public link, same concept as Salary Disbursement's
-- sd_sign_link_create / public-sd.html — one-time token, no login, server-generated
-- and only ever returned to the caller once; only the SHA-256 hash is stored).
--
-- Snapshot-based (not live re-query): the row/total figures the user was already
-- looking at are frozen into `snapshot` jsonb at share time, so the recipient sees
-- a stable, point-in-time view (like a receipt) and the public RPC never runs a
-- live tenant-data query — it only ever returns what was explicitly snapshotted.
--
-- Idempotent. Write-only — run in Supabase SQL Editor.

create table if not exists report_share_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  report_type text not null,
  title text,
  snapshot jsonb not null,
  token_hash text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists report_share_links_token_hash_idx
  on report_share_links(token_hash) where deleted_at is null;
create index if not exists report_share_links_tenant_idx
  on report_share_links(tenant_id, report_type) where deleted_at is null;

alter table report_share_links enable row level security;

drop policy if exists rsl_tenant_read on report_share_links;
create policy rsl_tenant_read on report_share_links for select
  using (tenant_id = get_tenant_id() or is_superadmin());

drop policy if exists rsl_write on report_share_links;
create policy rsl_write on report_share_links for insert
  with check (
    tenant_id = get_tenant_id()
    and get_user_role() = any(array['owner','admin','manager'])
    and not exists (
      select 1 from platform_support_sessions s
      where s.actor_id = auth.uid() and s.ended_at is null and s.view_only
        and s.deleted_at is null and s.tenant_id = report_share_links.tenant_id
    )
  );

drop policy if exists rsl_update on report_share_links;
create policy rsl_update on report_share_links for update
  using (tenant_id = get_tenant_id() and get_user_role() = any(array['owner','admin','manager']))
  with check (
    tenant_id = get_tenant_id()
    and get_user_role() = any(array['owner','admin','manager'])
    and not exists (
      select 1 from platform_support_sessions s
      where s.actor_id = auth.uid() and s.ended_at is null and s.view_only
        and s.deleted_at is null and s.tenant_id = report_share_links.tenant_id
    )
  );

drop policy if exists rsl_platform_admin on report_share_links;
create policy rsl_platform_admin on report_share_links for all
  using (is_platform_admin()) with check (is_platform_admin());

-- ---------- create: generates the raw token server-side, stores only its hash,
-- returns the raw token once (never persisted in plaintext) ----------
create or replace function report_share_link_create(
  p_report_type text, p_title text, p_snapshot jsonb, p_days int default 7
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid;
  v_role text;
  v_token text;
  v_hash text;
  v_id uuid;
  v_expires timestamptz;
begin
  v_tenant_id := get_tenant_id();
  v_role := get_user_role();
  if v_tenant_id is null or auth.uid() is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  if v_role not in ('owner','admin','manager') and not is_platform_admin() then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  if exists (
    select 1 from platform_support_sessions s
    where s.actor_id = auth.uid() and s.ended_at is null and s.view_only
      and s.deleted_at is null and s.tenant_id = v_tenant_id
  ) then
    raise exception 'View-only support session cannot create share links' using errcode = '42501';
  end if;
  if p_snapshot is null or p_report_type is null then
    raise exception 'Missing report_type/snapshot';
  end if;

  v_token := encode(gen_random_bytes(24), 'hex');
  v_hash := encode(digest(v_token, 'sha256'), 'hex');
  v_expires := now() + (greatest(1, least(coalesce(p_days, 7), 30)) || ' days')::interval;

  insert into report_share_links (tenant_id, report_type, title, snapshot, token_hash, expires_at, created_by)
  values (v_tenant_id, p_report_type, p_title, p_snapshot, v_hash, v_expires, auth.uid())
  returning id into v_id;

  return jsonb_build_object('link_id', v_id, 'token', v_token, 'expires_at', v_expires);
end;
$$;

-- ---------- public read: token -> frozen snapshot only. No tenant table is ever
-- queried live for this; it only returns pre-approved, already-shared data. ----------
create or replace function get_public_report(p_token text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_hash text;
  v_row record;
begin
  if p_token is null or length(p_token) < 10 then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;
  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  select l.*, t.name as tenant_name into v_row
  from report_share_links l
  join tenants t on t.id = l.tenant_id
  where l.token_hash = v_hash and l.deleted_at is null
  limit 1;

  if v_row.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_row.revoked_at is not null then
    return jsonb_build_object('ok', false, 'error', 'revoked');
  end if;
  if v_row.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  return jsonb_build_object(
    'ok', true,
    'report_type', v_row.report_type,
    'title', v_row.title,
    'company', v_row.tenant_name,
    'snapshot', v_row.snapshot,
    'created_at', v_row.created_at,
    'expires_at', v_row.expires_at
  );
end;
$$;

grant execute on function report_share_link_create(text, text, jsonb, int) to authenticated;
grant execute on function get_public_report(text) to anon, authenticated;

-- ---------- pre-existing bug found while wiring this feature's WAD.log() call:
-- doc_shares has TWO overlapping CHECK constraints on doc_type. The older
-- doc_shares_doc_chk (a narrower, stale list) is still enforced alongside the
-- newer doc_shares_doc_type_check and silently rejects doc_type IN ('sd','inv',
-- 'pos','project') -- confirmed by a rolled-back test insert. This means every
-- WhatsApp share of a Salary Disbursement batch (and invoices/projects) has been
-- failing doc_shares logging (an error toast, though the WhatsApp message itself
-- still opened) since whichever migration added doc_shares_doc_chk. Dropping the
-- stale constraint and extending the real one with 'report'/'rpt_share' (this
-- feature) fixes both at once. ----------
alter table doc_shares drop constraint if exists doc_shares_doc_chk;

alter table doc_shares drop constraint if exists doc_shares_doc_type_check;
alter table doc_shares add constraint doc_shares_doc_type_check check (
  doc_type is null or doc_type = any(array[
    'adv','arrem','bill','booking','cn','comm','do','exp','grn','inv','leave','ot',
    'payslip','po','pos','project','pv','pvd','quo','rcpt','report','sd','soa','splan','ssoa','wo'
  ])
);

alter table doc_shares drop constraint if exists doc_shares_template_check;
alter table doc_shares add constraint doc_shares_template_check check (
  template is null or template = any(array[
    'adv_result','ar_remind','bill_remit','cn_send','comm_send','confirm','do_remind','do_send',
    'exp_result','followup','grn_send','leave_result','ot_result','payslip_remind','payslip_send',
    'po_send','pv_remind','pv_sign','rcpt_send','receipt','remind_day','reminder_final','reminder_firm',
    'reminder_friendly','reschedule','rpt_share','sd_remind','sd_send','send','sign_req','soa_send',
    'ssoa_send','thanks','weekly','wo_send'
  ])
);

-- ---------- dev roadmap ----------
do $$
declare
  pr text := 'https://github.com/mpflemedia-ux/mcore/commits/main';
  ttl text := 'Reports: Share via WhatsApp (public link, same concept as Salary Disbursement)';
  descr text := 'Share button on Income Statement, Balance Sheet, Trial Balance, SST and Custom Report. Creates a one-time, SHA-256-hashed, 7-day-expiring public link (report_share_links + report_share_link_create/get_public_report RPCs — same token pattern as sd_sign_link_create), opens WhatsApp with a pre-filled message via WAD.open(). The public page (public-report.html) shows a frozen snapshot captured at share time, not a live query — the public RPC only ever returns pre-approved stored data. Owner/Admin/Manager can revoke a link any time; blocked for platform-admin view-only support sessions. Bonus fix found while wiring this: dropped a stale doc_shares_doc_chk constraint that was silently rejecting WhatsApp-share logging for doc_type sd/inv/pos/project (confirmed via a rolled-back test insert) — Salary Disbursement WhatsApp shares were erroring on the logging step.';
begin
  if exists (select 1 from public.dev_roadmap_items where title = ttl) then
    update public.dev_roadmap_items set stage = 'completed', module = 'accounting', description = descr, pr_url = pr where title = ttl;
  else
    insert into public.dev_roadmap_items (title, description, module, stage, pr_url) values (ttl, descr, 'accounting', 'completed', pr);
  end if;
exception when undefined_column or undefined_table then
  raise notice 'dev_roadmap schema variant; skip: %', sqlerrm;
end $$;
