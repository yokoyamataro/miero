-- invoice_items テーブルのRLSポリシー修正
-- 既存のポリシーを削除して再作成

-- 既存ポリシーを削除
DROP POLICY IF EXISTS "invoice_items_insert_policy" ON invoice_items;
DROP POLICY IF EXISTS "invoice_items_update_policy" ON invoice_items;
DROP POLICY IF EXISTS "invoice_items_delete_policy" ON invoice_items;

-- 新しいポリシーを作成（他のテーブルと同じ形式）
CREATE POLICY "Allow authenticated insert invoice_items" ON invoice_items
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update invoice_items" ON invoice_items
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete invoice_items" ON invoice_items
  FOR DELETE TO authenticated USING (true);

-- 匿名ユーザー用（開発環境用）
CREATE POLICY "Allow anon insert invoice_items" ON invoice_items
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon update invoice_items" ON invoice_items
  FOR UPDATE TO anon USING (true);

CREATE POLICY "Allow anon delete invoice_items" ON invoice_items
  FOR DELETE TO anon USING (true);
