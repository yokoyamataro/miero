-- ============================================
-- カレンダーイベント区分のカスタマイズ機能
-- ============================================

-- イベント区分マスタテーブル
CREATE TABLE IF NOT EXISTS event_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  color VARCHAR(20) NOT NULL DEFAULT 'bg-gray-500',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 初期データ（既存の区分を移行）
INSERT INTO event_categories (name, color, sort_order) VALUES
  ('打ち合わせ', 'bg-blue-500', 0),
  ('外出', 'bg-green-500', 1),
  ('来客', 'bg-purple-500', 2),
  ('締め切り', 'bg-red-500', 3),
  ('その他', 'bg-gray-500', 4)
ON CONFLICT (name) DO NOTHING;

-- calendar_eventsテーブルのcategoryカラムをevent_category_idに変更
-- 既存のcategoryカラムは残しつつ、新しいカラムを追加
ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS event_category_id UUID REFERENCES event_categories(id) ON DELETE SET NULL;

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_calendar_events_event_category_id ON calendar_events(event_category_id);
CREATE INDEX IF NOT EXISTS idx_event_categories_sort_order ON event_categories(sort_order);

-- 既存データの移行（categoryカラムの値からevent_category_idを設定）
UPDATE calendar_events ce
SET event_category_id = ec.id
FROM event_categories ec
WHERE ce.category::text = ec.name AND ce.event_category_id IS NULL;
