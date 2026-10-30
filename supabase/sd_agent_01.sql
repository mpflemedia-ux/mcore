reset role;

-- SR Agent Backend — FASA 1 (DB). Agent luar (scheduled task) proses Service Request
-- automatik melalui Edge Function sd-agent (service role sahaja, dikunci x-agent-secret).
-- Agent tak pernah akses storage/DB terus — semua tindakan lalu Edge Function.
--
-- Audit disahkan terhadap live schema (Supabase MCP list_tables) + kod sebenar sebelum tulis:
-- - service_requests/service_request_events/service_catalog/doc_counters/notifications semua
--   dah wujud tepat macam FAKTA AUDIT. service_request_events.type dah benarkan 'internal_note'
--   (type_check sedia ada) — tiada ALTER diperlukan.
-- - RLS service_request_events_read sudah EXCLUDE type='internal_note' untuk tenant client
--   (type <> 'internal_note' and tenant_id = ...) — CONFIRMED, tiada fix diperlukan di situ.
-- - tenants.config->letterhead guna pattern sedia ada (merge_tenant_config RPC, sama macam
--   config->company_profile) — tiada table/column baru diperlukan untuk letterhead.
-- - doc_counters (tenant_id, counter_key, last_seq) sedia ada, cukup untuk next_ref action.
--
-- Write-only, idempotent. Run SEKALI dalam Supabase SQL Editor, lepas servicedesk_all_v2.sql.

-- ---------- 1) sd_agent_settings: satu baris per tenant, master switch enabled + services[] ----------
create table if not exists public.sd_agent_settings (
  tenant_id uuid primary key references public.tenants(id),
  enabled boolean not null default false,
  services text[] not null default '{letters,admin_docs}',
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.sd_agent_settings enable row level security;
revoke all on public.sd_agent_settings from anon;

drop policy if exists sd_agent_settings_rw on public.sd_agent_settings;
create policy sd_agent_settings_rw on public.sd_agent_settings for all to authenticated
  using (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'))
  with check (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));

grant select, insert, update on public.sd_agent_settings to authenticated;

-- ---------- 2) sd_agent_runs: audit log of every agent action (platform_admin read; writes are
-- service-role only — the Edge Function uses the service key, which bypasses RLS entirely, so
-- deliberately NO insert/update policy exists here for 'authenticated' at all) ----------
create table if not exists public.sd_agent_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id),
  request_id uuid references public.service_requests(id),
  action text not null,
  status text not null check (status in ('ok', 'error', 'skipped')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists sd_agent_runs_recent_idx on public.sd_agent_runs (created_at desc) where deleted_at is null;
create index if not exists sd_agent_runs_request_idx on public.sd_agent_runs (request_id, created_at) where deleted_at is null;
alter table public.sd_agent_runs enable row level security;
revoke all on public.sd_agent_runs from anon;

drop policy if exists sd_agent_runs_read on public.sd_agent_runs;
create policy sd_agent_runs_read on public.sd_agent_runs for select to authenticated using (
  deleted_at is null and exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));

grant select on public.sd_agent_runs to authenticated;

-- ---------- 3) service_catalog.form_fields: senarai field wajib per servis, [{key,label_en,
-- label_bm,type,required,options[]}]. Seed munasabah untuk 12 code sedia ada (disahkan live). ----------
alter table public.service_catalog add column if not exists form_fields jsonb not null default '[]'::jsonb;

update public.service_catalog set form_fields = '[
  {"key":"doc_type","label_en":"Document type","label_bm":"Jenis dokumen","type":"select","required":true,"options":["Letter","Memo","Certificate","Other"]},
  {"key":"reference_no","label_en":"Reference no. (if any)","label_bm":"No. rujukan (jika ada)","type":"text","required":false},
  {"key":"notes","label_en":"Notes","label_bm":"Catatan","type":"text","required":false}
]'::jsonb where code = 'admin_docs' and form_fields = '[]'::jsonb;

update public.service_catalog set form_fields = '[
  {"key":"letter_type","label_en":"Letter type","label_bm":"Jenis surat","type":"select","required":true,"options":["Confirmation letter","Reference letter","Notice","Official letter","Other"]},
  {"key":"recipient","label_en":"Recipient","label_bm":"Penerima","type":"text","required":true},
  {"key":"main_content","label_en":"Main content / purpose","label_bm":"Kandungan utama / tujuan","type":"text","required":true}
]'::jsonb where code = 'letters' and form_fields = '[]'::jsonb;

update public.service_catalog set form_fields = '[
  {"key":"doc_type","label_en":"Document type","label_bm":"Jenis dokumen","type":"select","required":true,"options":["Quotation","Invoice","Purchase Order","Delivery Order"]},
  {"key":"customer_name","label_en":"Customer / supplier name","label_bm":"Nama pelanggan / pembekal","type":"text","required":true},
  {"key":"period_month","label_en":"Month","label_bm":"Bulan","type":"month","required":false}
]'::jsonb where code = 'sales_docs' and form_fields = '[]'::jsonb;

