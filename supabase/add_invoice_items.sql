-- 請求書明細テーブルの作成と請求書テーブルへのカラム追加

-- ============================================
-- invoicesテーブルに追加カラム
-- ============================================
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS document_type VARCHAR(20) DEFAULT 'invoice',  -- invoice/estimate
ADD COLUMN IF NOT EXISTS subtotal INTEGER DEFAULT 0,                   -- 小計
ADD COLUMN IF NOT EXISTS tax_amount INTEGER DEFAULT 0,                 -- 消費税
ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(4,2) DEFAULT 0.10;           -- 税率

-- ============================================
-- invoice_items（請求書明細項目）テーブル作成
-- ============================================
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  item_template_id UUID REFERENCES invoice_item_templates(id) ON DELETE SET NULL,
  category_name VARCHAR(100),          -- カテゴリ名（スナップショット）
  name VARCHAR(255) NOT NULL,          -- 項目名
  description TEXT,                    -- 説明・備考
  unit VARCHAR(50),                    -- 単位
  quantity NUMERIC(10, 2) DEFAULT 1,   -- 数量
  unit_price INTEGER DEFAULT 0,        -- 単価
  amount INTEGER DEFAULT 0,            -- 金額（quantity × unit_price）
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);

-- ============================================
-- RLS (Row Level Security) 設定
-- ============================================
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

-- 全ユーザー読み取り可能
CREATE POLICY "invoice_items_select_policy" ON invoice_items
  FOR SELECT USING (true);

-- 認証済みユーザーのみ作成・更新・削除可能
CREATE POLICY "invoice_items_insert_policy" ON invoice_items
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "invoice_items_update_policy" ON invoice_items
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "invoice_items_delete_policy" ON invoice_items
  FOR DELETE USING (auth.role() = 'authenticated');
