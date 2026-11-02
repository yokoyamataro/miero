-- 本人確認機能の削除
-- 関連テーブル3つを削除する
--
-- 実行前に:
--   1. 本番環境では必ずバックアップを取ること
--   2. Storage の identity-documents バケットは別途 Supabase Dashboard から手動削除
--      (Storage > identity-documents > Delete bucket)
--      ※ SQL からの直接削除は Supabase によって保護されているため

-- =============================================
-- テーブル削除（依存順）
-- =============================================

-- 子テーブルから先に削除（外部キー制約のため）
DROP TABLE IF EXISTS identity_verification_documents CASCADE;
DROP TABLE IF EXISTS identity_verification_transactions CASCADE;

-- 親テーブル
DROP TABLE IF EXISTS identity_verifications CASCADE;
