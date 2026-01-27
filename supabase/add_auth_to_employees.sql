-- ============================================
-- employeesテーブルに認証用カラム追加
-- ============================================

-- auth.usersとの紐付け用カラム
ALTER TABLE employees ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_employees_auth_id ON employees(auth_id);

-- ============================================
-- RLSポリシー更新（認証ユーザーのみアクセス可能に）
-- ============================================

-- 既存のanonポリシーを削除
DROP POLICY IF EXISTS "Allow anonymous read employees" ON employees;
DROP POLICY IF EXISTS "Allow anonymous insert employees" ON employees;
DROP POLICY IF EXISTS "Allow anonymous update employees" ON employees;
DROP POLICY IF EXISTS "Allow anonymous delete employees" ON employees;

-- 認証済みユーザー用ポリシー
CREATE POLICY "Allow authenticated read employees" ON employees
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert employees" ON employees
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update employees" ON employees
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete employees" ON employees
  FOR DELETE TO authenticated USING (true);

-- ============================================
-- 他テーブルのRLSも認証済みユーザーに変更
-- ============================================

-- accounts
DROP POLICY IF EXISTS "Allow anonymous read accounts" ON accounts;
DROP POLICY IF EXISTS "Allow anonymous insert accounts" ON accounts;
DROP POLICY IF EXISTS "Allow anonymous update accounts" ON accounts;
DROP POLICY IF EXISTS "Allow anonymous delete accounts" ON accounts;

CREATE POLICY "Allow authenticated read accounts" ON accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert accounts" ON accounts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update accounts" ON accounts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete accounts" ON accounts FOR DELETE TO authenticated USING (true);

-- contacts
DROP POLICY IF EXISTS "Allow anonymous read contacts" ON contacts;
DROP POLICY IF EXISTS "Allow anonymous insert contacts" ON contacts;
DROP POLICY IF EXISTS "Allow anonymous update contacts" ON contacts;
DROP POLICY IF EXISTS "Allow anonymous delete contacts" ON contacts;

CREATE POLICY "Allow authenticated read contacts" ON contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert contacts" ON contacts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update contacts" ON contacts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete contacts" ON contacts FOR DELETE TO authenticated USING (true);

-- projects
DROP POLICY IF EXISTS "Allow anonymous read projects" ON projects;
DROP POLICY IF EXISTS "Allow anonymous insert projects" ON projects;
DROP POLICY IF EXISTS "Allow anonymous update projects" ON projects;
DROP POLICY IF EXISTS "Allow anonymous delete projects" ON projects;

CREATE POLICY "Allow authenticated read projects" ON projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert projects" ON projects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update projects" ON projects FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete projects" ON projects FOR DELETE TO authenticated USING (true);

-- tasks
DROP POLICY IF EXISTS "Allow anonymous read tasks" ON tasks;
DROP POLICY IF EXISTS "Allow anonymous insert tasks" ON tasks;
DROP POLICY IF EXISTS "Allow anonymous update tasks" ON tasks;
DROP POLICY IF EXISTS "Allow anonymous delete tasks" ON tasks;

CREATE POLICY "Allow authenticated read tasks" ON tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert tasks" ON tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update tasks" ON tasks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete tasks" ON tasks FOR DELETE TO authenticated USING (true);

-- comments
DROP POLICY IF EXISTS "Allow anonymous read comments" ON comments;
DROP POLICY IF EXISTS "Allow anonymous insert comments" ON comments;
DROP POLICY IF EXISTS "Allow anonymous update comments" ON comments;
DROP POLICY IF EXISTS "Allow anonymous delete comments" ON comments;

CREATE POLICY "Allow authenticated read comments" ON comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert comments" ON comments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update comments" ON comments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete comments" ON comments FOR DELETE TO authenticated USING (true);
