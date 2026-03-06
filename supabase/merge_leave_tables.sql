-- ============================================
-- leaves テーブルに leave_balances を統合
-- ============================================

-- 1. leave_type ENUMに無給休暇を追加（既に存在する場合はスキップ）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = '無給休暇（全日）' AND enumtypid = 'leave_type'::regtype) THEN
    ALTER TYPE leave_type ADD VALUE '無給休暇（全日）';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = '無給休暇（午前）' AND enumtypid = 'leave_type'::regtype) THEN
    ALTER TYPE leave_type ADD VALUE '無給休暇（午前）';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = '無給休暇（午後）' AND enumtypid = 'leave_type'::regtype) THEN
    ALTER TYPE leave_type ADD VALUE '無給休暇（午後）';
  END IF;
END$$;

-- 2. leaves テーブルに新しいカラムを追加
ALTER TABLE leaves ADD COLUMN IF NOT EXISTS entry_type VARCHAR(10) DEFAULT 'use' CHECK (entry_type IN ('grant', 'use'));
ALTER TABLE leaves ADD COLUMN IF NOT EXISTS leave_category VARCHAR(50);  -- '有給休暇', '冬季休暇', '無給休暇'
ALTER TABLE leaves ADD COLUMN IF NOT EXISTS days NUMERIC(5,1);           -- 付与: +, 使用: -
ALTER TABLE leaves ADD COLUMN IF NOT EXISTS expires_at DATE;             -- 有効期限（冬季休暇付与時のみ）
ALTER TABLE leaves ADD COLUMN IF NOT EXISTS granted_by UUID REFERENCES employees(id);  -- 付与者

-- 3. 既存の leaves データを更新（使用レコード）
UPDATE leaves
SET
  entry_type = 'use',
  leave_category = CASE
    WHEN leave_type::text LIKE '有給休暇%' THEN '有給休暇'
    WHEN leave_type::text LIKE '冬季休暇%' THEN '冬季休暇'
    WHEN leave_type::text LIKE '無給休暇%' THEN '無給休暇'
    ELSE 'その他'
  END,
  days = CASE
    WHEN leave_type::text LIKE '%（全日）' THEN -1
    WHEN leave_type::text LIKE '%（午前）' OR leave_type::text LIKE '%（午後）' THEN -0.5
    ELSE -1
  END
WHERE entry_type IS NULL OR entry_type = 'use';

-- 4. leave_balances のデータを leaves に移行
INSERT INTO leaves (
  employee_id,
  leave_date,
  leave_type,
  reason,
  status,
  entry_type,
  leave_category,
  days,
  expires_at,
  granted_by,
  created_at,
  updated_at
)
SELECT
  employee_id,
  granted_at,           -- 付与日を leave_date として使用
  '有給休暇（全日）',   -- ダミー（付与では使用しない）
  note,                 -- 備考を reason に
  'approved',           -- 付与は承認済み扱い
  'grant',
  leave_category,
  granted_days,         -- 付与日数（プラス）
  expires_at,
  created_by,
  created_at,
  updated_at
FROM leave_balances;

-- 5. インデックス追加
CREATE INDEX IF NOT EXISTS idx_leaves_entry_type ON leaves(entry_type);
CREATE INDEX IF NOT EXISTS idx_leaves_leave_category ON leaves(leave_category);

-- 6. leave_balances テーブルを削除
DROP TABLE IF EXISTS leave_balances CASCADE;

-- 7. 関連するトリガー関数も削除
DROP FUNCTION IF EXISTS update_leave_balances_updated_at() CASCADE;
