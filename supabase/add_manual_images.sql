-- マニュアル画像用Storageバケット作成（public）
-- マニュアル本文に埋め込む画像を保存する

INSERT INTO storage.buckets (id, name, public)
VALUES ('manual-images', 'manual-images', true)
ON CONFLICT (id) DO NOTHING;

-- 公開バケットだが、アップロード・更新・削除は認証済みユーザーのみに制限

CREATE POLICY "Authenticated can upload manual images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'manual-images');

CREATE POLICY "Authenticated can update manual images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'manual-images');

CREATE POLICY "Authenticated can delete manual images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'manual-images');

-- 閲覧は public (全員) に対して許可（public bucketなので自動的に許可されるが明示）
CREATE POLICY "Anyone can view manual images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'manual-images');
