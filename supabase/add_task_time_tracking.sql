-- ============================================
-- タスクに時間管理カラムを追加
-- ============================================

-- 標準時間（見積もり時間・分単位）
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER;

-- 開始時刻
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

-- 終了時刻
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 所要時間（実績・分単位）
-- 計算: completed_at - started_at を分に変換
-- または手動入力も可能
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actual_minutes INTEGER;

-- コメント: 時間の使用例
-- estimated_minutes: 60 (1時間の見積もり)
-- started_at: '2025-01-31 09:00:00+09'
-- completed_at: '2025-01-31 10:30:00+09'
-- actual_minutes: 90 (1時間30分の実績)

-- インデックス（開始・完了時刻でのフィルタリング用）
CREATE INDEX IF NOT EXISTS idx_tasks_started_at ON tasks(started_at);
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks(completed_at);
