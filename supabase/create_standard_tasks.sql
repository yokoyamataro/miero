-- 標準業務マスター
CREATE TABLE IF NOT EXISTS standard_task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,  -- 例: "分筆登記", "敷地計測業務"
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 標準業務のTodo項目マスター
CREATE TABLE IF NOT EXISTS standard_task_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES standard_task_templates(id) ON DELETE CASCADE,
  title text NOT NULL,  -- 例: "見積", "受託", "資料調査"
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- プロジェクトに割り当てられた標準業務
CREATE TABLE IF NOT EXISTS project_standard_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES standard_task_templates(id) ON DELETE CASCADE,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, template_id)  -- 同じテンプレートは1プロジェクトに1回のみ
);

-- プロジェクトに割り当てられた標準業務の各Todo項目の進捗
CREATE TABLE IF NOT EXISTS project_standard_task_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_standard_task_id uuid NOT NULL REFERENCES project_standard_tasks(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES standard_task_items(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT '未着手' CHECK (status IN ('未着手', '進行中', '完了', '不要')),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES employees(id),
  UNIQUE(project_standard_task_id, item_id)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_standard_task_items_template_id ON standard_task_items(template_id);
CREATE INDEX IF NOT EXISTS idx_project_standard_tasks_project_id ON project_standard_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_standard_task_progress_pst_id ON project_standard_task_progress(project_standard_task_id);

-- RLS有効化
ALTER TABLE standard_task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE standard_task_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_standard_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_standard_task_progress ENABLE ROW LEVEL SECURITY;

-- RLSポリシー（全認証ユーザーに許可）
CREATE POLICY "Allow all for authenticated users" ON standard_task_templates FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON standard_task_items FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON project_standard_tasks FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON project_standard_task_progress FOR ALL USING (auth.role() = 'authenticated');

-- サンプルデータ: 分筆登記
INSERT INTO standard_task_templates (name, sort_order) VALUES ('分筆登記', 1);
INSERT INTO standard_task_items (template_id, title, sort_order)
SELECT standard_task_templates.id, items.title, items.sort_order
FROM standard_task_templates,
  (VALUES
    ('見積', 1), ('受託', 2), ('資料調査', 3), ('筆界資料調査', 4),
    ('立入通知', 5), ('調査測量', 6), ('計算整理', 7), ('境界設置', 8),
    ('立会確認', 9), ('境界標埋設', 10), ('登記申請', 11), ('成果品作成', 12), ('請求納品', 13)
  ) AS items(title, sort_order)
WHERE standard_task_templates.name = '分筆登記';

-- サンプルデータ: 敷地計測
INSERT INTO standard_task_templates (name, sort_order) VALUES ('敷地計測', 2);
INSERT INTO standard_task_items (template_id, title, sort_order)
SELECT standard_task_templates.id, items.title, items.sort_order
FROM standard_task_templates,
  (VALUES
    ('敷地調査', 1), ('図面作成', 2), ('写真提出', 3), ('請求処理', 4)
  ) AS items(title, sort_order)
WHERE standard_task_templates.name = '敷地計測';
