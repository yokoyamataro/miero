-- 一時的にanonアクセスも許可（開発用）
-- 認証機能が完成したら削除する

-- employees
CREATE POLICY "Allow anon read employees" ON employees FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert employees" ON employees FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update employees" ON employees FOR UPDATE TO anon USING (true);
CREATE POLICY "Allow anon delete employees" ON employees FOR DELETE TO anon USING (true);

-- accounts
CREATE POLICY "Allow anon read accounts" ON accounts FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert accounts" ON accounts FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update accounts" ON accounts FOR UPDATE TO anon USING (true);
CREATE POLICY "Allow anon delete accounts" ON accounts FOR DELETE TO anon USING (true);

-- contacts
CREATE POLICY "Allow anon read contacts" ON contacts FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert contacts" ON contacts FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update contacts" ON contacts FOR UPDATE TO anon USING (true);
CREATE POLICY "Allow anon delete contacts" ON contacts FOR DELETE TO anon USING (true);

-- projects
CREATE POLICY "Allow anon read projects" ON projects FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert projects" ON projects FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update projects" ON projects FOR UPDATE TO anon USING (true);
CREATE POLICY "Allow anon delete projects" ON projects FOR DELETE TO anon USING (true);

-- tasks
CREATE POLICY "Allow anon read tasks" ON tasks FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert tasks" ON tasks FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update tasks" ON tasks FOR UPDATE TO anon USING (true);
CREATE POLICY "Allow anon delete tasks" ON tasks FOR DELETE TO anon USING (true);

-- comments
CREATE POLICY "Allow anon read comments" ON comments FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert comments" ON comments FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update comments" ON comments FOR UPDATE TO anon USING (true);
CREATE POLICY "Allow anon delete comments" ON comments FOR DELETE TO anon USING (true);
