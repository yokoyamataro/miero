-- ============================================
-- タスク・コメント機能の追加
-- ============================================

-- ============================================
-- タスクテーブル（親タスク・サブタスク両対応）
-- ============================================
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES tasks(id) ON DELETE CASCADE,  -- サブタスクの場合は親タスクID
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT '未着手',  -- 未着手, 進行中, 完了
  due_date DATE,
  assigned_to UUID REFERENCES employees(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- コメントテーブル
-- ============================================
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  author_name VARCHAR(100),  -- 作成者名（ログイン機能がない場合の代替）
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- インデックス
-- ============================================
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_parent_id ON tasks(parent_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_comments_project_id ON comments(project_id);
CREATE INDEX idx_comments_created_at ON comments(created_at);

-- ============================================
-- トリガー
-- ============================================
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLSポリシー
-- ============================================
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read tasks" ON tasks FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous insert tasks" ON tasks FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anonymous update tasks" ON tasks FOR UPDATE TO anon USING (true);
CREATE POLICY "Allow anonymous delete tasks" ON tasks FOR DELETE TO anon USING (true);

CREATE POLICY "Allow anonymous read comments" ON comments FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous insert comments" ON comments FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anonymous update comments" ON comments FOR UPDATE TO anon USING (true);
CREATE POLICY "Allow anonymous delete comments" ON comments FOR DELETE TO anon USING (true);
