-- 業務カテゴリに新しい値を追加
-- S:総務, Z:その他

-- ENUMに新しい値を追加
ALTER TYPE project_category ADD VALUE IF NOT EXISTS 'S_General';
ALTER TYPE project_category ADD VALUE IF NOT EXISTS 'Z_Other';