update public.service_catalog set form_fields = '[
  {"key":"record_type","label_en":"Record type","label_bm":"Jenis rekod","type":"select","required":true,"options":["Sales","Purchase","Expense"]},
  {"key":"period_month","label_en":"Month","label_bm":"Bulan","type":"month","required":true}
]'::jsonb where code = 'records' and form_fields = '[]'::jsonb;

update public.service_catalog set form_fields = '[
  {"key":"period_month","label_en":"Month","label_bm":"Bulan","type":"month","required":true},
  {"key":"scope","label_en":"Scope / notes","label_bm":"Skop / catatan","type":"text","required":false}
]'::jsonb where code = 'bookkeeping' and form_fields = '[]'::jsonb;

update public.service_catalog set form_fields = '[
  {"key":"record_type","label_en":"Record type","label_bm":"Jenis rekod","type":"select","required":true,"options":["Employee record","Attendance","Leave","Claims"]},
  {"key":"staff_name","label_en":"Staff name","label_bm":"Nama staf","type":"text","required":true},
  {"key":"period_month","label_en":"Month","label_bm":"Bulan","type":"month","required":false}
]'::jsonb where code = 'hr_records' and form_fields = '[]'::jsonb;

update public.service_catalog set form_fields = '[
  {"key":"staff_name","label_en":"Staff name","label_bm":"Nama staf","type":"text","required":true},
  {"key":"period_month","label_en":"Month","label_bm":"Bulan","type":"month","required":true},
  {"key":"transaction_type","label_en":"Transaction type","label_bm":"Jenis urusan","type":"select","required":true,"options":["New payroll","Adjustment","EPF/SOCSO/EIS/PCB","Other"]}
]'::jsonb where code = 'payroll' and form_fields = '[]'::jsonb;

update public.service_catalog set form_fields = '[
  {"key":"staff_name","label_en":"Staff name","label_bm":"Nama staf","type":"text","required":true},
  {"key":"period_month","label_en":"Month","label_bm":"Bulan","type":"month","required":true}
]'::jsonb where code = 'kpi' and form_fields = '[]'::jsonb;

update public.service_catalog set form_fields = '[
  {"key":"system_module","label_en":"System module","label_bm":"Modul sistem","type":"text","required":true},
  {"key":"period","label_en":"Period / batch","label_bm":"Tempoh / kelompok","type":"text","required":false}
]'::jsonb where code = 'data_entry' and form_fields = '[]'::jsonb;

update public.service_catalog set form_fields = '[
  {"key":"process_name","label_en":"Process name","label_bm":"Nama proses","type":"text","required":true},
  {"key":"department","label_en":"Department","label_bm":"Jabatan","type":"text","required":false}
]'::jsonb where code = 'sop' and form_fields = '[]'::jsonb;

update public.service_catalog set form_fields = '[
  {"key":"report_type","label_en":"Report type","label_bm":"Jenis laporan","type":"select","required":true,"options":["Sales","HR","Accounts","Operations"]},
  {"key":"period_month","label_en":"Month","label_bm":"Bulan","type":"month","required":true}
]'::jsonb where code = 'reports' and form_fields = '[]'::jsonb;

update public.service_catalog set form_fields = '[
  {"key":"customer_name","label_en":"Customer name","label_bm":"Nama pelanggan","type":"text","required":true}
]'::jsonb where code = 'crm_digitise' and form_fields = '[]'::jsonb;

-- ---------- 4) service_requests.form_data: jawapan client untuk form_fields di atas ----------
alter table public.service_requests add column if not exists form_data jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';

-- System Development
update public.dev_roadmap_items set stage = 'completed', module = 'service_desk',
  description = 'SR Agent Backend Fasa 1 (DB): sd_agent_settings (master switch + services per tenant, platform_admin RLS), sd_agent_runs (audit log, platform_admin read, service-role write only), service_catalog.form_fields (dynamic required-field schema per servis, seeded untuk 12 code sedia ada), service_requests.form_data (jawapan client). Letterhead guna tenants.config->letterhead (merge_tenant_config RPC sedia ada, tiada schema baru). internal_note RLS exclusion disahkan sudah betul (type <> ''internal_note'' pada service_request_events_read) — tiada fix diperlukan.'
where title = 'Service Desk: SR Agent Backend (Fasa 1 — DB)';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Service Desk: SR Agent Backend (Fasa 1 — DB)',
  'SR Agent Backend Fasa 1 (DB): sd_agent_settings (master switch + services per tenant, platform_admin RLS), sd_agent_runs (audit log, platform_admin read, service-role write only), service_catalog.form_fields (dynamic required-field schema per servis, seeded untuk 12 code sedia ada), service_requests.form_data (jawapan client). Letterhead guna tenants.config->letterhead (merge_tenant_config RPC sedia ada, tiada schema baru). internal_note RLS exclusion disahkan sudah betul (type <> ''internal_note'' pada service_request_events_read) — tiada fix diperlukan.',
  'service_desk', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Service Desk: SR Agent Backend (Fasa 1 — DB)');
