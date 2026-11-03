-- ============================================
-- Phase 3-4: 関連テーブルに customer_id を追加しデータ移行
-- ============================================
--
-- 既存の contact_id/account_id (旧) に加え、新しい customer_id (新) を併設する。
-- 旧カラムは Phase 3-6 で削除するまで保持し、既存コードは引き続き動作可能にする。
--
-- 対象テーブル:
--   1. projects: contact_id + account_id → customer_id
--   2. invoices: recipient_contact_id + recipient_account_id → recipient_customer_id
--   3. project_stakeholders: contact_id → customer_id
--
-- 実行前に:
--   1. 本番環境では必ずバックアップを取ること
--   2. add_customers.sql が実行済みであること (customers テーブルと legacy_* カラム必須)

-- =============================================
-- 1. カラム追加
-- =============================================

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS recipient_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;

ALTER TABLE project_stakeholders
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE CASCADE;

-- =============================================
-- 2. インデックス
-- =============================================

CREATE INDEX IF NOT EXISTS idx_projects_customer_id ON projects(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_recipient_customer_id ON invoices(recipient_customer_id);
CREATE INDEX IF NOT EXISTS idx_project_stakeholders_customer_id ON project_stakeholders(customer_id);

-- =============================================
-- 3. データ移行: projects.customer_id
--    優先順位: account_id > contact_id (法人担当者経由) > contact_id (個人顧客)
-- =============================================

-- 3-1. account_id が入っている案件 → 対応する法人 customer
UPDATE projects p
SET customer_id = c.id
FROM customers c
WHERE p.account_id IS NOT NULL
  AND p.customer_id IS NULL
  AND c.legacy_account_id = p.account_id;

-- 3-2. account_id が null で contact_id のみあるケース
--     (a) contact が法人担当者 (contacts.account_id IS NOT NULL) → account の customer
UPDATE projects p
SET customer_id = c.id
FROM contacts ct
JOIN customers c ON c.legacy_account_id = ct.account_id
WHERE p.customer_id IS NULL
  AND p.contact_id = ct.id
  AND ct.account_id IS NOT NULL;

--     (b) contact が個人顧客 → contact の customer
UPDATE projects p
SET customer_id = c.id
FROM customers c
WHERE p.customer_id IS NULL
  AND p.contact_id IS NOT NULL
  AND c.legacy_contact_id = p.contact_id;

-- =============================================
-- 4. データ移行: invoices.recipient_customer_id
-- =============================================

-- 4-1. recipient_account_id が入っている請求書 → 対応する法人 customer
UPDATE invoices i
SET recipient_customer_id = c.id
FROM customers c
WHERE i.recipient_account_id IS NOT NULL
  AND i.recipient_customer_id IS NULL
  AND c.legacy_account_id = i.recipient_account_id;

-- 4-2. recipient_contact_id のみ (法人担当者経由)
UPDATE invoices i
SET recipient_customer_id = c.id
FROM contacts ct
JOIN customers c ON c.legacy_account_id = ct.account_id
WHERE i.recipient_customer_id IS NULL
  AND i.recipient_contact_id = ct.id
  AND ct.account_id IS NOT NULL;

-- 4-3. recipient_contact_id (個人顧客)
UPDATE invoices i
SET recipient_customer_id = c.id
FROM customers c
WHERE i.recipient_customer_id IS NULL
  AND i.recipient_contact_id IS NOT NULL
  AND c.legacy_contact_id = i.recipient_contact_id;

-- =============================================
-- 5. データ移行: project_stakeholders.customer_id
--    contact_id は個人顧客 or 法人担当者のどちらか
-- =============================================

-- 5-1. 個人顧客の stakeholder
UPDATE project_stakeholders ps
SET customer_id = c.id
FROM customers c
WHERE ps.customer_id IS NULL
  AND c.legacy_contact_id = ps.contact_id;

-- 5-2. 法人担当者の stakeholder → account の customer に紐づける
UPDATE project_stakeholders ps
SET customer_id = c.id
FROM contacts ct
JOIN customers c ON c.legacy_account_id = ct.account_id
WHERE ps.customer_id IS NULL
  AND ps.contact_id = ct.id
  AND ct.account_id IS NOT NULL;

-- =============================================
-- 6. 検証クエリ (手動実行用、情報表示のみ)
-- =============================================
-- 以下はコメントのまま。移行後に手動で確認してください。
--
-- projects 移行結果:
--   SELECT
--     COUNT(*) AS total,
--     COUNT(customer_id) AS has_customer_id,
--     COUNT(*) FILTER (WHERE contact_id IS NOT NULL OR account_id IS NOT NULL) AS has_legacy_id,
--     COUNT(*) FILTER (WHERE customer_id IS NULL AND (contact_id IS NOT NULL OR account_id IS NOT NULL)) AS missing_mapping
--   FROM projects;
--
-- invoices 移行結果:
--   SELECT
--     COUNT(*) AS total,
--     COUNT(recipient_customer_id) AS has_customer_id,
--     COUNT(*) FILTER (WHERE recipient_contact_id IS NOT NULL OR recipient_account_id IS NOT NULL) AS has_legacy_id,
--     COUNT(*) FILTER (WHERE recipient_customer_id IS NULL AND (recipient_contact_id IS NOT NULL OR recipient_account_id IS NOT NULL)) AS missing_mapping
--   FROM invoices;
--
-- project_stakeholders 移行結果:
--   SELECT
--     COUNT(*) AS total,
--     COUNT(customer_id) AS has_customer_id,
--     COUNT(*) FILTER (WHERE customer_id IS NULL) AS missing_mapping
--   FROM project_stakeholders;
--
-- missing_mapping が 0 になっていれば完全移行成功。
-- 0 でない場合は該当レコードを調査してください:
--   SELECT * FROM projects WHERE customer_id IS NULL AND (contact_id IS NOT NULL OR account_id IS NOT NULL);
