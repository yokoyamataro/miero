-- 文書テンプレート管理テーブル
CREATE TABLE IF NOT EXISTS document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS有効化
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザーは閲覧可能
CREATE POLICY "Authenticated can view templates" ON document_templates
  FOR SELECT TO authenticated USING (true);

-- 管理者は全操作可能（将来のテンプレート管理機能用）
CREATE POLICY "Admin can manage templates" ON document_templates
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE auth_id = auth.uid() AND role = 'admin'
    )
  );

-- 初期データ（サンプル）
INSERT INTO document_templates (name, file_name, description, sort_order) VALUES
  ('案内状', 'annai.docx', '顧客向け案内状テンプレート', 0)
ON CONFLICT DO NOTHING;
