-- ============================================
-- accounts テーブルに corporate_number カラムを追加
-- 会社法人等番号（12桁）
-- ============================================

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS corporate_number VARCHAR(12);

-- インデックス（検索用）
CREATE INDEX IF NOT EXISTS idx_accounts_corporate_number ON accounts(corporate_number);
