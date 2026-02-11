-- 請求書PDFアップロード用Storageバケット

-- バケット作成
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

-- RLSポリシー
DROP POLICY IF EXISTS "Authenticated can upload invoices" ON storage.objects;
CREATE POLICY "Authenticated can upload invoices" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'invoices');

DROP POLICY IF EXISTS "Authenticated can view invoices" ON storage.objects;
CREATE POLICY "Authenticated can view invoices" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'invoices');

DROP POLICY IF EXISTS "Authenticated can update invoices" ON storage.objects;
CREATE POLICY "Authenticated can update invoices" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'invoices');

DROP POLICY IF EXISTS "Authenticated can delete invoices" ON storage.objects;
CREATE POLICY "Authenticated can delete invoices" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'invoices');
