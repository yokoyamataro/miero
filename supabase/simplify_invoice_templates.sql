-- 見積請求テンプレートの簡素化
-- document_type（見積書/請求書区分）をテンプレートから削除
-- default_note（顧客向け備考）を項目から削除

-- invoice_templatesからdocument_typeカラムを削除
ALTER TABLE invoice_templates DROP COLUMN IF EXISTS document_type;

-- invoice_item_templatesからdefault_noteカラムを削除
ALTER TABLE invoice_item_templates DROP COLUMN IF EXISTS default_note;
