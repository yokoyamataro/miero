-- 業務カテゴリに新しい値を追加
-- S:総務, O:雑務, P:研究開発, M:マーケティング, Z:その他

-- ENUMに新しい値を追加
ALTER TYPE project_category ADD VALUE IF NOT EXISTS 'M_Marketing';
ALTER TYPE project_category ADD VALUE IF NOT EXISTS 'O_Miscellaneous';
ALTER TYPE project_category ADD VALUE IF NOT EXISTS 'P_RnD';
ALTER TYPE project_category ADD VALUE IF NOT EXISTS 'S_General';
ALTER TYPE project_category ADD VALUE IF NOT EXISTS 'Z_Other';
