-- 業務ステータスのENUM型を更新
-- 既存の値: '受注', '着手', '進行中', '完了', '請求済'
-- 新しい値: '進行中', '完了', '中止'
-- 「待機」状態はis_on_holdフラグで管理

-- 1. まずデフォルト値を削除（ENUM型削除前に必要）
ALTER TABLE projects ALTER COLUMN status DROP DEFAULT;

-- 2. 既存データを一時的にテキストに変換
ALTER TABLE projects ALTER COLUMN status TYPE text;

-- 3. 既存データのマッピング
--    受注 → 進行中
--    着手 → 進行中
--    進行中 → 進行中
--    完了 → 完了
--    請求済 → 完了
UPDATE projects SET status = '進行中' WHERE status = '受注';
UPDATE projects SET status = '進行中' WHERE status = '着手';
UPDATE projects SET status = '完了' WHERE status = '請求済';

-- 4. 古いENUM型を削除
DROP TYPE IF EXISTS project_status;

-- 5. 新しいENUM型を作成
CREATE TYPE project_status AS ENUM (
  '進行中',
  '完了',
  '中止'
);

-- 6. カラムを新しいENUM型に変換
ALTER TABLE projects ALTER COLUMN status TYPE project_status USING status::project_status;

-- 7. デフォルト値を設定
ALTER TABLE projects ALTER COLUMN status SET DEFAULT '進行中';
