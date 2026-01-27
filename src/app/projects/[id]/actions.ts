"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { type TaskInsert, type CommentInsert, type TaskStatus } from "@/types/database";

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

export async function createComment(data: CommentInsert) {
  const supabase = await createClient();

  const { error } = await supabase.from("comments" as never).insert(data as never);

  if (error) {
    console.error("Error creating comment:", error);
    throw new Error("コメントの作成に失敗しました");
  }

  revalidatePath(`/projects/${data.project_id}`);
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
