-- ============================================
-- 勤怠カレンダーセット管理テーブル
-- ============================================
--
-- 機能:
-- - 複数の勤怠カレンダーセットを作成（部署・雇用形態別など）
-- - 年度（4/1～翌3/31）ごとの休日設定
-- - 月別の出勤・退勤時刻設定
-- - 社員へのカレンダーセット割り当て

-- ============================================
-- 1. 勤怠カレンダーセット（マスタ）
-- ============================================
CREATE TABLE IF NOT EXISTS work_calendar_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,           -- セット名（例: "本社標準", "パート勤務"）
  description TEXT,                     -- 説明
  is_default BOOLEAN DEFAULT false,     -- デフォルトセット
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. 年間休日設定（年度ごと）
-- ============================================
-- 年度は fiscal_year で表現（例: 2025 = 2025年4月～2026年3月）
CREATE TABLE IF NOT EXISTS work_calendar_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_set_id UUID NOT NULL REFERENCES work_calendar_sets(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL,         -- 年度（例: 2025 = 2025/4/1～2026/3/31）
  holiday_date DATE NOT NULL,           -- 休日の日付
  holiday_name VARCHAR(100),            -- 休日名（例: "元日", "成人の日", "会社創立記念日"）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(calendar_set_id, holiday_date)
);

-- ============================================
-- 3. 月別勤務時間設定
-- ============================================
-- 月ごとに出勤時刻・退勤時刻を設定
CREATE TABLE IF NOT EXISTS work_calendar_monthly_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_set_id UUID NOT NULL REFERENCES work_calendar_sets(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL,         -- 年度
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12), -- 月（1～12）
  work_start_time TIME NOT NULL DEFAULT '09:00', -- 出勤時刻
  work_end_time TIME NOT NULL DEFAULT '18:00',   -- 退勤時刻
  break_minutes INTEGER DEFAULT 60,     -- 休憩時間（分）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(calendar_set_id, fiscal_year, month)
);

-- ============================================
-- 4. 社員とカレンダーセットの紐付け
-- ============================================
-- employeesテーブルにカレンダーセットIDを追加
ALTER TABLE employees ADD COLUMN IF NOT EXISTS work_calendar_set_id UUID REFERENCES work_calendar_sets(id) ON DELETE SET NULL;

-- ============================================
-- 5. インデックス
-- ============================================
CREATE INDEX IF NOT EXISTS idx_work_calendar_holidays_set_id ON work_calendar_holidays(calendar_set_id);
CREATE INDEX IF NOT EXISTS idx_work_calendar_holidays_fiscal_year ON work_calendar_holidays(calendar_set_id, fiscal_year);
CREATE INDEX IF NOT EXISTS idx_work_calendar_holidays_date ON work_calendar_holidays(holiday_date);
CREATE INDEX IF NOT EXISTS idx_work_calendar_monthly_hours_set_id ON work_calendar_monthly_hours(calendar_set_id);
CREATE INDEX IF NOT EXISTS idx_work_calendar_monthly_hours_fiscal_year ON work_calendar_monthly_hours(calendar_set_id, fiscal_year);
CREATE INDEX IF NOT EXISTS idx_employees_calendar_set ON employees(work_calendar_set_id);

-- ============================================
-- 6. updated_at 自動更新トリガー
-- ============================================
CREATE OR REPLACE FUNCTION update_work_calendar_sets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_work_calendar_sets_updated_at
  BEFORE UPDATE ON work_calendar_sets
  FOR EACH ROW
  EXECUTE FUNCTION update_work_calendar_sets_updated_at();

CREATE OR REPLACE FUNCTION update_work_calendar_monthly_hours_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_work_calendar_monthly_hours_updated_at
  BEFORE UPDATE ON work_calendar_monthly_hours
  FOR EACH ROW
  EXECUTE FUNCTION update_work_calendar_monthly_hours_updated_at();

-- ============================================
-- 7. RLSポリシー
-- ============================================
ALTER TABLE work_calendar_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_calendar_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_calendar_monthly_hours ENABLE ROW LEVEL SECURITY;

-- work_calendar_sets RLS
CREATE POLICY "work_calendar_sets_select" ON work_calendar_sets
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "work_calendar_sets_insert" ON work_calendar_sets
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "work_calendar_sets_update" ON work_calendar_sets
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "work_calendar_sets_delete" ON work_calendar_sets
  FOR DELETE TO authenticated USING (true);

-- 匿名ユーザー用（開発環境）
CREATE POLICY "work_calendar_sets_select_anon" ON work_calendar_sets
  FOR SELECT TO anon USING (true);
CREATE POLICY "work_calendar_sets_insert_anon" ON work_calendar_sets
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "work_calendar_sets_update_anon" ON work_calendar_sets
  FOR UPDATE TO anon USING (true);
CREATE POLICY "work_calendar_sets_delete_anon" ON work_calendar_sets
  FOR DELETE TO anon USING (true);

-- work_calendar_holidays RLS
CREATE POLICY "work_calendar_holidays_select" ON work_calendar_holidays
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "work_calendar_holidays_insert" ON work_calendar_holidays
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "work_calendar_holidays_update" ON work_calendar_holidays
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "work_calendar_holidays_delete" ON work_calendar_holidays
  FOR DELETE TO authenticated USING (true);

-- 匿名ユーザー用（開発環境）
CREATE POLICY "work_calendar_holidays_select_anon" ON work_calendar_holidays
  FOR SELECT TO anon USING (true);
CREATE POLICY "work_calendar_holidays_insert_anon" ON work_calendar_holidays
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "work_calendar_holidays_update_anon" ON work_calendar_holidays
  FOR UPDATE TO anon USING (true);
CREATE POLICY "work_calendar_holidays_delete_anon" ON work_calendar_holidays
  FOR DELETE TO anon USING (true);

-- work_calendar_monthly_hours RLS
CREATE POLICY "work_calendar_monthly_hours_select" ON work_calendar_monthly_hours
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "work_calendar_monthly_hours_insert" ON work_calendar_monthly_hours
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "work_calendar_monthly_hours_update" ON work_calendar_monthly_hours
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "work_calendar_monthly_hours_delete" ON work_calendar_monthly_hours
  FOR DELETE TO authenticated USING (true);

-- 匿名ユーザー用（開発環境）
CREATE POLICY "work_calendar_monthly_hours_select_anon" ON work_calendar_monthly_hours
  FOR SELECT TO anon USING (true);
CREATE POLICY "work_calendar_monthly_hours_insert_anon" ON work_calendar_monthly_hours
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "work_calendar_monthly_hours_update_anon" ON work_calendar_monthly_hours
  FOR UPDATE TO anon USING (true);
CREATE POLICY "work_calendar_monthly_hours_delete_anon" ON work_calendar_monthly_hours
  FOR DELETE TO anon USING (true);

-- ============================================
-- 8. デフォルトデータ（標準カレンダーセット）
-- ============================================
INSERT INTO work_calendar_sets (name, description, is_default)
VALUES ('標準勤務', '土日祝日休み、9:00-18:00勤務', true)
ON CONFLICT DO NOTHING;
