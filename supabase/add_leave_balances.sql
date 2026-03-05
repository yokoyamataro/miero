-- ============================================
-- 休暇残日数管理テーブル
-- ============================================

-- 既存のテーブルがある場合は削除（初回のみ実行）
DROP TABLE IF EXISTS leave_balances CASCADE;

-- 休暇残日数テーブル（付与・消化の履歴を管理）
-- 有給休暇: 通年で取得可能
-- 冬季休暇: 1月〜3月のみ取得可能（expires_atで管理）
CREATE TABLE leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_category VARCHAR(50) NOT NULL,  -- '有給休暇', '冬季休暇'
  granted_days NUMERIC(5,1) NOT NULL,   -- 付与日数（0.5日単位）
  fiscal_year INTEGER NOT NULL,         -- 年度（例: 2024）
  granted_at DATE NOT NULL,             -- 付与日
  valid_from DATE,                      -- 有効開始日（NULLなら付与日から）
  expires_at DATE,                      -- 有効期限（NULLなら無期限）
  note TEXT,                            -- 備考
  created_by UUID REFERENCES employees(id),  -- 付与者
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_leave_balances_employee_id ON leave_balances(employee_id);
CREATE INDEX idx_leave_balances_fiscal_year ON leave_balances(fiscal_year);
CREATE INDEX idx_leave_balances_leave_category ON leave_balances(leave_category);

-- RLS
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;

-- ポリシー：認証済みユーザーは自分の残日数を閲覧可能
CREATE POLICY "Users can view own leave_balances" ON leave_balances
  FOR SELECT TO authenticated
  USING (employee_id IN (
    SELECT id FROM employees WHERE auth_id = auth.uid()
  ));

-- ポリシー：管理者/マネージャーは全ての残日数を閲覧可能
CREATE POLICY "Managers can view all leave_balances" ON leave_balances
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE auth_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- ポリシー：管理者/マネージャーのみ休暇日数を付与可能
CREATE POLICY "Managers can insert leave_balances" ON leave_balances
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE auth_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- ポリシー：管理者/マネージャーのみ更新可能
CREATE POLICY "Managers can update leave_balances" ON leave_balances
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE auth_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- ポリシー：管理者/マネージャーのみ削除可能
CREATE POLICY "Managers can delete leave_balances" ON leave_balances
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE auth_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- 更新日時自動更新トリガー
CREATE OR REPLACE FUNCTION update_leave_balances_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_leave_balances_updated_at
  BEFORE UPDATE ON leave_balances
  FOR EACH ROW
  EXECUTE FUNCTION update_leave_balances_updated_at();
