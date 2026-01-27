-- 顧客連絡先テーブル（複数担当者対応）
CREATE TABLE customer_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  department VARCHAR(100),
  phone VARCHAR(50),
  email VARCHAR(255),
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_customer_contacts_customer_id ON customer_contacts(customer_id);

-- RLSポリシー
ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read customer_contacts"
  ON customer_contacts FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anonymous insert customer_contacts"
  ON customer_contacts FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anonymous update customer_contacts"
  ON customer_contacts FOR UPDATE TO anon USING (true);

CREATE POLICY "Allow anonymous delete customer_contacts"
  ON customer_contacts FOR DELETE TO anon USING (true);

-- 更新日時トリガー
CREATE TRIGGER update_customer_contacts_updated_at
  BEFORE UPDATE ON customer_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 既存データの移行（customers.representative があれば連絡先として登録）
INSERT INTO customer_contacts (customer_id, name, is_primary)
SELECT id, representative, true
FROM customers
WHERE representative IS NOT NULL AND representative != '';
