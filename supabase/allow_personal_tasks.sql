-- ============================================
-- 個人タスク対応：project_idをNULL許容に変更
-- ============================================

-- project_idのNOT NULL制約を削除
ALTER TABLE tasks ALTER COLUMN project_id DROP NOT NULL;

-- インデックスの追加（個人タスク検索用）
CREATE INDEX IF NOT EXISTS idx_tasks_personal ON tasks(assigned_to) WHERE project_id IS NULL;
