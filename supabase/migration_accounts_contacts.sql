-- ============================================
-- Account/Contact 構造への移行
-- ============================================

-- 1. まず projects テーブルの外部キー制約とカラムを削除
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_customer_id_fkey;
ALTER TABLE projects DROP COLUMN IF EXISTS customer_id;
DROP INDEX IF EXISTS idx_projects_customer_id;

-- 2. 既存テーブルを削除（開発環境のみ）
DROP TABLE IF EXISTS customer_contacts;
DROP TABLE IF EXISTS customers;

-- ============================================
-- 法人・組織テーブル
-- ============================================
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name VARCHAR(255) NOT NULL,
  company_name_kana VARCHAR(255),
  main_phone VARCHAR(20),
  postal_code VARCHAR(8),
  prefecture VARCHAR(10),
  city VARCHAR(100),
  street VARCHAR(255),
  building VARCHAR(255),
  industry VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- ============================================
-- 顧客・担当者テーブル
-- ============================================
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  last_name VARCHAR(50) NOT NULL,
  first_name VARCHAR(50) NOT NULL,
  last_name_kana VARCHAR(50),
  first_name_kana VARCHAR(50),
  birth_date DATE,
  email VARCHAR(255),
  phone VARCHAR(20),
  postal_code VARCHAR(8),
  prefecture VARCHAR(10),
  city VARCHAR(100),
  street VARCHAR(255),
  building VARCHAR(255),
  department VARCHAR(100),
  position VARCHAR(100),
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- ============================================
-- インデックス
-- ============================================
CREATE INDEX idx_accounts_company_name ON accounts(company_name);
CREATE INDEX idx_accounts_deleted_at ON accounts(deleted_at);
CREATE INDEX idx_contacts_account_id ON contacts(account_id);
CREATE INDEX idx_contacts_name ON contacts(last_name, first_name);
CREATE INDEX idx_contacts_deleted_at ON contacts(deleted_at);

-- ============================================
-- トリガー
-- ============================================
CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLSポリシー
-- ============================================
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read accounts" ON accounts FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous insert accounts" ON accounts FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anonymous update accounts" ON accounts FOR UPDATE TO anon USING (true);
CREATE POLICY "Allow anonymous delete accounts" ON accounts FOR DELETE TO anon USING (true);

CREATE POLICY "Allow anonymous read contacts" ON contacts FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous insert contacts" ON contacts FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anonymous update contacts" ON contacts FOR UPDATE TO anon USING (true);
CREATE POLICY "Allow anonymous delete contacts" ON contacts FOR DELETE TO anon USING (true);

-- ============================================
-- projects テーブルの変更
-- ============================================

-- 新しいカラムを追加（customer_id は冒頭で削除済み）
ALTER TABLE projects ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;

-- インデックスを作成
CREATE INDEX IF NOT EXISTS idx_projects_contact_id ON projects(contact_id);

-- ============================================
-- サンプルデータ
-- ============================================

-- サンプル法人
INSERT INTO accounts (company_name, company_name_kana, main_phone, postal_code, prefecture, city, street, industry, notes) VALUES
  ('株式会社ABC建設', 'カブシキガイシャエービーシーケンセツ', '011-1234-5678', '060-0001', '北海道', '札幌市中央区', '大通1-1', '建設業', '主要取引先'),
  ('一条工務店', 'イチジョウコウムテン', '0120-xxx-xxx', '135-0016', '東京都', '江東区', '東陽1-1-1', '住宅建設', '住宅メーカー');

-- サンプル法人担当者
INSERT INTO contacts (account_id, last_name, first_name, last_name_kana, first_name_kana, phone, email, department, position, is_primary)
SELECT
  a.id, '田中', '次郎', 'タナカ', 'ジロウ', '090-1111-2222', 'tanaka@abc-kensetsu.co.jp', '営業部', '部長', true
FROM accounts a WHERE a.company_name = '株式会社ABC建設';

INSERT INTO contacts (account_id, last_name, first_name, last_name_kana, first_name_kana, phone, email, department, position, is_primary)
SELECT
  a.id, '高橋', '三郎', 'タカハシ', 'サブロウ', '080-3333-4444', 'takahashi@ichijo.co.jp', '営業課', '課長', true
FROM accounts a WHERE a.company_name = '一条工務店';

-- サンプル個人顧客（account_id = NULL）
INSERT INTO contacts (last_name, first_name, last_name_kana, first_name_kana, phone, postal_code, prefecture, city, street)
VALUES ('山本', '四郎', 'ヤマモト', 'シロウ', '090-xxxx-xxxx', '093-0000', '北海道', '網走市', 'xxx町1-2-3');
