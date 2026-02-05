-- タスクテンプレートテーブル
CREATE TABLE IF NOT EXISTS task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  estimated_minutes INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 更新日時の自動更新トリガー
CREATE OR REPLACE FUNCTION update_task_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS task_templates_updated_at ON task_templates;
CREATE TRIGGER task_templates_updated_at
  BEFORE UPDATE ON task_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_task_templates_updated_at();

-- RLSを有効化
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;

-- RLSポリシー（認証済みユーザーは全操作可能）
CREATE POLICY "Authenticated users can read task_templates"
  ON task_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert task_templates"
  ON task_templates FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update task_templates"
  ON task_templates FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete task_templates"
  ON task_templates FOR DELETE
  TO authenticated
  USING (true);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_task_templates_sort_order ON task_templates(sort_order);

-- tasksテーブルからstarted_at, completed_atカラムを削除（存在する場合）
-- 注: 本番環境では既存データのバックアップを取ってから実行してください
ALTER TABLE tasks DROP COLUMN IF EXISTS started_at;
ALTER TABLE tasks DROP COLUMN IF EXISTS completed_at;
ALTER TABLE tasks DROP COLUMN IF EXISTS parent_id;
