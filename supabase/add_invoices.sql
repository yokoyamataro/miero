-- 請求管理機能用テーブル

-- ============================================
-- 1. 事業主体マスタ
-- ============================================
CREATE TABLE IF NOT EXISTS business_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  code CHAR(1) NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE business_entities IS '事業主体マスタ';
COMMENT ON COLUMN business_entities.name IS '事業主体名';
COMMENT ON COLUMN business_entities.code IS '頭文字コード (Y, T, L)';
COMMENT ON COLUMN business_entities.sort_order IS '表示順';

-- 初期データ
INSERT INTO business_entities (name, code, sort_order) VALUES
  ('有限会社横山測量設計事務所', 'Y', 0),
  ('土地家屋調査士法人LOCOS', 'T', 1),
  ('リーガルオフィスよこやま', 'L', 2)
ON CONFLICT (code) DO NOTHING;

-- RLS
ALTER TABLE business_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view business_entities" ON business_entities
  FOR SELECT TO authenticated USING (true);

-- ============================================
-- 2. 請求書テーブル
-- ============================================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(20) NOT NULL UNIQUE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  business_entity_id UUID NOT NULL REFERENCES business_entities(id),
  sequence_number INTEGER NOT NULL DEFAULT 1,
  invoice_date DATE NOT NULL,
  recipient_contact_id UUID REFERENCES contacts(id),
  person_in_charge_id UUID REFERENCES employees(id),
  fee_tax_excluded INTEGER NOT NULL DEFAULT 0,
  expenses INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL DEFAULT 0,
  pdf_path TEXT,
  notes TEXT,
  is_accounting_registered BOOLEAN DEFAULT FALSE,
  is_payment_received BOOLEAN DEFAULT FALSE,
  payment_received_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  UNIQUE(project_id, business_entity_id, sequence_number)
);

COMMENT ON TABLE invoices IS '請求書';
COMMENT ON COLUMN invoices.invoice_number IS '請求書番号 (例: Y-A260001-01)';
COMMENT ON COLUMN invoices.project_id IS '業務ID';
COMMENT ON COLUMN invoices.business_entity_id IS '事業主体ID';
COMMENT ON COLUMN invoices.sequence_number IS '同一業務・事業主体内の連番';
COMMENT ON COLUMN invoices.invoice_date IS '請求日';
COMMENT ON COLUMN invoices.recipient_contact_id IS '相手先（連絡先ID）';
COMMENT ON COLUMN invoices.person_in_charge_id IS '請求担当者（社員ID）';
COMMENT ON COLUMN invoices.fee_tax_excluded IS '税抜報酬';
COMMENT ON COLUMN invoices.expenses IS '立替金';
COMMENT ON COLUMN invoices.total_amount IS '請求金額';
COMMENT ON COLUMN invoices.pdf_path IS 'PDFファイルパス';
COMMENT ON COLUMN invoices.notes IS '備考';
COMMENT ON COLUMN invoices.is_accounting_registered IS '会計登録済み';
COMMENT ON COLUMN invoices.is_payment_received IS '入金済み';
COMMENT ON COLUMN invoices.payment_received_date IS '入金日';

-- インデックス
CREATE INDEX IF NOT EXISTS idx_invoices_project_id ON invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_business_entity_id ON invoices(business_entity_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_deleted_at ON invoices(deleted_at);

-- RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view invoices" ON invoices
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert invoices" ON invoices
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update invoices" ON invoices
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can delete invoices" ON invoices
  FOR DELETE TO authenticated USING (true);

-- ============================================
-- 3. Supabase Storage バケット（PDFアップロード用）
-- ============================================
-- Note: Storage バケットは Supabase ダッシュボードで作成するか、
-- 以下のSQLを supabase CLI で実行してください：
-- INSERT INTO storage.buckets (id, name, public) VALUES ('invoices', 'invoices', false);
