-- カレンダーイベント用テーブル更新
-- 既存のevent_category型がある場合に実行

-- 注意: 既存のデータがある場合は、まずデータをバックアップしてください

-- 方法1: テーブルが空の場合（推奨）
-- テーブルと型を削除して再作成

-- 既存のテーブルを削除（カスケード）
DROP TABLE IF EXISTS calendar_event_participants CASCADE;
DROP TABLE IF EXISTS calendar_events CASCADE;

-- 既存の型を削除
DROP TYPE IF EXISTS event_category CASCADE;

-- イベント区分のENUM型を作成
CREATE TYPE event_category AS ENUM (
  '内業',
  '来客',
  '外出',
  '現場',
  '出張',
  '勉強',
  '登記',
  '整備',
  '休み',
  'その他'
);

-- カレンダーイベントテーブル
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category event_category DEFAULT 'その他',
  start_date DATE NOT NULL,
  start_time TIME,
  end_date DATE,
  end_time TIME,
  all_day BOOLEAN DEFAULT false,
  location TEXT,
  map_url TEXT,
  created_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- イベント参加者テーブル（多対多）
CREATE TABLE IF NOT EXISTS calendar_event_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, employee_id)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_date ON calendar_events(start_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_end_date ON calendar_events(end_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_created_by ON calendar_events(created_by);
CREATE INDEX IF NOT EXISTS idx_calendar_event_participants_event_id ON calendar_event_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_calendar_event_participants_employee_id ON calendar_event_participants(employee_id);

-- updated_at自動更新トリガー
CREATE OR REPLACE FUNCTION update_calendar_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_calendar_events_updated_at ON calendar_events;
CREATE TRIGGER trigger_update_calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION update_calendar_events_updated_at();

-- RLSを有効化
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_event_participants ENABLE ROW LEVEL SECURITY;

-- calendar_events のRLSポリシー
CREATE POLICY "Everyone can view calendar events"
  ON calendar_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create calendar events"
  ON calendar_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Creator can update their events"
  ON calendar_events FOR UPDATE
  TO authenticated
  USING (
    created_by IN (
      SELECT id FROM employees WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Creator can delete their events"
  ON calendar_events FOR DELETE
  TO authenticated
  USING (
    created_by IN (
      SELECT id FROM employees WHERE auth_id = auth.uid()
    )
  );

-- calendar_event_participants のRLSポリシー
CREATE POLICY "Everyone can view event participants"
  ON calendar_event_participants FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Event creator can manage participants"
  ON calendar_event_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    event_id IN (
      SELECT id FROM calendar_events
      WHERE created_by IN (
        SELECT id FROM employees WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "Event creator can delete participants"
  ON calendar_event_participants FOR DELETE
  TO authenticated
  USING (
    event_id IN (
      SELECT id FROM calendar_events
      WHERE created_by IN (
        SELECT id FROM employees WHERE auth_id = auth.uid()
      )
    )
  );
