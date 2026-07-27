-- 本人確認シートに「署名」と「記入担当者ID」を追加
-- 実行: Supabase Dashboard > SQL Editor
--
-- 差分マイグレーション: supabase/add_identity_verification.sql の後に実行
--
-- 追加内容:
--   1. 記入担当者を社員IDで管理 (recorder_id)
--      （既存の recorder_name は互換のため残す。UI 上は使用しない）
--   2. 本人署名（画像・日時・位置情報）
--      画像は既存の identity-documents バケット内 signatures/{verification_id}.png に保存
--
-- 既存レコードが存在する可能性を考慮し NOT NULL 制約は DB レベルでは付けない
-- （アプリ側で必須バリデーション）

ALTER TABLE identity_verifications
  ADD COLUMN IF NOT EXISTS recorder_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS signature_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS signature_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signature_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS signature_longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS signature_accuracy DOUBLE PRECISION;

COMMENT ON COLUMN identity_verifications.recorder_id IS
  '記入担当者（社員ID）';
COMMENT ON COLUMN identity_verifications.signature_storage_path IS
  '本人署名画像のStorageパス（identity-documents バケット内）';
COMMENT ON COLUMN identity_verifications.signature_signed_at IS
  '本人署名を保存した日時';
COMMENT ON COLUMN identity_verifications.signature_latitude IS
  '本人署名を保存した位置（緯度）';
COMMENT ON COLUMN identity_verifications.signature_longitude IS
  '本人署名を保存した位置（経度）';
COMMENT ON COLUMN identity_verifications.signature_accuracy IS
  '位置情報の精度（メートル）';
