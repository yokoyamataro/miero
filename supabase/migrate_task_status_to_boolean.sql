-- ============================================
-- タスクステータスをBOOLEAN型に変更
-- status VARCHAR → is_completed BOOLEAN
-- ============================================

-- 1. 新しいカラムを追加
ALTER TABLE tasks ADD COLUMN is_completed BOOLEAN NOT NULL DEFAULT false;

-- 2. 既存データを移行（'完了' → true, それ以外 → false）
UPDATE tasks SET is_completed = (status = '完了');

-- 3. 古いカラムを削除
ALTER TABLE tasks DROP COLUMN status;

-- 4. インデックスを更新
DROP INDEX IF EXISTS idx_tasks_status;
CREATE INDEX idx_tasks_is_completed ON tasks(is_completed);
