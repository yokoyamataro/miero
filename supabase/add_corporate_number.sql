-- ============================================
-- accounts テーブルに corporate_number カラムを追加
-- 法人番号（13桁）
-- ============================================

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS corporate_number VARCHAR(13);

-- インデックス（検索用）
CREATE INDEX IF NOT EXISTS idx_accounts_corporate_number ON accounts(corporate_number);
