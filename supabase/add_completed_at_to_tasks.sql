-- tasksテーブルにcompleted_atカラムを追加
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- 既に完了しているタスクには現在時刻を設定
UPDATE tasks SET completed_at = updated_at WHERE is_completed = true AND completed_at IS NULL;
