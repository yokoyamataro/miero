-- ============================================
-- Phase 3-1: customers 統合テーブル作成 + データ移行
-- ============================================
--
-- 既存の accounts (法人) と contacts (個人顧客) を 1つの customers テーブルに統合する。
-- 法人の担当者情報は is_primary=true の1名だけを customers レコードの contact_* カラムに
-- マージする。他の担当者は破棄される。
--
-- 実行前に:
--   1. 本番環境では必ずバックアップを取ること
--   2. drop_identity_verifications.sql, drop_branches.sql を事前に実行すること
--   3. このSQLは「新テーブル作成 + データ移行」のみ。既存の accounts/contacts テーブルは
--      まだ残る。関連テーブル(projects, invoices, project_stakeholders)の外部キー書き換えは
--      別SQLで段階的に実施する。

-- =============================================
-- 1. customers テーブル作成
-- =============================================

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- タイプ
  type VARCHAR(10) NOT NULL CHECK (type IN ('corporate', 'individual')),

  -- 共通属性（検索・一覧表示用）
  display_name       VARCHAR(200) NOT NULL,
  display_name_kana  VARCHAR(200),
  phone              VARCHAR(50),
  email              VARCHAR(255),
  postal_code        VARCHAR(10),
  prefecture         VARCHAR(20),
  city               VARCHAR(100),
  street             VARCHAR(200),
  building           VARCHAR(200),
  notes              TEXT,

  -- 法人固有 (type='corporate' のみ使用、個人の場合はNULL)
  corporate_number   VARCHAR(20),
  industry           VARCHAR(50),
  fax                VARCHAR(50),
  contact_last_name       VARCHAR(50),
  contact_first_name      VARCHAR(50),
  contact_last_name_kana  VARCHAR(50),
  contact_first_name_kana VARCHAR(50),
  contact_department      VARCHAR(100),
  contact_position        VARCHAR(100),
  contact_phone           VARCHAR(50),
  contact_email           VARCHAR(255),

  -- 個人固有 (type='individual' のみ使用、法人の場合はNULL)
  last_name       VARCHAR(50),
  first_name      VARCHAR(50),
  last_name_kana  VARCHAR(50),
  first_name_kana VARCHAR(50),
  birth_date      DATE,

  -- 移行用: 元テーブルのIDを保持（Phase 3-5 で外部キー書き換え時に使う）
  legacy_account_id UUID,
  legacy_contact_id UUID,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- =============================================
-- 2. インデックス
-- =============================================
CREATE INDEX IF NOT EXISTS idx_customers_type ON customers(type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_display_name ON customers(display_name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_display_name_kana ON customers(display_name_kana) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_legacy_account_id ON customers(legacy_account_id);
CREATE INDEX IF NOT EXISTS idx_customers_legacy_contact_id ON customers(legacy_contact_id);

-- =============================================
-- 3. updated_at 自動更新トリガー
-- =============================================
CREATE OR REPLACE FUNCTION update_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_customers_updated_at ON customers;
CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_customers_updated_at();

-- =============================================
-- 4. RLS: 認証済みユーザーは全操作可能
-- =============================================
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view customers" ON customers
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "Authenticated can insert customers" ON customers
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update customers" ON customers
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated can delete customers" ON customers
  FOR DELETE TO authenticated
  USING (true);

-- =============================================
-- 5. データ移行: 法人 (accounts) → customers (type='corporate')
--    法人の is_primary=true の担当者情報を contact_* カラムにマージ
-- =============================================

INSERT INTO customers (
  type,
  display_name, display_name_kana,
  phone, postal_code, prefecture, city, street, building, notes,
  corporate_number, industry, fax,
  contact_last_name, contact_first_name,
  contact_last_name_kana, contact_first_name_kana,
  contact_department, contact_position,
  contact_phone, contact_email,
  legacy_account_id,
  created_at, updated_at, deleted_at
)
SELECT
  'corporate',
  a.company_name,
  a.company_name_kana,
  a.main_phone,
  a.postal_code, a.prefecture, a.city, a.street, a.building, a.notes,
  a.corporate_number, a.industry, a.fax,
  -- 法人の代表担当者 (is_primary=true 優先、なければ最初のcontact)
  pc.last_name, pc.first_name,
  pc.last_name_kana, pc.first_name_kana,
  pc.department, pc.position,
  pc.phone, pc.email,
  a.id,
  a.created_at, a.updated_at, a.deleted_at
FROM accounts a
LEFT JOIN LATERAL (
  SELECT c.*
  FROM contacts c
  WHERE c.account_id = a.id
    AND c.deleted_at IS NULL
  ORDER BY c.is_primary DESC, c.created_at ASC
  LIMIT 1
) pc ON true
WHERE a.deleted_at IS NULL;

-- =============================================
-- 6. データ移行: 個人顧客 (contacts WHERE account_id IS NULL) → customers (type='individual')
-- =============================================

INSERT INTO customers (
  type,
  display_name, display_name_kana,
  phone, email,
  postal_code, prefecture, city, street, building, notes,
  last_name, first_name, last_name_kana, first_name_kana,
  birth_date,
  legacy_contact_id,
  created_at, updated_at, deleted_at
)
SELECT
  'individual',
  TRIM(COALESCE(c.last_name, '') || ' ' || COALESCE(c.first_name, '')),
  CASE
    WHEN c.last_name_kana IS NOT NULL OR c.first_name_kana IS NOT NULL
      THEN TRIM(COALESCE(c.last_name_kana, '') || ' ' || COALESCE(c.first_name_kana, ''))
    ELSE NULL
  END,
  c.phone, c.email,
  c.postal_code, c.prefecture, c.city, c.street, c.building, c.notes,
  c.last_name, c.first_name, c.last_name_kana, c.first_name_kana,
  c.birth_date,
  c.id,
  c.created_at, c.updated_at, c.deleted_at
FROM contacts c
WHERE c.account_id IS NULL
  AND c.deleted_at IS NULL;

-- =============================================
-- 7. 移行結果確認クエリ（手動実行用、情報表示のみ）
-- =============================================
-- 以下はコメントのまま。移行後に手動で確認してください。
--
-- 件数確認:
--   SELECT type, COUNT(*) FROM customers GROUP BY type;
--   SELECT 'accounts' as src, COUNT(*) FROM accounts WHERE deleted_at IS NULL
--     UNION ALL
--     SELECT 'contacts(individual)', COUNT(*) FROM contacts WHERE account_id IS NULL AND deleted_at IS NULL;
--
-- 法人の担当者情報が消えた件数:
--   SELECT COUNT(*) FROM contacts
--   WHERE account_id IS NOT NULL
--     AND is_primary = false
--     AND deleted_at IS NULL;
