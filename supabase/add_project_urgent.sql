-- ============================================
-- 業務に緊急フラグを追加
-- ============================================

-- 緊急フラグカラムを追加
ALTER TABLE projects ADD COLUMN is_urgent BOOLEAN NOT NULL DEFAULT false;

-- インデックス作成（緊急業務を高速に取得するため）
CREATE INDEX idx_projects_is_urgent ON projects(is_urgent);
