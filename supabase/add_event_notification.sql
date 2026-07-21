-- カレンダーイベントに通知タイミング（開始何分前に通知するか）を追加
-- 実行: Supabase Dashboard > SQL Editor
--
-- NULL = 通知しない
-- 数値 = 開始X分前に通知（0=直前）

ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS notify_minutes_before INTEGER;

COMMENT ON COLUMN calendar_events.notify_minutes_before IS
  '通知タイミング（開始何分前）。NULLで通知なし。';
