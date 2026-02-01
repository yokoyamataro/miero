-- ============================================
-- カレンダーイベントと業務のリンク機能追加
-- ============================================

-- calendar_events テーブルに project_id と task_id カラムを追加
ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_calendar_events_project_id ON calendar_events(project_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_task_id ON calendar_events(task_id);
