-- ============================================
-- 休暇管理テーブル
-- ============================================

-- 休暇種類
CREATE TYPE leave_type AS ENUM (
  '有給休暇（全日）',
  '有給休暇（午前）',
  '有給休暇（午後）',
  '冬季休暇（全日）',
  '冬季休暇（午前）',
  '冬季休暇（午後）',
  'その他'
);

-- 休暇ステータス
CREATE TYPE leave_status AS ENUM (
  'pending',    -- 申請中
  'approved',   -- 承認済
  'rejected'    -- 差戻し
);

-- 休暇テーブル
CREATE TABLE IF NOT EXISTS leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_date DATE NOT NULL,
  leave_type leave_type NOT NULL,
  adjustment VARCHAR(100),       -- 事前調整（調整済、調整不要など）
  reason TEXT,                   -- 理由・備考
  status leave_status NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES employees(id),  -- 承認者
  approved_at TIMESTAMP WITH TIME ZONE,        -- 承認日時
  rejection_reason TEXT,                       -- 差戻し理由
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_leaves_employee_id ON leaves(employee_id);
CREATE INDEX IF NOT EXISTS idx_leaves_leave_date ON leaves(leave_date);
CREATE INDEX IF NOT EXISTS idx_leaves_status ON leaves(status);

-- RLS
ALTER TABLE leaves ENABLE ROW LEVEL SECURITY;

-- ポリシー：認証済みユーザーは自分の休暇を閲覧可能
CREATE POLICY "Users can view own leaves" ON leaves
  FOR SELECT TO authenticated
  USING (employee_id IN (
    SELECT id FROM employees WHERE auth_id = auth.uid()
  ));

-- ポリシー：管理者/マネージャーは全ての休暇を閲覧可能
CREATE POLICY "Managers can view all leaves" ON leaves
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE auth_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- ポリシー：認証済みユーザーは休暇を申請可能
CREATE POLICY "Users can insert own leaves" ON leaves
  FOR INSERT TO authenticated
  WITH CHECK (employee_id IN (
    SELECT id FROM employees WHERE auth_id = auth.uid()
  ));

-- ポリシー：管理者/マネージャーは他人の休暇も追加可能
CREATE POLICY "Managers can insert any leaves" ON leaves
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE auth_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- ポリシー：認証済みユーザーは自分の休暇を更新可能（ステータスがpendingの場合のみ）
CREATE POLICY "Users can update own pending leaves" ON leaves
  FOR UPDATE TO authenticated
  USING (
    employee_id IN (SELECT id FROM employees WHERE auth_id = auth.uid())
    AND status = 'pending'
  )
  WITH CHECK (
    employee_id IN (SELECT id FROM employees WHERE auth_id = auth.uid())
    AND status = 'pending'
  );

-- ポリシー：管理者/マネージャーは全ての休暇を更新可能
CREATE POLICY "Managers can update all leaves" ON leaves
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE auth_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- ポリシー：管理者/マネージャーは休暇を削除可能
CREATE POLICY "Managers can delete leaves" ON leaves
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE auth_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- ポリシー：申請者本人もpending状態なら削除可能
CREATE POLICY "Users can delete own pending leaves" ON leaves
  FOR DELETE TO authenticated
  USING (
    employee_id IN (SELECT id FROM employees WHERE auth_id = auth.uid())
    AND status = 'pending'
  );

-- 更新日時自動更新トリガー
CREATE OR REPLACE FUNCTION update_leaves_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_leaves_updated_at
  BEFORE UPDATE ON leaves
  FOR EACH ROW
  EXECUTE FUNCTION update_leaves_updated_at();
