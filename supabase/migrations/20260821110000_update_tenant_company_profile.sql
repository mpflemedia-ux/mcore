-- Company Profile save: tenants column UPDATE is often blocked by RLS for
-- members (SELECT works, UPDATE returns 0 rows). Same pattern as
-- merge_tenant_config — SECURITY DEFINER + owner/admin/platform_admin check.
-- Mike: run this in Supabase SQL Editor (not auto-deployed from GitHub).

create or replace function public.update_tenant_company_profile(
  p_tenant_id uuid,
  p_profile jsonb
)
returns public.tenants
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  caller_email text;
  caller_tid uuid;
  result public.tenants;
begin
  if p_tenant_id is null then
    raise exception 'tenant id required' using errcode = '22023';
  end if;
  if p_profile is null or jsonb_typeof(p_profile) <> 'object' then
    raise exception 'profile object required' using errcode = '22023';
  end if;

  select up.role, up.tenant_id
    into caller_role, caller_tid
  from public.user_profiles up
  where up.id = auth.uid();

  -- Same-tenant for owner/admin; platform_admin may update any tenant
  if coalesce(caller_role, '') = 'platform_admin' then
    null; -- allowed
  elsif coalesce(caller_role, '') in ('owner', 'admin') and caller_tid is not null and caller_tid = p_tenant_id then
    null; -- allowed
  else
    select email into caller_email from auth.users where id = auth.uid();
    if caller_email is null or not (
      caller_email ilike '%mpflemedia%' or caller_email ilike '%phion%'
    ) then
      raise exception 'Only owner/admin can update company profile' using errcode = '42501';
    end if;
  end if;

  update public.tenants set
    name = coalesce(nullif(trim(p_profile->>'name'), ''), name),
    logo_url = case when p_profile ? 'logo_url' then nullif(p_profile->>'logo_url','') else logo_url end,
    payment_qr_url = case when p_profile ? 'payment_qr_url' then nullif(p_profile->>'payment_qr_url','') else payment_qr_url end,
    ssm_no = case when p_profile ? 'ssm_no' then nullif(p_profile->>'ssm_no','') else ssm_no end,
    incorporation_date = case
      when p_profile ? 'incorporation_date' and nullif(p_profile->>'incorporation_date','') is not null
        then (p_profile->>'incorporation_date')::date
      when p_profile ? 'incorporation_date' then null
      else incorporation_date end,
    address = case when p_profile ? 'address' then nullif(p_profile->>'address','') else address end,
    address_line2 = case when p_profile ? 'address_line2' then nullif(p_profile->>'address_line2','') else address_line2 end,
    city = case when p_profile ? 'city' then coalesce(p_profile->>'city','') else city end,
    postcode = case when p_profile ? 'postcode' then coalesce(p_profile->>'postcode','') else postcode end,
    state = case when p_profile ? 'state' then coalesce(p_profile->>'state','') else state end,
    country = case when p_profile ? 'country' then nullif(p_profile->>'country','') else country end,
    email = case when p_profile ? 'email' then coalesce(p_profile->>'email','') else email end,
    phone = case when p_profile ? 'phone' then coalesce(p_profile->>'phone','') else phone end,
    fax = case when p_profile ? 'fax' then nullif(p_profile->>'fax','') else fax end,
    website = case when p_profile ? 'website' then nullif(p_profile->>'website','') else website end,
    bank_name = case when p_profile ? 'bank_name' then nullif(p_profile->>'bank_name','') else bank_name end,
    account_number = case when p_profile ? 'account_number' then nullif(p_profile->>'account_number','') else account_number end,
    account_name = case when p_profile ? 'account_name' then nullif(p_profile->>'account_name','') else account_name end,
    sst_gst_no = case when p_profile ? 'sst_gst_no' then nullif(p_profile->>'sst_gst_no','') else sst_gst_no end,
    tax_type = case when p_profile ? 'tax_type' then nullif(p_profile->>'tax_type','') else tax_type end,
    currency = case when p_profile ? 'currency' then coalesce(nullif(p_profile->>'currency',''), 'MYR') else currency end,
    invoice_terms = case when p_profile ? 'invoice_terms' then nullif(p_profile->>'invoice_terms','') else invoice_terms end,
    updated_at = now()
  where id = p_tenant_id
  returning * into result;

  if result.id is null then
    raise exception 'Tenant not found' using errcode = 'P0002';
  end if;

  return result;
end;
$$;

grant execute on function public.update_tenant_company_profile(uuid, jsonb) to authenticated;
