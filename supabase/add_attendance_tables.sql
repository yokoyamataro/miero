-- ============================================
-- 勤怠・工数管理テーブル追加マイグレーション
-- ============================================

-- 1. employeesテーブルにhourly_rateカラムを追加
ALTER TABLE employees ADD COLUMN IF NOT EXISTS hourly_rate INTEGER DEFAULT 3000;

-- 2. attendance_daily (日次勤怠) テーブル作成
CREATE TYPE attendance_status AS ENUM ('Work', 'PaidLeave', 'Absence', 'HolidayWork');

CREATE TABLE IF NOT EXISTS attendance_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  break_minutes INTEGER DEFAULT 0,
  status attendance_status DEFAULT 'Work',
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, date)
);

-- 3. work_logs (工数ログ) テーブル作成
CREATE TABLE IF NOT EXISTS work_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID NOT NULL REFERENCES attendance_daily(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  minutes INTEGER NOT NULL DEFAULT 0,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. leave_balances (休暇残管理) テーブル作成
CREATE TABLE IF NOT EXISTS leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  granted_days INTEGER DEFAULT 0,
  used_days NUMERIC(4,1) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, year)
);

-- 5. インデックス作成
CREATE INDEX IF NOT EXISTS idx_attendance_daily_employee_id ON attendance_daily(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_daily_date ON attendance_daily(date);
CREATE INDEX IF NOT EXISTS idx_work_logs_attendance_id ON work_logs(attendance_id);
CREATE INDEX IF NOT EXISTS idx_work_logs_project_id ON work_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_leave_balances_employee_id ON leave_balances(employee_id);

-- 6. RLSポリシー設定
ALTER TABLE attendance_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;

-- attendance_daily RLS
CREATE POLICY "attendance_daily_select" ON attendance_daily
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "attendance_daily_insert" ON attendance_daily
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "attendance_daily_update" ON attendance_daily
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "attendance_daily_delete" ON attendance_daily
  FOR DELETE TO authenticated USING (true);

-- work_logs RLS
CREATE POLICY "work_logs_select" ON work_logs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "work_logs_insert" ON work_logs
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "work_logs_update" ON work_logs
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "work_logs_delete" ON work_logs
  FOR DELETE TO authenticated USING (true);

-- leave_balances RLS
CREATE POLICY "leave_balances_select" ON leave_balances
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "leave_balances_insert" ON leave_balances
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "leave_balances_update" ON leave_balances
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "leave_balances_delete" ON leave_balances
  FOR DELETE TO authenticated USING (true);
