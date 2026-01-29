-- ============================================
-- コメント確認（既読・いいね）機能追加
-- ============================================

-- comment_acknowledgements (コメント確認) テーブル作成
CREATE TABLE IF NOT EXISTS comment_acknowledgements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(comment_id, employee_id)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_comment_acknowledgements_comment_id ON comment_acknowledgements(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_acknowledgements_employee_id ON comment_acknowledgements(employee_id);

-- RLSポリシー設定
ALTER TABLE comment_acknowledgements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comment_acknowledgements_select" ON comment_acknowledgements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "comment_acknowledgements_insert" ON comment_acknowledgements
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "comment_acknowledgements_delete" ON comment_acknowledgements
  FOR DELETE TO authenticated USING (true);
