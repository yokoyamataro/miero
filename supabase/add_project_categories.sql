-- 業務カテゴリにS_General, K_Association, V_Training, O_Otherを追加

ALTER TYPE project_category ADD VALUE IF NOT EXISTS 'S_General';      -- 総務
ALTER TYPE project_category ADD VALUE IF NOT EXISTS 'K_Association';  -- 会務
ALTER TYPE project_category ADD VALUE IF NOT EXISTS 'V_Training';     -- 研修
ALTER TYPE project_category ADD VALUE IF NOT EXISTS 'O_Other';        -- その他
