-- invoice_items テーブルのRLSポリシー修正
-- 既存のポリシーをすべて削除して再作成

-- 既存ポリシーをすべて削除（様々な命名パターンに対応）
DROP POLICY IF EXISTS "invoice_items_insert_policy" ON invoice_items;
DROP POLICY IF EXISTS "invoice_items_update_policy" ON invoice_items;
DROP POLICY IF EXISTS "invoice_items_delete_policy" ON invoice_items;
DROP POLICY IF EXISTS "invoice_items_select_policy" ON invoice_items;
DROP POLICY IF EXISTS "Allow authenticated insert invoice_items" ON invoice_items;
DROP POLICY IF EXISTS "Allow authenticated update invoice_items" ON invoice_items;
DROP POLICY IF EXISTS "Allow authenticated delete invoice_items" ON invoice_items;
DROP POLICY IF EXISTS "Allow anon insert invoice_items" ON invoice_items;
DROP POLICY IF EXISTS "Allow anon update invoice_items" ON invoice_items;
DROP POLICY IF EXISTS "Allow anon delete invoice_items" ON invoice_items;

-- SELECT: 全員読み取り可能
CREATE POLICY "invoice_items_select_all" ON invoice_items
  FOR SELECT USING (true);

-- INSERT/UPDATE/DELETE: 認証済みユーザー
CREATE POLICY "invoice_items_insert_auth" ON invoice_items
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "invoice_items_update_auth" ON invoice_items
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "invoice_items_delete_auth" ON invoice_items
  FOR DELETE TO authenticated USING (true);

-- INSERT/UPDATE/DELETE: 匿名ユーザー（開発環境用）
CREATE POLICY "invoice_items_insert_anon" ON invoice_items
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "invoice_items_update_anon" ON invoice_items
  FOR UPDATE TO anon USING (true);

CREATE POLICY "invoice_items_delete_anon" ON invoice_items
  FOR DELETE TO anon USING (true);
