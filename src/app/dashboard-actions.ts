"use server";

import { createClient } from "@/lib/supabase/server";
import {
  type Task,
  type Project,
  type Employee,
} from "@/types/database";

// タスク＋業務情報の型
export type TaskWithProject = Task & {
  project: Pick<Project, "id" | "code" | "name" | "location" | "is_urgent" | "is_on_hold">;
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
    .eq("is_completed", false)
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
    .select("id, code, name, location, status, is_urgent, is_on_hold")
    .in("id", projectIds);

  if (projectsError) {
    console.error("Error fetching projects:", projectsError);
    return [];
  }

  const projectMap = new Map((projects || []).map((p) => [p.id, p]));

  // タスクに業務情報を付与
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

// タスクの完了状態を切り替え
export async function toggleTaskComplete(
  taskId: string,
  isCompleted: boolean
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("tasks" as never)
    .update({
      is_completed: isCompleted,
      completed_at: isCompleted ? now : null,  // 完了時は日時を記録、未完了に戻す時はnull
      updated_at: now,
    } as never)
    .eq("id", taskId);

  if (error) {
    console.error("Error updating task:", error);
    return { error: "タスクの更新に失敗しました" };
  }

  return {};
}
