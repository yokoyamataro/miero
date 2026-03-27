-- projectsテーブルにaccount_id（法人ID）カラムを追加
-- 法人顧客の場合はaccount_idのみを設定し、contact_idはnullにする
-- 個人顧客の場合はcontact_idを設定し、account_idはnullにする

ALTER TABLE projects ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES accounts(id);

-- インデックスを追加
CREATE INDEX IF NOT EXISTS idx_projects_account_id ON projects (account_id);

-- 既存データの移行：contact_idがある場合、そのcontactのaccount_idをprojectsに設定
-- UPDATE projects p
-- SET account_id = c.account_id
-- FROM contacts c
-- WHERE p.contact_id = c.id
--   AND c.account_id IS NOT NULL
--   AND p.account_id IS NULL;
