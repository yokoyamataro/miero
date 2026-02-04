-- ============================================
-- 業務管理システム データベーススキーマ
-- Supabase (PostgreSQL) 用
-- ============================================

-- UUID拡張を有効化
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUM型の定義
-- ============================================

-- 業務カテゴリ
CREATE TYPE project_category AS ENUM (
  'A_Survey',      -- 一般測量
  'B_Boundary',    -- 境界測量
  'C_Registration',-- 不動産登記
  'D_Inheritance', -- 遺言・相続
  'E_Corporate',   -- 法人関係
  'F_Drone',       -- ドローン
  'N_Farmland'     -- 農地関係
);

-- 業務ステータス
CREATE TYPE project_status AS ENUM (
  '受注',
  '着手',
  '進行中',
  '完了',
  '請求済'
);

-- 社員権限
CREATE TYPE employee_role AS ENUM (
  'admin',
  'manager',
  'staff'
);

-- ============================================
-- テーブル定義
-- ============================================

-- 社員マスタ
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  role employee_role NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 顧客マスタ
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  representative VARCHAR(100),
  phone VARCHAR(50),
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 業務メインテーブル
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(20) NOT NULL UNIQUE,
  category project_category NOT NULL,
  name VARCHAR(255) NOT NULL,
  status project_status NOT NULL DEFAULT '受注',
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  start_date DATE,
  end_date DATE,
  fee_tax_excluded INTEGER DEFAULT 0,
  location TEXT,
  location_detail TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- インデックス
-- ============================================

-- 業務テーブルのインデックス
CREATE INDEX idx_projects_category ON projects(category);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_customer_id ON projects(customer_id);
CREATE INDEX idx_projects_manager_id ON projects(manager_id);
CREATE INDEX idx_projects_start_date ON projects(start_date);
CREATE INDEX idx_projects_end_date ON projects(end_date);
CREATE INDEX idx_projects_code ON projects(code);

-- JSONB検索用インデックス
CREATE INDEX idx_projects_details ON projects USING GIN (details);

-- 顧客テーブルのインデックス
CREATE INDEX idx_customers_name ON customers(name);

-- 社員テーブルのインデックス
CREATE INDEX idx_employees_email ON employees(email);

-- ============================================
-- 更新日時自動更新トリガー
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Row Level Security (RLS) ポリシー
-- ============================================

-- RLSを有効化
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザーに対する基本ポリシー
-- employees テーブル
CREATE POLICY "Authenticated users can view employees"
  ON employees FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage employees"
  ON employees FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.email = auth.jwt() ->> 'email'
      AND e.role = 'admin'
    )
  );

-- customers テーブル
CREATE POLICY "Authenticated users can view customers"
  ON customers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage customers"
  ON customers FOR ALL
  TO authenticated
  USING (true);

-- projects テーブル
CREATE POLICY "Authenticated users can view projects"
  ON projects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage projects"
  ON projects FOR ALL
  TO authenticated
  USING (true);

-- ============================================
-- サンプルデータ（開発用）
-- ============================================

-- サンプル社員
INSERT INTO employees (name, email, role) VALUES
  ('山田 太郎', 'yamada@example.com', 'admin'),
  ('佐藤 花子', 'sato@example.com', 'manager'),
  ('鈴木 一郎', 'suzuki@example.com', 'staff');

-- サンプル顧客
INSERT INTO customers (name, representative, phone, address, notes) VALUES
  ('株式会社ABC建設', '田中 次郎', '01onal-1234-5678', '北海道札幌市中央区大通1-1', '主要取引先'),
  ('一条工務店', '高橋 三郎', '0120-xxx-xxx', '東京都江東区', '住宅メーカー'),
  ('個人 - 山本様', '山本 四郎', '090-xxxx-xxxx', '北海道網走市xxx', NULL);

-- サンプル業務
INSERT INTO projects (code, category, name, status, customer_id, manager_id, start_date, end_date, fee_tax_excluded, location, details)
SELECT
  'A240001',
  'A_Survey',
  '○○地区 工事測量',
  '進行中',
  c.id,
  e.id,
  '2024-04-01',
  '2024-06-30',
  500000,
  '北海道網走郡美幌町',
  '{"survey_type": "工事測量", "jv_name": null}'::jsonb
FROM customers c, employees e
WHERE c.name = '株式会社ABC建設' AND e.email = 'yamada@example.com';

INSERT INTO projects (code, category, name, status, customer_id, manager_id, start_date, end_date, fee_tax_excluded, location, details)
SELECT
  'B250001',
  'B_Boundary',
  '△△様邸 境界確定測量',
  '受注',
  c.id,
  e.id,
  '2025-01-15',
  NULL,
  350000,
  '北海道網走市xxx',
  '{
    "purpose": "分筆",
    "referrer": "一条工務店",
    "coordinates": {"lat": 43.457, "lng": 144.715},
    "workflow": {
      "estimate": true,
      "accepted": true,
      "survey": false,
      "staking": false,
      "registration": false,
      "billing": false
    }
  }'::jsonb
FROM customers c, employees e
WHERE c.name = '個人 - 山本様' AND e.email = 'sato@example.com';
