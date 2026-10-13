-- スキルマップ機能
-- 社員 × 工程(skill_item) のマトリックスで0-4の5段階評価を管理

-- =============================================
-- スキルカテゴリ（例: 測量、登記、行政書士）
-- =============================================
CREATE TABLE IF NOT EXISTS skill_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- スキル項目（評価対象の工程）
-- 例: カテゴリ=測量 項目=現地踏査, 杭打ち, 図面作成...
-- =============================================
CREATE TABLE IF NOT EXISTS skill_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES skill_categories(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_items_category ON skill_items(category_id, sort_order);

-- =============================================
-- 社員スキル評価（employee × skill_item マトリックス）
-- level: 0=未経験, 1=指導付きで可, 2=一人で可, 3=例外対応可, 4=指導/改善可
-- =============================================
CREATE TABLE IF NOT EXISTS employee_skills (
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  skill_item_id UUID NOT NULL REFERENCES skill_items(id) ON DELETE CASCADE,
  level SMALLINT NOT NULL DEFAULT 0 CHECK (level >= 0 AND level <= 4),
  note TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  PRIMARY KEY (employee_id, skill_item_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_skills_employee ON employee_skills(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_skills_item ON employee_skills(skill_item_id);

-- =============================================
-- updated_at 自動更新トリガー
-- =============================================
CREATE OR REPLACE FUNCTION update_skills_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_skill_categories_updated_at ON skill_categories;
CREATE TRIGGER trg_skill_categories_updated_at
  BEFORE UPDATE ON skill_categories
  FOR EACH ROW EXECUTE FUNCTION update_skills_updated_at();

DROP TRIGGER IF EXISTS trg_skill_items_updated_at ON skill_items;
CREATE TRIGGER trg_skill_items_updated_at
  BEFORE UPDATE ON skill_items
  FOR EACH ROW EXECUTE FUNCTION update_skills_updated_at();

DROP TRIGGER IF EXISTS trg_employee_skills_updated_at ON employee_skills;
CREATE TRIGGER trg_employee_skills_updated_at
  BEFORE UPDATE ON employee_skills
  FOR EACH ROW EXECUTE FUNCTION update_skills_updated_at();

-- =============================================
-- RLS: 全社員が閲覧可、管理者のみ編集可
-- =============================================
ALTER TABLE skill_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_skills ENABLE ROW LEVEL SECURITY;

-- skill_categories
CREATE POLICY "Authenticated can view skill_categories" ON skill_categories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage skill_categories" ON skill_categories
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM employees WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- skill_items
CREATE POLICY "Authenticated can view skill_items" ON skill_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage skill_items" ON skill_items
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM employees WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- employee_skills
CREATE POLICY "Authenticated can view employee_skills" ON employee_skills
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage employee_skills" ON employee_skills
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM employees WHERE auth_id = auth.uid() AND role = 'admin')
  );
