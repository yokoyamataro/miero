"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { type TaskInsert, type TaskStatus, type ProjectStatus, type ProjectCategory } from "@/types/database";

// ============================================
// Project Actions
// ============================================

export async function updateProject(
  projectId: string,
  updates: {
    name?: string;
    status?: ProjectStatus;
    category?: ProjectCategory;
    contact_id?: string | null;
    manager_id?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    fee_tax_excluded?: number | null;
    location?: string | null;
  }
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("projects")
    .update(updates as never)
    .eq("id", projectId);

  if (error) {
    console.error("Error updating project:", error);
    throw new Error("業務の更新に失敗しました");
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}

// ============================================
// Task Actions
// ============================================

export async function createTask(data: TaskInsert) {
  const supabase = await createClient();

  const { error } = await supabase.from("tasks" as never).insert(data as never);

  if (error) {
    console.error("Error creating task:", error);
    throw new Error("タスクの作成に失敗しました");
  }

  revalidatePath(`/projects/${data.project_id}`);
}

export async function updateTask(
  taskId: string,
  updates: {
    title?: string;
    description?: string | null;
    status?: TaskStatus;
    due_date?: string | null;
    assigned_to?: string | null;
    sort_order?: number;
    // 時間管理
    estimated_minutes?: number | null;
    started_at?: string | null;
    completed_at?: string | null;
    actual_minutes?: number | null;
  }
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks" as never)
    .update(updates as never)
    .eq("id", taskId)
    .select("project_id")
    .single();

  if (error) {
    console.error("Error updating task:", error);
    throw new Error("タスクの更新に失敗しました");
  }

  if (data) {
    revalidatePath(`/projects/${(data as { project_id: string }).project_id}`);
  }
}

export async function deleteTask(taskId: string) {
  const supabase = await createClient();

  // まずタスクのproject_idを取得
  const { data: task } = await supabase
    .from("tasks" as never)
    .select("project_id")
    .eq("id", taskId)
    .single();

  const { error } = await supabase.from("tasks" as never).delete().eq("id", taskId);

  if (error) {
    console.error("Error deleting task:", error);
    throw new Error("タスクの削除に失敗しました");
  }

  if (task) {
    revalidatePath(`/projects/${(task as { project_id: string }).project_id}`);
  }
}

// ============================================
// Comment Actions
// ============================================

export async function createComment(projectId: string, content: string) {
  const supabase = await createClient();

  // ログインユーザーの社員IDを取得
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("ログインが必要です");
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_id", user.id)
    .single();

  if (!employee) {
    throw new Error("社員情報が見つかりません");
  }

  const { error } = await supabase.from("comments" as never).insert({
    project_id: projectId,
    author_id: employee.id,
    content: content,
  } as never);

  if (error) {
    console.error("Error creating comment:", error);
    throw new Error("コメントの作成に失敗しました");
  }

  revalidatePath(`/projects/${projectId}`);
}

export async function deleteComment(commentId: string) {
  const supabase = await createClient();

  // まずコメントのproject_idを取得
  const { data: comment } = await supabase
    .from("comments" as never)
    .select("project_id")
    .eq("id", commentId)
    .single();

  const { error } = await supabase.from("comments" as never).delete().eq("id", commentId);

  if (error) {
    console.error("Error deleting comment:", error);
    throw new Error("コメントの削除に失敗しました");
  }

  if (comment) {
    revalidatePath(`/projects/${(comment as { project_id: string }).project_id}`);
  }
}

// ============================================
// Comment Acknowledgement Actions (確認機能)
// ============================================

export async function acknowledgeComment(commentId: string, projectId: string) {
  const supabase = await createClient();

  // ログインユーザーの社員IDを取得
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("ログインが必要です");
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_id", user.id)
    .single();

  if (!employee) {
    throw new Error("社員情報が見つかりません");
  }

  const { error } = await supabase.from("comment_acknowledgements" as never).insert({
    comment_id: commentId,
    employee_id: employee.id,
  } as never);

  if (error) {
    // 既に確認済みの場合はエラーを無視
    if (error.code !== "23505") {
      console.error("Error acknowledging comment:", error);
      throw new Error("確認の登録に失敗しました");
    }
  }

  revalidatePath(`/projects/${projectId}`);
}

export async function removeAcknowledgement(commentId: string, projectId: string) {
  const supabase = await createClient();

  // ログインユーザーの社員IDを取得
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("ログインが必要です");
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_id", user.id)
    .single();

  if (!employee) {
    throw new Error("社員情報が見つかりません");
  }

  const { error } = await supabase
    .from("comment_acknowledgements" as never)
    .delete()
    .eq("comment_id", commentId)
    .eq("employee_id", employee.id);

  if (error) {
    console.error("Error removing acknowledgement:", error);
    throw new Error("確認の取り消しに失敗しました");
  }

  revalidatePath(`/projects/${projectId}`);
}

// 現在のユーザーの社員IDを取得
export async function getCurrentEmployeeId(): Promise<string | null> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_id", user.id)
    .single();

  return employee?.id || null;
}
