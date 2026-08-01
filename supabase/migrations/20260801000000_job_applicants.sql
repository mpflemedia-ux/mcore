-- ============================================================================
-- Migration: Job Applicants (Recruitment) + Convert-to-Employee support
-- NOTE: Supabase Edge Functions/migrations do NOT auto-deploy from GitHub —
-- run this manually in Supabase Dashboard -> SQL Editor.
--
-- The ai-proxy edge function's new 'scan_application_form' action ALSO
-- requires a manual redeploy of supabase/functions/ai-proxy/index.ts after
-- this PR is merged — pushing to GitHub does not deploy edge function code.
-- ============================================================================

-- ---------- job_applicants ----------
create table job_applicants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  ref_no text not null,
  -- Section 1: Position Applied
  position_applied text not null,
  expected_salary numeric,
  available_date date,
  -- Section 2: Personal Particulars
  full_name text not null,
  ic_no text,
  dob date,
  gender text check (gender in ('male','female')),
  nationality text,
  marital_status text check (marital_status in ('single','married','divorced','widowed')),
  mobile_no text,
  email text,
  home_address text,
  -- Section 3 & 4: stored as JSON array (multiple rows in form)
  education jsonb default '[]',          -- [{qualification, institution, year_completed}]
  employment_history jsonb default '[]', -- [{company, position_duration, reason_leaving}]
  -- Section 5: Language Proficiency
  language_proficiency jsonb default '{}', -- {bm:{spoken,written}, en:{spoken,written}, others:{name,spoken,written}}
  -- Section 6: Emergency Contact
  emergency_name text,
  emergency_relationship text,
  emergency_mobile text,
  emergency_address text,
  -- Section: For Office Use
  interview_date date,
  interviewed_by text,
  status text not null default 'pending' check (status in ('pending','interviewed','approved','rejected')),
  remarks text,
  converted_employee_id uuid references employees(id),
  created_at timestamptz default now(),
  deleted_at timestamptz
);

create index on job_applicants(tenant_id) where deleted_at is null;

alter table job_applicants enable row level security;

create policy "job_applicants_select_own_tenant" on job_applicants
  for select using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));
create policy "job_applicants_insert_own_tenant" on job_applicants
  for insert with check (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));
create policy "job_applicants_update_own_tenant" on job_applicants
  for update using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()))
  with check (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));
create policy "job_applicants_delete_own_tenant" on job_applicants
  for delete using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));

-- ---------- employees: extend with personal fields (for convert-from-applicant) ----------
alter table employees add column phone text;
alter table employees add column email text;
alter table employees add column address text;
alter table employees add column dob date;
alter table employees add column gender text;
alter table employees add column nationality text;
alter table employees add column marital_status text;
alter table employees add column emergency_name text;
alter table employees add column emergency_relationship text;
alter table employees add column emergency_mobile text;
alter table employees add column emergency_address text;
alter table employees add column original_applicant_id uuid references job_applicants(id);
