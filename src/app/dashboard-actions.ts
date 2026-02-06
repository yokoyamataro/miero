"use server";

import { createClient } from "@/lib/supabase/server";
import {
  type Task,
  type Project,
  type Employee,
} from "@/types/database";

// タスク＋業務情報の型
export type TaskWithProject = Task & {
  project: Pick<Project, "id" | "code" | "name" | "location">;
};

// 未完了タスク一覧を取得（業務情報付き）
export async function getIncompleteTasks(
  assignedToFilter?: string | null // null=全員, string=特定社員ID
): Promise<TaskWithProject[]> {
  const supabase = await createClient();

  // 未完了タスクを取得
  let query = supabase
    .from("tasks" as never)
    .select("*")
    .eq("status", "未完了")
    .order("sort_order", { ascending: true });

  if (assignedToFilter) {
    query = query.eq("assigned_to", assignedToFilter);
  }

  const { data: tasks, error: tasksError } = await query;

  if (tasksError || !tasks) {
    console.error("Error fetching tasks:", tasksError);
    return [];
  }

  const typedTasks = tasks as Task[];
  if (typedTasks.length === 0) return [];

  // 関連する業務を取得
  const projectIds = Array.from(new Set(typedTasks.map((t) => t.project_id)));
  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id, code, name, location, status")
    .in("id", projectIds);

  if (projectsError) {
    console.error("Error fetching projects:", projectsError);
    return [];
  }

  // 進行中の業務のみフィルタ（未着手・進行中・ステータス未設定を含む）
  const activeProjects = (projects || []).filter((p) =>
    ["未着手", "進行中"].includes(p.status) || !p.status
  );
  const projectMap = new Map(activeProjects.map((p) => [p.id, p]));

  // タスクに業務情報を付与（進行中の業務のみ）
  return typedTasks
    .filter((task) => projectMap.has(task.project_id))
    .map((task) => ({
      ...task,
      project: projectMap.get(task.project_id)!,
    }));
}

// 現在のユーザーの社員IDを取得
export async function getCurrentEmployeeId(): Promise<string | null> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const { data: employee, error: empError } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_id", user.id)
    .single();

  if (empError) {
    console.error("Employee lookup error:", empError);
    return null;
  }

  return employee?.id || null;
}

// 社員一覧を取得
export async function getEmployees(): Promise<Employee[]> {
  const supabase = await createClient();

  const { data: employees } = await supabase
    .from("employees")
    .select("*")
    .order("name");

  return (employees as Employee[]) || [];
}
