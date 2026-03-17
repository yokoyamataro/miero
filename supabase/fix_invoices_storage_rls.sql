-- 請求書ストレージのRLSポリシー修正

-- invoicesバケットが存在しない場合は作成
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "Authenticated can upload invoices" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can view invoices" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update invoices" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete invoices" ON storage.objects;

-- invoicesバケット用のポリシーを再作成
CREATE POLICY "Invoices bucket INSERT for authenticated"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'invoices');

CREATE POLICY "Invoices bucket SELECT for authenticated"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'invoices');

CREATE POLICY "Invoices bucket UPDATE for authenticated"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'invoices');

CREATE POLICY "Invoices bucket DELETE for authenticated"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'invoices');

-- invoicesテーブルのRLSポリシーも確認・再作成
DROP POLICY IF EXISTS "Authenticated can view invoices" ON invoices;
DROP POLICY IF EXISTS "Authenticated can insert invoices" ON invoices;
DROP POLICY IF EXISTS "Authenticated can update invoices" ON invoices;
DROP POLICY IF EXISTS "Authenticated can delete invoices" ON invoices;

CREATE POLICY "Invoices SELECT for authenticated" ON invoices
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Invoices INSERT for authenticated" ON invoices
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Invoices UPDATE for authenticated" ON invoices
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Invoices DELETE for authenticated" ON invoices
  FOR DELETE TO authenticated USING (true);
