-- M-Core Onboarding Checklist - part 1/5: tables (run parts 1..5 in order in Supabase SQL editor).
-- Platform master (versioned, published) is copied per tenant. Soft delete via deleted_at everywhere.
-- Idempotent: safe to re-run.
create table if not exists public.cob_master_versions (
  id uuid primary key default gen_random_uuid(),
  version int not null,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  note text,
  published_at timestamptz, published_by uuid,
  created_at timestamptz not null default now(), created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(), deleted_at timestamptz
);
create unique index if not exists cob_master_versions_version_uq on public.cob_master_versions(version) where deleted_at is null;

create table if not exists public.cob_master_sections (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.cob_master_versions(id),
  key text not null check (key ~ '^[A-Z]$'),
  name_bm text not null, name_en text not null,
  is_core boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create unique index if not exists cob_master_sections_uq on public.cob_master_sections(version_id, key) where deleted_at is null;

create table if not exists public.cob_master_items (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.cob_master_versions(id),
  section_key text not null,
  code text not null check (code ~ '^[A-Z][0-9]{1,2}$'),
  sort_order int not null default 0,
  label_bm text not null, label_en text not null,
  note_bm text, note_en text,
  requirement text not null default 'required' check (requirement in ('required','if_applicable')),
  item_type text not null default 'doc' check (item_type in ('doc','form','list')),
  fields jsonb not null default '[]'::jsonb,
  ai_action text check (ai_action in ('scan_ssm_certificate','scan_bank_statement')),
  template_header text,
  track_expiry boolean not null default false,
  urgent boolean not null default false,
  module_page text, module_params jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(), deleted_at timestamptz
);
create unique index if not exists cob_master_items_uq on public.cob_master_items(version_id, code) where deleted_at is null;

create table if not exists public.cob_checklists (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  master_version_id uuid references public.cob_master_versions(id),
  status text not null default 'active' check (status in ('active','completed')),
  started_at timestamptz not null default now(),
  target_date date,
  pic_user_id uuid, pic_name text,
  completed_at timestamptz,
  last_reminder_at timestamptz,
  created_at timestamptz not null default now(), created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(), deleted_at timestamptz
);
create unique index if not exists cob_checklists_tenant_uq on public.cob_checklists(tenant_id) where deleted_at is null;

create table if not exists public.cob_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  checklist_id uuid not null references public.cob_checklists(id),
  master_item_id uuid,
  section_key text not null, section_name_bm text not null, section_name_en text not null,
  section_core boolean not null default false, section_sort int not null default 0,
  code text not null, sort_order int not null default 0,
  label_bm text not null, label_en text not null, note_bm text, note_en text,
  requirement text not null default 'required' check (requirement in ('required','if_applicable')),
  item_type text not null default 'doc' check (item_type in ('doc','form','list')),
  fields jsonb not null default '[]'::jsonb,
  ai_action text, template_header text,
  track_expiry boolean not null default false, urgent boolean not null default false,
  module_page text, module_params jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','submitted','approved','rejected','na')),
  status_reason text, status_by uuid, status_at timestamptz,
  answers jsonb not null default '{}'::jsonb,
  expiry_date date,
  current_file_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), updated_by uuid, deleted_at timestamptz
);
create unique index if not exists cob_items_uq on public.cob_items(checklist_id, code) where deleted_at is null;
create index if not exists cob_items_tenant_idx on public.cob_items(tenant_id, status);

create table if not exists public.cob_files (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  item_id uuid not null references public.cob_items(id),
  version_no int not null default 1,
  storage_path text not null,
  file_name text not null, mime_type text, size_bytes bigint,
  public_url text,
  uploaded_by uuid default auth.uid(),
  created_at timestamptz not null default now(), deleted_at timestamptz
);
create unique index if not exists cob_files_ver_uq on public.cob_files(item_id, version_no);

create table if not exists public.cob_submissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  item_id uuid not null references public.cob_items(id),
  seq int not null default 1,
  values_new jsonb not null default '{}'::jsonb,
  values_old jsonb not null default '{}'::jsonb,
  applied jsonb not null default '[]'::jsonb,
  file_id uuid references public.cob_files(id),
  ai_used boolean not null default false,
  submitted_by uuid default auth.uid(),
  submitted_at timestamptz not null default now(),
  decision text check (decision in ('approved','rejected')),
  decision_reason text, decided_by uuid, decided_at timestamptz,
  restore_result jsonb,
  created_at timestamptz not null default now(), deleted_at timestamptz
);
create index if not exists cob_submissions_item_idx on public.cob_submissions(item_id, seq desc);
create index if not exists cob_submissions_pending_idx on public.cob_submissions(submitted_at) where decision is null and deleted_at is null;

create table if not exists public.cob_comments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  item_id uuid not null references public.cob_items(id),
  user_id uuid not null default auth.uid(),
  author_name text,
  is_platform boolean not null default false,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(), deleted_at timestamptz
);
create index if not exists cob_comments_item_idx on public.cob_comments(item_id, created_at);

create table if not exists public.cob_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  item_id uuid, file_id uuid,
  action text not null check (action in ('start','submit','approve','reject','na','reopen','view_doc','view_full','reminder','comment','publish')),
  detail jsonb not null default '{}'::jsonb,
  user_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists cob_events_tenant_idx on public.cob_events(tenant_id, created_at desc);
create index if not exists cob_events_item_idx on public.cob_events(item_id, created_at desc);
