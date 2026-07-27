-- 本人確認シート管理
-- 実行: Supabase Dashboard > SQL Editor
--
-- フェーズ1: 事務所内で使う本人確認シート＋身分証画像管理
-- （既存の顧客テーブルとは紐付けず、シート自体を独立して管理）

-- ============================================
-- 1. identity_verifications: 本人確認シート本体
-- ============================================
CREATE TABLE IF NOT EXISTS identity_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 本人に関する事項
  postal_code TEXT,
  address TEXT,
  name TEXT NOT NULL,              -- 氏名（代表者）
  birth_date DATE,
  phone TEXT,
  workplace TEXT,                  -- 勤務先
  email TEXT,

  -- 代理人・取引担当者に関する事項
  agent_address TEXT,
  agent_name TEXT,
  agent_relationship TEXT,         -- '親族' | '社員' | '他' | null
  agent_relationship_detail TEXT,  -- 親族の続柄／他の内容
  agent_phone TEXT,

  -- 完了書類の受取方法（複数選択）
  -- 例: ['事務所来所（本人）', '事務所来所（代理人）', '郵送（本人限定郵便）', '郵送（レターパック）', '仲介業者から受取', '金融機関から受取', '建築業者から受取']
  delivery_methods TEXT[] DEFAULT '{}',

  -- お支払い方法: '現金' | '振込' | '相手方支払' | null
  payment_method TEXT,

  -- 反社会的勢力に該当しない旨のチェック
  is_not_antisocial BOOLEAN DEFAULT false,

  -- 事務所記入欄
  recorded_date DATE,              -- 記入した日
  recorder_name TEXT,              -- 記入担当者名（自由記入）

  -- 本人確認書類（複数選択）
  -- 例: ['顔写真付身分証明書', '顔写真のない身分証明書', '法人担当者（運転免許証等）']
  document_types TEXT[] DEFAULT '{}',

  -- 本人確認方法（複数選択）
  -- 例: ['面談', '代理人（後日本人と電話又は面談）', '本人限定受取郵便', '書留郵便', '面談＋電話確認']
  verification_methods TEXT[] DEFAULT '{}',

  -- トークン（フェーズ2の顧客用URLアクセスで使用予定。今は未使用）
  access_token TEXT UNIQUE,
  token_expires_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,        -- 顧客からの提出時刻

  -- メタ
  notes TEXT,
  created_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_identity_verifications_created_at
  ON identity_verifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_identity_verifications_name
  ON identity_verifications(name);
CREATE INDEX IF NOT EXISTS idx_identity_verifications_access_token
  ON identity_verifications(access_token);

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_identity_verifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_identity_verifications_updated_at ON identity_verifications;
CREATE TRIGGER trigger_update_identity_verifications_updated_at
  BEFORE UPDATE ON identity_verifications
  FOR EACH ROW
  EXECUTE FUNCTION update_identity_verifications_updated_at();


-- ============================================
-- 2. identity_verification_transactions: 受託事務（1:N）
-- ============================================
CREATE TABLE IF NOT EXISTS identity_verification_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id UUID NOT NULL
    REFERENCES identity_verifications(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  agency_name TEXT,                -- 申請先
  reception_date DATE,             -- 受付年月日
  reception_number TEXT,           -- 受付番号（第○号）
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_iv_transactions_verification_id
  ON identity_verification_transactions(verification_id);


-- ============================================
-- 3. identity_verification_documents: 身分証画像（1:N）
-- ============================================
CREATE TABLE IF NOT EXISTS identity_verification_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id UUID NOT NULL
    REFERENCES identity_verifications(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,      -- identity-documents バケット内のパス
  file_name TEXT NOT NULL,
  mime_type TEXT,
  file_size INTEGER,
  uploaded_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_iv_documents_verification_id
  ON identity_verification_documents(verification_id);


-- ============================================
-- RLS: 認証済みユーザー（事務所メンバー）は全操作可
--       フェーズ2でトークンURL経由の書込ポリシーを追加予定
-- ============================================
ALTER TABLE identity_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_verification_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_verification_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth users manage identity verifications" ON identity_verifications;
CREATE POLICY "Auth users manage identity verifications"
  ON identity_verifications FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth users manage iv transactions" ON identity_verification_transactions;
CREATE POLICY "Auth users manage iv transactions"
  ON identity_verification_transactions FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth users manage iv documents" ON identity_verification_documents;
CREATE POLICY "Auth users manage iv documents"
  ON identity_verification_documents FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);


-- ============================================
-- Supabase Storage: 身分証画像用のプライベートバケット
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('identity-documents', 'identity-documents', false)
ON CONFLICT (id) DO NOTHING;

-- 認証済みユーザーはアップロード可能
DROP POLICY IF EXISTS "Auth users upload identity documents" ON storage.objects;
CREATE POLICY "Auth users upload identity documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'identity-documents');

-- 認証済みユーザーは読取可能
DROP POLICY IF EXISTS "Auth users read identity documents" ON storage.objects;
CREATE POLICY "Auth users read identity documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'identity-documents');

-- 認証済みユーザーは削除可能
DROP POLICY IF EXISTS "Auth users delete identity documents" ON storage.objects;
CREATE POLICY "Auth users delete identity documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'identity-documents');
