-- ============================================
-- 業務に緊急・待機フラグを追加
-- ============================================

-- 緊急フラグカラムを追加
ALTER TABLE projects ADD COLUMN is_urgent BOOLEAN NOT NULL DEFAULT false;

-- 待機フラグカラムを追加
ALTER TABLE projects ADD COLUMN is_on_hold BOOLEAN NOT NULL DEFAULT false;

-- インデックス作成
CREATE INDEX idx_projects_is_urgent ON projects(is_urgent);
CREATE INDEX idx_projects_is_on_hold ON projects(is_on_hold);
