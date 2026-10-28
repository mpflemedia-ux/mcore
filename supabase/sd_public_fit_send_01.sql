-- Public SD mobile scroll + Send storage RLS harden
-- WRITE ONLY — Mike runs in Supabase SQL Editor. Do not execute from agents.
-- Idempotent: DROP POLICY IF EXISTS + CREATE; CREATE OR REPLACE function; roadmap upsert.

-- ---------- 1) Re-assert storage policy for public SD signature upload ----------
-- Path shape: doc-files/{tenant_id}/sd-approvals/{token}/{file}
drop policy if exists doc_files_sd_ins on storage.objects;
create policy doc_files_sd_ins on storage.objects for insert to anon, authenticated with check (
  bucket_id = 'doc-files'
  and (storage.foldername(name))[2] = 'sd-approvals'
  and exists (select 1 from public.doc_public_links l
    where l.tenant_id::text = (storage.foldername(name))[1] and l.doc_type = 'sd'
      and l.token_hash = encode(sha256(convert_to((storage.foldername(name))[3], 'UTF8')), 'hex')
      and l.revoked_at is null and l.deleted_at is null and l.expires_at > now()));

-- ---------- 2) Re-assert sd_approvals public INSERT (token + rate limit) ----------
drop policy if exists sd_approvals_public_ins on public.sd_approvals;
create policy sd_approvals_public_ins on public.sd_approvals for insert to anon, authenticated with check (
  status = 'pending' and reviewed_by is null and reviewed_at is null and notified_at is null and deleted_at is null and reject_reason is null
  and exists (select 1 from public.doc_public_links l
    where l.id = sd_approvals.link_id and l.tenant_id = sd_approvals.tenant_id and l.doc_type = 'sd' and l.doc_id = sd_approvals.batch_id
      and l.token_hash = encode(sha256(convert_to(sd_approvals.token, 'UTF8')), 'hex')
      and l.revoked_at is null and l.deleted_at is null and l.expires_at > now())
  and (select count(*) from public.sd_approvals a where a.link_id = sd_approvals.link_id and a.created_at > now() - interval '10 minutes') < 3);

-- Keep anon column grants aligned (idempotent)
grant select (id, link_id, status, created_at, deleted_at) on public.sd_approvals to anon;
grant insert (tenant_id, batch_id, link_id, token, approver_name, storage_path, file_name, mime_type, size_bytes) on public.sd_approvals to anon;

-- ---------- 3) Harden get_public_salary_batch — reject soft-deleted links (align with storage/insert RLS) ----------
CREATE OR REPLACE FUNCTION public.get_public_salary_batch(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b salary_disbursement_batches%ROWTYPE;
  tn tenants%ROWTYPE;
  cp jsonb;
  rows jsonb;
  link doc_public_links%ROWTYPE;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 8 THEN
    RAISE EXCEPTION 'Invalid token';
  END IF;
  SELECT * INTO b FROM salary_disbursement_batches WHERE public_token = trim(p_token) AND deleted_at IS NULL LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch not found';
  END IF;

  SELECT * INTO link FROM doc_public_links
    WHERE doc_type = 'sd' AND doc_id = b.id
      AND token_hash = encode(sha256(convert_to(trim(p_token), 'UTF8')), 'hex')
    LIMIT 1;
  IF NOT FOUND OR link.revoked_at IS NOT NULL OR link.deleted_at IS NOT NULL OR link.expires_at <= now() THEN
    RAISE EXCEPTION 'Link expired or revoked';
  END IF;

  SELECT * INTO tn FROM tenants WHERE id = b.tenant_id;
  cp := coalesce(tn.config->'company_profile', '{}'::jsonb);

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'name', e.name,
    'position', e.position,
    'bank_name', e.bank_name,
    'bank_account_no', e.bank_account_no,
    'basic_salary', pr.basic_salary,
    'allowance_total', coalesce(pr.allowance_1,0) + coalesce(pr.allowance_2,0) + coalesce(pr.allowance_3,0),
    'epf_employee', pr.epf_employee,
    'socso_employee', pr.socso_employee,
    'eis_employee', pr.eis_employee,
    'pcb', pr.pcb,
    'deduction_total', coalesce(pr.deduction_1,0) + coalesce(pr.deduction_2,0) + coalesce(pr.advance,0),
    'ot_amount', coalesce(pr.ot_amount,0),
    'net_pay', pr.net_pay
  ) ORDER BY e.name), '[]'::jsonb)
  INTO rows
  FROM payroll_records pr
  JOIN employees e ON e.id = pr.employee_id
  WHERE pr.tenant_id = b.tenant_id AND pr.month = b.month AND pr.year = b.year;

  RETURN jsonb_build_object(
    'batch_id', b.id,
    'tenant_id', b.tenant_id,
    'link_id', link.id,
    'status', b.status,
    'month', b.month,
    'year', b.year,
    'tenant_name', coalesce(nullif(tn.name,''), cp->>'name'),
    'logo_url', coalesce(nullif(tn.logo_url,''), cp->>'logo_url'),
    'address', coalesce(nullif(tn.address,''), cp->>'address'),
    'rows', rows,
    'grand_total_net_pay', b.total_net_pay
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_salary_batch(text) TO anon, authenticated;

notify pgrst, 'reload schema';

-- ---------- 4) System Development roadmap ----------
update public.dev_roadmap_items
set stage = 'completed',
    module = 'hr_payroll',
    description = coalesce(description, '') ||
      case when description ilike '%psd-scroll%' then ''
           else E'\n[2026-10-28] Public SD: .psd-scroll mobile table; re-assert doc_files_sd_ins + sd_approvals_public_ins; RPC deleted_at; anon client persistSession false; clearer Send errors.'
      end
where title = 'Public SD mobile scroll + Send storage RLS';

insert into public.dev_roadmap_items (title, description, module, stage)
select
  'Public SD mobile scroll + Send storage RLS',
  'public-sd.html table wrap .psd-scroll (horizontal swipe like in-app pdoc-sd-scroll); re-assert doc_files_sd_ins + sd_approvals_public_ins; get_public_salary_batch rejects soft-deleted links; sd-approve-pub clearer EN/BM errors; createClient persistSession false.',
  'hr_payroll',
  'completed'
where not exists (
  select 1 from public.dev_roadmap_items
  where title = 'Public SD mobile scroll + Send storage RLS'
);
