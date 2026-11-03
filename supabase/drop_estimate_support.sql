-- ============================================
-- 見積書機能の削除
-- ============================================
--
-- invoices テーブルから document_type カラムを削除し、
-- 見積書 (estimate) レコードを物理削除する。
--
-- 実行前に:
--   1. 本番環境では必ずバックアップを取ること
--   2. 見積書レコードが本当に不要か確認すること (物理削除で元に戻せない)

-- =============================================
-- 1. 見積書レコードを物理削除
-- =============================================

-- 見積書に紐付く invoice_items も先に削除 (ON DELETE CASCADE が無い場合用)
DELETE FROM invoice_items
WHERE invoice_id IN (
  SELECT id FROM invoices WHERE document_type = 'estimate'
);

-- 見積書本体を削除
DELETE FROM invoices WHERE document_type = 'estimate';

-- =============================================
-- 2. document_type カラムを削除
-- =============================================

ALTER TABLE invoices DROP COLUMN IF EXISTS document_type;

-- =============================================
-- 3. 検証クエリ (手動実行用)
-- =============================================
-- SELECT COUNT(*) FROM invoices;
--
-- カラムが削除されたか:
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='invoices' AND column_name='document_type';
-- (結果が 0 行なら削除成功)
