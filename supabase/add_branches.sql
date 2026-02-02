-- ============================================
-- 支店テーブルの追加
-- ============================================

-- 支店テーブル
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  postal_code VARCHAR(8),
  prefecture VARCHAR(10),
  city VARCHAR(100),
  street VARCHAR(255),
  building VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- インデックス
CREATE INDEX idx_branches_account_id ON branches(account_id);
CREATE INDEX idx_branches_name ON branches(name);
CREATE INDEX idx_branches_deleted_at ON branches(deleted_at);

-- トリガー
CREATE TRIGGER update_branches_updated_at
  BEFORE UPDATE ON branches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLSポリシー
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read branches" ON branches FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous insert branches" ON branches FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anonymous update branches" ON branches FOR UPDATE TO anon USING (true);
CREATE POLICY "Allow anonymous delete branches" ON branches FOR DELETE TO anon USING (true);

-- ============================================
-- contacts テーブルに branch_id カラムを追加
-- ============================================
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- インデックス
CREATE INDEX IF NOT EXISTS idx_contacts_branch_id ON contacts(branch_id);
