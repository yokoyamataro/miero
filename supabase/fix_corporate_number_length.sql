-- ============================================
-- 法人番号のカラム長を12桁→13桁に変更
-- ============================================

ALTER TABLE accounts ALTER COLUMN corporate_number TYPE VARCHAR(13);
