"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function toggleTaskComplete(
  taskId: string,
  isCompleted: boolean
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("tasks" as never)
    .update({
      is_completed: isCompleted,
      completed_at: isCompleted ? new Date().toISOString() : null,
    } as never)
    .eq("id", taskId);

  if (error) {
    console.error("Error toggling task:", error);
    return { error: error.message };
  }

  revalidatePath("/m/projects");
  return { success: true };
}

export async function createTask(
  projectId: string,
  title: string
): Promise<{ success?: boolean; error?: string; task?: { id: string; title: string; is_completed: boolean; sort_order: number } }> {
  const supabase = await createClient();

  // 現在の最大sort_orderを取得
  const { data: existingTasks } = await supabase
    .from("tasks" as never)
    .select("sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const maxSortOrder = (existingTasks as { sort_order: number }[] | null)?.[0]?.sort_order || 0;

  const { data, error } = await supabase
    .from("tasks" as never)
    .insert({
      project_id: projectId,
      title: title.trim(),
      is_completed: false,
      sort_order: maxSortOrder + 1,
    } as never)
    .select("id, title, is_completed, sort_order")
    .single();

  if (error) {
    console.error("Error creating task:", error);
    return { error: error.message };
  }

  revalidatePath("/m/projects");
  return { success: true, task: data as { id: string; title: string; is_completed: boolean; sort_order: number } };
}

export async function updateTask(
  taskId: string,
  title: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("tasks" as never)
    .update({ title: title.trim() } as never)
    .eq("id", taskId);

  if (error) {
    console.error("Error updating task:", error);
    return { error: error.message };
  }

  revalidatePath("/m/projects");
  return { success: true };
}

export async function deleteTask(
  taskId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("tasks" as never)
    .delete()
    .eq("id", taskId);

  if (error) {
    console.error("Error deleting task:", error);
    return { error: error.message };
  }

  revalidatePath("/m/projects");
  return { success: true };
}
