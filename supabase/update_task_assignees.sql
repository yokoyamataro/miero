-- 既存の未割当タスクに業務担当者を割り当てる
-- assigned_to が NULL のタスクに、対応する業務の manager_id を設定

UPDATE tasks
SET assigned_to = projects.manager_id
FROM projects
WHERE tasks.project_id = projects.id
  AND tasks.assigned_to IS NULL
  AND projects.manager_id IS NOT NULL;
