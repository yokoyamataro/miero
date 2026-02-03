-- ============================================
-- 業務の関係者（ステークホルダー）機能
-- ============================================

-- 関係者タグ マスタテーブル
CREATE TABLE IF NOT EXISTS stakeholder_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  color VARCHAR(30) NOT NULL DEFAULT 'bg-gray-500',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- デフォルトタグの登録
INSERT INTO stakeholder_tags (name, color, sort_order) VALUES
  ('売主', 'bg-red-500', 0),
  ('買主', 'bg-blue-500', 1),
  ('仲介', 'bg-green-500', 2),
  ('建築', 'bg-orange-500', 3),
  ('融資', 'bg-purple-500', 4),
  ('官公署', 'bg-teal-500', 5),
  ('代理人', 'bg-indigo-500', 6)
ON CONFLICT (name) DO NOTHING;

-- 業務の関係者 ジャンクションテーブル
CREATE TABLE IF NOT EXISTS project_stakeholders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES stakeholder_tags(id) ON DELETE RESTRICT,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 同じ業務に同じ連絡先+同じタグの重複を防ぐ
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_stakeholders_unique
  ON project_stakeholders(project_id, contact_id, tag_id);

-- 検索用インデックス
CREATE INDEX IF NOT EXISTS idx_project_stakeholders_project_id
  ON project_stakeholders(project_id);
CREATE INDEX IF NOT EXISTS idx_project_stakeholders_contact_id
  ON project_stakeholders(contact_id);
CREATE INDEX IF NOT EXISTS idx_stakeholder_tags_sort_order
  ON stakeholder_tags(sort_order);

-- RLSを有効化
ALTER TABLE stakeholder_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_stakeholders ENABLE ROW LEVEL SECURITY;

-- stakeholder_tags のRLSポリシー
CREATE POLICY "Everyone can view stakeholder tags"
  ON stakeholder_tags FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create stakeholder tags"
  ON stakeholder_tags FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update stakeholder tags"
  ON stakeholder_tags FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete stakeholder tags"
  ON stakeholder_tags FOR DELETE
  TO authenticated
  USING (true);

-- project_stakeholders のRLSポリシー
CREATE POLICY "Everyone can view project stakeholders"
  ON project_stakeholders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create project stakeholders"
  ON project_stakeholders FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update project stakeholders"
  ON project_stakeholders FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete project stakeholders"
  ON project_stakeholders FOR DELETE
  TO authenticated
  USING (true);
