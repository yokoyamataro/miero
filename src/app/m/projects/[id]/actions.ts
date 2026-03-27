"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ============================================
// 業務ステータス変更
// ============================================

export async function updateProjectStatus(
  projectId: string,
  status: "進行中" | "完了"
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("projects")
    .update({ status })
    .eq("id", projectId);

  if (error) {
    console.error("Error updating project status:", error);
    return { error: error.message };
  }

  revalidatePath("/m/projects");
  revalidatePath(`/m/projects/${projectId}`);
  return { success: true };
}

// ============================================
// 閲覧履歴関連
// ============================================

// 閲覧履歴を保存（upsert）
export async function saveProjectView(projectId: string): Promise<void> {
  const supabase = await createClient();

  // ログインユーザーの社員IDを取得
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_id", user.id)
    .single();

  if (!employee) return;

  // upsert: 既存のレコードがあれば更新、なければ挿入
  await supabase.from("project_views" as never).upsert(
    {
      project_id: projectId,
      employee_id: employee.id,
      viewed_at: new Date().toISOString(),
    } as never,
    { onConflict: "project_id,employee_id" }
  );
}

// ============================================
// スケジュール（calendar_events）関連
// ============================================

// スケジュールの完了状態をトグル
export async function toggleEventComplete(
  eventId: string,
  isCompleted: boolean
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("calendar_events")
    .update({ is_completed: isCompleted })
    .eq("id", eventId);

  if (error) {
    console.error("Error toggling event:", error);
    return { error: error.message };
  }

  revalidatePath("/m/projects");
  revalidatePath("/");
  return { success: true };
}

// スケジュールを作成（日時未定の場合はstart_date=null）
export async function createEvent(
  projectId: string,
  title: string,
  isUndated: boolean = true
): Promise<{
  success?: boolean;
  error?: string;
  event?: {
    id: string;
    title: string;
    is_completed: boolean;
    start_date: string | null;
    sort_order: number;
  };
}> {
  const supabase = await createClient();

  // ログインユーザーを取得
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let creatorId: string | null = null;
  if (user) {
    const { data: employee } = await supabase
      .from("employees")
      .select("id")
      .eq("auth_id", user.id)
      .single();
    creatorId = employee?.id || null;
  }

  // 現在の最大sort_orderを取得
  const { data: existingEvents } = await supabase
    .from("calendar_events")
    .select("sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const maxSortOrder = existingEvents?.[0]?.sort_order || 0;

  const { data, error } = await supabase
    .from("calendar_events")
    .insert({
      project_id: projectId,
      title: title.trim(),
      is_completed: false,
      start_date: isUndated ? null : new Date().toISOString().split("T")[0],
      all_day: true,
      sort_order: maxSortOrder + 1,
      creator_id: creatorId,
    })
    .select("id, title, is_completed, start_date, sort_order")
    .single();

  if (error) {
    console.error("Error creating event:", error);
    return { error: error.message };
  }

  revalidatePath("/m/projects");
  revalidatePath("/");
  return { success: true, event: data };
}

// スケジュールのタイトルを更新
export async function updateEventTitle(
  eventId: string,
  title: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("calendar_events")
    .update({ title: title.trim() })
    .eq("id", eventId);

  if (error) {
    console.error("Error updating event:", error);
    return { error: error.message };
  }

  revalidatePath("/m/projects");
  revalidatePath("/");
  return { success: true };
}

// スケジュールを削除
export async function deleteEvent(
  eventId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  // まず参加者を削除
  await supabase
    .from("calendar_event_participants")
    .delete()
    .eq("event_id", eventId);

  const { error } = await supabase
    .from("calendar_events")
    .delete()
    .eq("id", eventId);

  if (error) {
    console.error("Error deleting event:", error);
    return { error: error.message };
  }

  revalidatePath("/m/projects");
  revalidatePath("/");
  return { success: true };
}
