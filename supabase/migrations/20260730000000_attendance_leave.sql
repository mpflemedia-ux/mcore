-- ============================================================================
-- Migration: Attendance & Leave Management
-- NOTE: Supabase Edge Functions/migrations do NOT auto-deploy from GitHub —
-- run this manually in Supabase Dashboard -> SQL Editor.
-- ============================================================================

-- ---------- attendance ----------
create table attendance (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  employee_id uuid not null references employees(id),
  date date not null,
  status text not null check (status in ('present','absent','late','half_day','on_leave')),
  clock_in time,
  clock_out time,
  notes text,
  created_at timestamptz default now(),
  deleted_at timestamptz
);

create index on attendance(tenant_id, employee_id, date);

alter table attendance enable row level security;

create policy "attendance_select_own_tenant" on attendance
  for select using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));

create policy "attendance_insert_own_tenant" on attendance
  for insert with check (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));

create policy "attendance_update_own_tenant" on attendance
  for update using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()))
  with check (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));

create policy "attendance_delete_own_tenant" on attendance
  for delete using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));

-- ---------- leave_requests ----------
create table leave_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  employee_id uuid not null references employees(id),
  leave_type text not null check (leave_type in ('annual','medical','emergency','unpaid')),
  start_date date not null,
  end_date date not null,
  days_count numeric not null,
  reason text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  approved_by uuid references employees(id),
  created_at timestamptz default now(),
  deleted_at timestamptz
);

create index on leave_requests(tenant_id, employee_id, status);

alter table leave_requests enable row level security;

create policy "leave_requests_select_own_tenant" on leave_requests
  for select using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));

create policy "leave_requests_insert_own_tenant" on leave_requests
  for insert with check (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));

create policy "leave_requests_update_own_tenant" on leave_requests
  for update using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()))
  with check (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));

create policy "leave_requests_delete_own_tenant" on leave_requests
  for delete using (tenant_id = (select tenant_id from user_profiles where id = auth.uid()));
