-- 関連業務テーブル（双方向リンク）
CREATE TABLE IF NOT EXISTS related_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  related_project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 同じ組み合わせの重複を防ぐ（順序を正規化してユニーク制約）
  CONSTRAINT unique_related_projects UNIQUE (project_id, related_project_id),
  -- 自己参照を防ぐ
  CONSTRAINT no_self_reference CHECK (project_id != related_project_id)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_related_projects_project_id ON related_projects(project_id);
CREATE INDEX IF NOT EXISTS idx_related_projects_related_project_id ON related_projects(related_project_id);

-- RLS
ALTER TABLE related_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view related_projects"
  ON related_projects FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert related_projects"
  ON related_projects FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete related_projects"
  ON related_projects FOR DELETE TO authenticated USING (true);
