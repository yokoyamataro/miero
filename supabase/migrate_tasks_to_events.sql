-- calendar_eventsのstart_date NOT NULL制約を解除
ALTER TABLE calendar_events ALTER COLUMN start_date DROP NOT NULL;

-- 並び順用のカラムを追加（日時未定のイベント用）
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

-- インデックスを追加
CREATE INDEX IF NOT EXISTS idx_calendar_events_sort_order ON calendar_events (sort_order);

-- tasksテーブルのデータをcalendar_eventsに移行する場合は以下を実行
-- （既存のtasksが少ないとのことなので、必要に応じてコメントを外して実行）
-- INSERT INTO calendar_events (
--   title,
--   description,
--   start_date,
--   start_time,
--   end_date,
--   end_time,
--   all_day,
--   project_id,
--   sort_order,
--   is_completed,
--   created_at
-- )
-- SELECT
--   title,
--   description,
--   due_date,  -- NULL許可になったのでそのまま移行
--   NULL,
--   due_date,
--   NULL,
--   true,
--   project_id,
--   sort_order,
--   is_completed,
--   created_at
-- FROM tasks;
