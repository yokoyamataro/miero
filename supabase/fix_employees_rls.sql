-- ============================================
-- employeesテーブルのRLSポリシー修正
-- 無限再帰エラーを解消
-- ============================================

-- 既存の全ポリシーを削除
DROP POLICY IF EXISTS "Allow anonymous read employees" ON employees;
DROP POLICY IF EXISTS "Allow anonymous insert employees" ON employees;
DROP POLICY IF EXISTS "Allow anonymous update employees" ON employees;
DROP POLICY IF EXISTS "Allow anonymous delete employees" ON employees;
DROP POLICY IF EXISTS "Allow authenticated read employees" ON employees;
DROP POLICY IF EXISTS "Allow authenticated insert employees" ON employees;
DROP POLICY IF EXISTS "Allow authenticated update employees" ON employees;
DROP POLICY IF EXISTS "Allow authenticated delete employees" ON employees;
DROP POLICY IF EXISTS "Allow anon read employees" ON employees;
DROP POLICY IF EXISTS "employees_select_policy" ON employees;
DROP POLICY IF EXISTS "employees_insert_policy" ON employees;
DROP POLICY IF EXISTS "employees_update_policy" ON employees;
DROP POLICY IF EXISTS "employees_delete_policy" ON employees;

-- RLSを一度無効化して再有効化
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- シンプルなポリシーを再作成（自己参照なし）
CREATE POLICY "employees_select" ON employees
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "employees_insert" ON employees
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "employees_update" ON employees
  FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "employees_delete" ON employees
  FOR DELETE TO authenticated
  USING (true);
