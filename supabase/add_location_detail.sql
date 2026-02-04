-- projects テーブルに location_detail（字・町名以下）カラムを追加
ALTER TABLE projects ADD COLUMN IF NOT EXISTS location_detail TEXT;
