-- ============================================
-- Phase 3-4 補完: 論理削除済み顧客を customers に追加移行
-- ============================================
--
-- 問題: add_customers.sql では deleted_at IS NULL 条件で移行したため、
--       論理削除済みの accounts/contacts が customers に入っていない。
--       そのため projects/invoices から customer_id を引けないケースがある。
--
-- 対応: 削除済み accounts/contacts も customers に追加移行する。
--       deleted_at も複製するので /customers 一覧には出ないが、
--       projects/invoices から履歴データとして参照可能になる。
--
-- 実行前に:
--   1. add_customers.sql と add_customer_id_columns.sql が実行済みであること
--   2. 本番環境では必ずバックアップを取ること

-- =============================================
-- 1. 削除済み accounts を customers に追加移行
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
  -- 法人の代表担当者 (削除済みも含めて検索)
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
  ORDER BY c.is_primary DESC, c.created_at ASC
  LIMIT 1
) pc ON true
WHERE a.deleted_at IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM customers WHERE legacy_account_id = a.id);

-- =============================================
-- 2. 削除済み contacts (個人顧客) を customers に追加移行
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
  AND c.deleted_at IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM customers WHERE legacy_contact_id = c.id);

-- =============================================
-- 3. projects.customer_id を再マッピング
-- =============================================

-- 3-1. account_id ベース
UPDATE projects p
SET customer_id = c.id
FROM customers c
WHERE p.account_id IS NOT NULL
  AND p.customer_id IS NULL
  AND c.legacy_account_id = p.account_id;

-- 3-2. contact_id (法人担当者経由)
UPDATE projects p
SET customer_id = c.id
FROM contacts ct
JOIN customers c ON c.legacy_account_id = ct.account_id
WHERE p.customer_id IS NULL
  AND p.contact_id = ct.id
  AND ct.account_id IS NOT NULL;

-- 3-3. contact_id (個人顧客)
UPDATE projects p
SET customer_id = c.id
FROM customers c
WHERE p.customer_id IS NULL
  AND p.contact_id IS NOT NULL
  AND c.legacy_contact_id = p.contact_id;

-- =============================================
-- 4. invoices.recipient_customer_id を再マッピング
-- =============================================

UPDATE invoices i
SET recipient_customer_id = c.id
FROM customers c
WHERE i.recipient_account_id IS NOT NULL
  AND i.recipient_customer_id IS NULL
  AND c.legacy_account_id = i.recipient_account_id;

UPDATE invoices i
SET recipient_customer_id = c.id
FROM contacts ct
JOIN customers c ON c.legacy_account_id = ct.account_id
WHERE i.recipient_customer_id IS NULL
  AND i.recipient_contact_id = ct.id
  AND ct.account_id IS NOT NULL;

UPDATE invoices i
SET recipient_customer_id = c.id
FROM customers c
WHERE i.recipient_customer_id IS NULL
  AND i.recipient_contact_id IS NOT NULL
  AND c.legacy_contact_id = i.recipient_contact_id;

-- =============================================
-- 5. project_stakeholders.customer_id を再マッピング
-- =============================================

UPDATE project_stakeholders ps
SET customer_id = c.id
FROM customers c
WHERE ps.customer_id IS NULL
  AND c.legacy_contact_id = ps.contact_id;

UPDATE project_stakeholders ps
SET customer_id = c.id
FROM contacts ct
JOIN customers c ON c.legacy_account_id = ct.account_id
WHERE ps.customer_id IS NULL
  AND ps.contact_id = ct.id
  AND ct.account_id IS NOT NULL;

-- =============================================
-- 6. 検証クエリ (手動実行用)
-- =============================================
-- 期待値: すべての missing_mapping が 0 になる
--
--   SELECT 'projects' AS tbl,
--     COUNT(*) FILTER (WHERE customer_id IS NULL
--       AND (contact_id IS NOT NULL OR account_id IS NOT NULL)) AS missing
--     FROM projects
--   UNION ALL
--   SELECT 'invoices',
--     COUNT(*) FILTER (WHERE recipient_customer_id IS NULL
--       AND (recipient_contact_id IS NOT NULL OR recipient_account_id IS NOT NULL))
--     FROM invoices
--   UNION ALL
--   SELECT 'project_stakeholders',
--     COUNT(*) FILTER (WHERE customer_id IS NULL)
--     FROM project_stakeholders;
