-- Attendance controls (Office / Field / Outstation) — tenant scoped
-- Safe to re-run: IF NOT EXISTS / ADD COLUMN IF NOT EXISTS

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS work_mode text DEFAULT 'office';
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS is_late boolean DEFAULT false;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS office_code_entered text;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS geo_lat numeric;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS geo_lng numeric;

COMMENT ON COLUMN attendance.work_mode IS 'office | field | outstation';

CREATE TABLE IF NOT EXISTS tenant_attendance_settings (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  work_start time without time zone DEFAULT '09:00',
  work_end time without time zone DEFAULT '18:00',
  grace_minutes int DEFAULT 15,
  field_max_days_month int DEFAULT 12,
  require_field_notes boolean DEFAULT true,
  office_code_enabled boolean DEFAULT false,
  daily_code text,
  daily_code_date date,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tenant_attendance_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tas_tenant_all ON tenant_attendance_settings;
CREATE POLICY tas_tenant_all ON tenant_attendance_settings
  FOR ALL USING (
    tenant_id::text = coalesce(auth.jwt() ->> 'tenant_id', '')
    OR tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS outstation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  location text,
  purpose text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  review_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_outstation_tenant ON outstation_requests(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_outstation_emp ON outstation_requests(employee_id) WHERE deleted_at IS NULL;

ALTER TABLE outstation_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS outstation_tenant_all ON outstation_requests;
CREATE POLICY outstation_tenant_all ON outstation_requests
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
  );
