-- 業務マニュアル管理テーブル
CREATE TABLE IF NOT EXISTS manuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  category VARCHAR(50),
  body TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_manuals_category ON manuals(category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_manuals_is_published ON manuals(is_published) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_manuals_updated_at ON manuals(updated_at DESC) WHERE deleted_at IS NULL;

-- updated_at自動更新トリガー
CREATE OR REPLACE FUNCTION update_manuals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_manuals_updated_at ON manuals;
CREATE TRIGGER trg_manuals_updated_at
  BEFORE UPDATE ON manuals
  FOR EACH ROW
  EXECUTE FUNCTION update_manuals_updated_at();

-- RLS有効化
ALTER TABLE manuals ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザーは閲覧可能
CREATE POLICY "Authenticated can view manuals" ON manuals
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

-- 認証済みユーザーは作成可能
CREATE POLICY "Authenticated can insert manuals" ON manuals
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 認証済みユーザーは更新可能
CREATE POLICY "Authenticated can update manuals" ON manuals
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
