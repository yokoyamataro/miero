-- Dropboxフォルダリンク機能のためのカラム追加

-- 社員テーブルにDropboxベースパスを追加
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS dropbox_base_path TEXT;

COMMENT ON COLUMN employees.dropbox_base_path IS '社員のDropboxローカルベースパス (例: C:/Users/Name/Dropbox/)';

-- 業務テーブルにフォルダパスを追加
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS main_folder_path TEXT;

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS cad_folder_path TEXT;

COMMENT ON COLUMN projects.main_folder_path IS '業務のメインフォルダへの相対パス (Dropboxベースパスからの相対)';
COMMENT ON COLUMN projects.cad_folder_path IS 'CADデータフォルダへの相対パス (Dropboxベースパスからの相対)';
