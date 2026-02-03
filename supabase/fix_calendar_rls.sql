-- ============================================
-- カレンダーイベントのRLSポリシー修正
-- ============================================

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "Everyone can view calendar events" ON calendar_events;
DROP POLICY IF EXISTS "Authenticated users can create calendar events" ON calendar_events;
DROP POLICY IF EXISTS "Creator can update their events" ON calendar_events;
DROP POLICY IF EXISTS "Creator can delete their events" ON calendar_events;

DROP POLICY IF EXISTS "Everyone can view event participants" ON calendar_event_participants;
DROP POLICY IF EXISTS "Event creator can manage participants" ON calendar_event_participants;
DROP POLICY IF EXISTS "Event creator can delete participants" ON calendar_event_participants;

-- RLSを一度無効化して再有効化
ALTER TABLE calendar_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_event_participants DISABLE ROW LEVEL SECURITY;

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_event_participants ENABLE ROW LEVEL SECURITY;

-- calendar_events のRLSポリシー（緩和版）
-- SELECT: 認証ユーザーは全て閲覧可能
CREATE POLICY "calendar_events_select"
  ON calendar_events FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: 認証ユーザーは作成可能
CREATE POLICY "calendar_events_insert"
  ON calendar_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE: 認証ユーザーは更新可能（作成者チェックはアプリ側で）
CREATE POLICY "calendar_events_update"
  ON calendar_events FOR UPDATE
  TO authenticated
  USING (true);

-- DELETE: 認証ユーザーは削除可能（作成者チェックはアプリ側で）
CREATE POLICY "calendar_events_delete"
  ON calendar_events FOR DELETE
  TO authenticated
  USING (true);

-- calendar_event_participants のRLSポリシー（緩和版）
-- SELECT: 認証ユーザーは全て閲覧可能
CREATE POLICY "calendar_event_participants_select"
  ON calendar_event_participants FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: 認証ユーザーは追加可能
CREATE POLICY "calendar_event_participants_insert"
  ON calendar_event_participants FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- DELETE: 認証ユーザーは削除可能
CREATE POLICY "calendar_event_participants_delete"
  ON calendar_event_participants FOR DELETE
  TO authenticated
  USING (true);
