-- ============================================
-- 法人・支店テーブルにFAX番号を追加
-- ============================================

-- 法人にFAX番号カラムを追加
ALTER TABLE accounts ADD COLUMN fax VARCHAR(20);

-- 支店にFAX番号カラムを追加
ALTER TABLE branches ADD COLUMN fax VARCHAR(20);
