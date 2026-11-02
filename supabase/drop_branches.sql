-- 支店機能の削除
-- branches テーブル削除 + contacts.branch_id カラム削除
--
-- 実行前に:
--   1. 本番環境では必ずバックアップを取ること
--   2. 既存の branches データは完全に失われるので事前確認

-- =============================================
-- 1. contacts.branch_id カラムを削除（先に）
-- =============================================
ALTER TABLE contacts DROP COLUMN IF EXISTS branch_id;

-- =============================================
-- 2. branches テーブルを削除
-- =============================================
DROP TABLE IF EXISTS branches CASCADE;
