-- ============================================
-- projects テーブルから monthly_allocations カラムを削除
-- ============================================

-- インデックスを先に削除
DROP INDEX IF EXISTS idx_projects_monthly_allocations;

-- カラムを削除
ALTER TABLE projects DROP COLUMN IF EXISTS monthly_allocations;
