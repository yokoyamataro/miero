-- 文書テンプレート用Storageバケット作成
INSERT INTO storage.buckets (id, name, public)
VALUES ('document-templates', 'document-templates', false)
ON CONFLICT (id) DO NOTHING;

-- 認証済みユーザーはテンプレートをダウンロード可能
CREATE POLICY "Authenticated can download templates"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'document-templates');

-- 認証済みユーザーはテンプレートをアップロード可能
CREATE POLICY "Authenticated can upload templates"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'document-templates');

CREATE POLICY "Authenticated can update templates"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'document-templates');

CREATE POLICY "Authenticated can delete templates"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'document-templates');

-- document_templatesテーブルにstorage_pathカラムを追加
ALTER TABLE document_templates
ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- file_nameからstorage_pathへの移行コメント
-- 既存データはfile_nameにファイル名が入っているので、
-- Storageにアップロード後にstorage_pathを更新する必要があります
