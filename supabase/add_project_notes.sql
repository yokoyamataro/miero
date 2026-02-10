-- 業務にノート（詳細情報）カラムを追加
ALTER TABLE projects ADD COLUMN IF NOT EXISTS notes TEXT;

-- コメント追加
COMMENT ON COLUMN projects.notes IS '業務のノート・詳細情報';
