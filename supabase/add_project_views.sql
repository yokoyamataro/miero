-- 業務閲覧履歴テーブル
CREATE TABLE IF NOT EXISTS project_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 同じユーザーが同じプロジェクトを複数回開いた場合は更新
  UNIQUE (project_id, employee_id)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_project_views_employee_id ON project_views(employee_id);
CREATE INDEX IF NOT EXISTS idx_project_views_viewed_at ON project_views(viewed_at DESC);

-- RLS
ALTER TABLE project_views ENABLE ROW LEVEL SECURITY;

-- 全員が読み書き可能
CREATE POLICY "project_views_all" ON project_views
  FOR ALL USING (true) WITH CHECK (true);
