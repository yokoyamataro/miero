-- カレンダーイベントに繰り返し予定機能を追加
-- 実行: Supabase Dashboard > SQL Editor

-- 繰り返しタイプのENUM型
CREATE TYPE recurrence_type AS ENUM (
  'none',      -- 繰り返しなし
  'weekly',    -- 毎週
  'monthly',   -- 毎月
  'yearly'     -- 毎年
);

-- calendar_eventsテーブルに繰り返し関連カラムを追加
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS recurrence_type recurrence_type DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS recurrence_day_of_week INTEGER,  -- 0-6 (日-土) 毎週用
  ADD COLUMN IF NOT EXISTS recurrence_day_of_month INTEGER, -- 1-31 毎月用
  ADD COLUMN IF NOT EXISTS recurrence_month INTEGER,        -- 1-12 毎年用
  ADD COLUMN IF NOT EXISTS recurrence_group_id UUID,        -- 繰り返しグループID（同じ繰り返しのイベントをグループ化）
  ADD COLUMN IF NOT EXISTS recurrence_end_date DATE;        -- 繰り返し終了日（NULL=無期限）

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_calendar_events_recurrence_group_id
  ON calendar_events(recurrence_group_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_recurrence_type
  ON calendar_events(recurrence_type);

-- コメント追加
COMMENT ON COLUMN calendar_events.recurrence_type IS '繰り返しタイプ: none=なし, weekly=毎週, monthly=毎月, yearly=毎年';
COMMENT ON COLUMN calendar_events.recurrence_day_of_week IS '毎週の場合の曜日 (0=日曜, 1=月曜, ..., 6=土曜)';
COMMENT ON COLUMN calendar_events.recurrence_day_of_month IS '毎月/毎年の場合の日 (1-31)';
COMMENT ON COLUMN calendar_events.recurrence_month IS '毎年の場合の月 (1-12)';
COMMENT ON COLUMN calendar_events.recurrence_group_id IS '繰り返しイベントのグループID（同じUUIDを持つイベントは同じ繰り返しシリーズ）';
COMMENT ON COLUMN calendar_events.recurrence_end_date IS '繰り返し終了日（NULLの場合は無期限）';
