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
