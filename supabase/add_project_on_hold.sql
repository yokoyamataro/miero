-- ============================================
-- 業務に待機フラグを追加
-- ============================================

-- 待機フラグカラムを追加
ALTER TABLE projects ADD COLUMN is_on_hold BOOLEAN NOT NULL DEFAULT false;

-- インデックス作成
CREATE INDEX idx_projects_is_on_hold ON projects(is_on_hold);
