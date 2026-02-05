-- タスクテンプレートセットテーブル（テンプレートのグループ）
CREATE TABLE IF NOT EXISTS task_template_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- タスクテンプレートアイテムテーブル（セット内の個別タスク）
CREATE TABLE IF NOT EXISTS task_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id UUID NOT NULL REFERENCES task_template_sets(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  estimated_minutes INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 更新日時の自動更新トリガー
CREATE OR REPLACE FUNCTION update_task_template_sets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS task_template_sets_updated_at ON task_template_sets;
CREATE TRIGGER task_template_sets_updated_at
  BEFORE UPDATE ON task_template_sets
  FOR EACH ROW
  EXECUTE FUNCTION update_task_template_sets_updated_at();

-- RLSを有効化
ALTER TABLE task_template_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_template_items ENABLE ROW LEVEL SECURITY;

-- RLSポリシー（task_template_sets）
CREATE POLICY "Authenticated users can read task_template_sets"
  ON task_template_sets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert task_template_sets"
  ON task_template_sets FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update task_template_sets"
  ON task_template_sets FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete task_template_sets"
  ON task_template_sets FOR DELETE
  TO authenticated
  USING (true);

-- RLSポリシー（task_template_items）
CREATE POLICY "Authenticated users can read task_template_items"
  ON task_template_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert task_template_items"
  ON task_template_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update task_template_items"
  ON task_template_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete task_template_items"
  ON task_template_items FOR DELETE
  TO authenticated
  USING (true);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_task_template_items_set_id ON task_template_items(set_id);
CREATE INDEX IF NOT EXISTS idx_task_template_items_sort_order ON task_template_items(sort_order);

-- 旧テーブルが存在する場合は削除（新規作成の場合は不要）
DROP TABLE IF EXISTS task_templates;

-- tasksテーブルからstarted_at, completed_atカラムを削除（存在する場合）
-- 注: 本番環境では既存データのバックアップを取ってから実行してください
ALTER TABLE tasks DROP COLUMN IF EXISTS started_at;
ALTER TABLE tasks DROP COLUMN IF EXISTS completed_at;
ALTER TABLE tasks DROP COLUMN IF EXISTS parent_id;
