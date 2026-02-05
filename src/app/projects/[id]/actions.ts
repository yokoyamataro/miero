"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  type TaskInsert,
  type TaskStatus,
  type ProjectStatus,
  type ProjectCategory,
  type StakeholderTag,
  type ProjectStakeholder,
  type ProjectStakeholderWithDetails,
  type Contact,
  type Account,
} from "@/types/database";

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
    location_detail?: string | null;
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

export async function deleteProject(projectId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId);

  if (error) {
    console.error("Error deleting project:", error);
    throw new Error("業務の削除に失敗しました");
  }

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

// タスクの並び順を更新
export async function reorderTasks(
  projectId: string,
  taskOrders: { id: string; sort_order: number }[]
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  // 各タスクのsort_orderを更新
  for (const task of taskOrders) {
    const { error } = await supabase
      .from("tasks" as never)
      .update({ sort_order: task.sort_order } as never)
      .eq("id", task.id);

    if (error) {
      console.error("Error updating task order:", error);
      return { error: "タスクの並び替えに失敗しました" };
    }
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
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
    console.error("acknowledgeComment: No user found");
    return { error: "ログインが必要です" };
  }

  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_id", user.id)
    .single();

  if (employeeError) {
    console.error("acknowledgeComment: Employee fetch error:", employeeError);
    return { error: "社員情報の取得に失敗しました" };
  }

  if (!employee) {
    console.error("acknowledgeComment: No employee found for user:", user.id);
    return { error: "社員情報が見つかりません" };
  }

  const { error } = await supabase.from("comment_acknowledgements" as never).insert({
    comment_id: commentId,
    employee_id: employee.id,
  } as never);

  if (error) {
    // 既に確認済みの場合はエラーを無視
    if (error.code !== "23505") {
      console.error("Error acknowledging comment:", error);
      return { error: "確認の登録に失敗しました" };
    }
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

export async function removeAcknowledgement(commentId: string, projectId: string) {
  const supabase = await createClient();

  // ログインユーザーの社員IDを取得
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error("removeAcknowledgement: No user found");
    return { error: "ログインが必要です" };
  }

  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_id", user.id)
    .single();

  if (employeeError) {
    console.error("removeAcknowledgement: Employee fetch error:", employeeError);
    return { error: "社員情報の取得に失敗しました" };
  }

  if (!employee) {
    console.error("removeAcknowledgement: No employee found for user:", user.id);
    return { error: "社員情報が見つかりません" };
  }

  const { error } = await supabase
    .from("comment_acknowledgements" as never)
    .delete()
    .eq("comment_id", commentId)
    .eq("employee_id", employee.id);

  if (error) {
    console.error("Error removing acknowledgement:", error);
    return { error: "確認の取り消しに失敗しました" };
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
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

// ============================================
// Stakeholder Actions (関係者)
// ============================================

// タグ一覧取得
export async function getStakeholderTags(): Promise<StakeholderTag[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("stakeholder_tags" as never)
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Error fetching stakeholder tags:", error);
    return [];
  }

  return (data as StakeholderTag[]) || [];
}

// 業務の関係者一覧取得
export async function getProjectStakeholders(
  projectId: string
): Promise<ProjectStakeholderWithDetails[]> {
  const supabase = await createClient();

  // 関係者を取得
  const { data: stakeholders, error } = await supabase
    .from("project_stakeholders" as never)
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching project stakeholders:", error);
    return [];
  }

  if (!stakeholders || stakeholders.length === 0) return [];

  const typedStakeholders = stakeholders as ProjectStakeholder[];

  // 連絡先IDとタグIDを収集
  const contactIds = Array.from(new Set(typedStakeholders.map((s) => s.contact_id)));
  const tagIds = Array.from(new Set(typedStakeholders.map((s) => s.tag_id)));

  // 連絡先を取得
  const { data: contacts } = await supabase
    .from("contacts" as never)
    .select("*")
    .in("id", contactIds);
  const contactMap = new Map((contacts as Contact[])?.map((c) => [c.id, c]) || []);

  // 法人を取得
  const accountIds = Array.from(new Set(
    (contacts as Contact[])?.map((c) => c.account_id).filter(Boolean) as string[] || []
  ));
  const accountMap = new Map<string, Account>();
  if (accountIds.length > 0) {
    const { data: accounts } = await supabase
      .from("accounts" as never)
      .select("*")
      .in("id", accountIds);
    (accounts as Account[])?.forEach((a) => accountMap.set(a.id, a));
  }

  // タグを取得
  const { data: tags } = await supabase
    .from("stakeholder_tags" as never)
    .select("*")
    .in("id", tagIds);
  const tagMap = new Map((tags as StakeholderTag[])?.map((t) => [t.id, t]) || []);

  // 結合
  return typedStakeholders
    .map((s) => {
      const contact = contactMap.get(s.contact_id);
      const tag = tagMap.get(s.tag_id);
      if (!contact || !tag) return null;

      return {
        ...s,
        contact,
        account: contact.account_id ? accountMap.get(contact.account_id) || null : null,
        tag,
      } as ProjectStakeholderWithDetails;
    })
    .filter(Boolean) as ProjectStakeholderWithDetails[];
}

// 関係者追加
export async function addProjectStakeholder(
  projectId: string,
  contactId: string,
  tagId: string,
  note?: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("project_stakeholders" as never)
    .insert({
      project_id: projectId,
      contact_id: contactId,
      tag_id: tagId,
      note: note || null,
    } as never);

  if (error) {
    console.error("Error adding stakeholder:", error);
    if (error.code === "23505") {
      return { error: "同じ連絡先・タグの組み合わせが既に登録されています" };
    }
    return { error: "関係者の追加に失敗しました" };
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

// 関係者削除
export async function removeProjectStakeholder(
  stakeholderId: string,
  projectId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("project_stakeholders" as never)
    .delete()
    .eq("id", stakeholderId);

  if (error) {
    console.error("Error removing stakeholder:", error);
    return { error: "関係者の削除に失敗しました" };
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

// 関係者のタグ変更
export async function updateProjectStakeholderTag(
  stakeholderId: string,
  tagId: string,
  projectId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("project_stakeholders" as never)
    .update({ tag_id: tagId } as never)
    .eq("id", stakeholderId);

  if (error) {
    console.error("Error updating stakeholder tag:", error);
    if (error.code === "23505") {
      return { error: "同じ連絡先・タグの組み合わせが既に登録されています" };
    }
    return { error: "タグの変更に失敗しました" };
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

// 新規タグ作成
export async function createStakeholderTag(
  name: string,
  color: string
): Promise<{ success?: boolean; error?: string; id?: string }> {
  const supabase = await createClient();

  // 最大のsort_orderを取得
  const { data: maxOrder } = await supabase
    .from("stakeholder_tags" as never)
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const newSortOrder = ((maxOrder as { sort_order: number } | null)?.sort_order ?? -1) + 1;

  const { data: tag, error } = await supabase
    .from("stakeholder_tags" as never)
    .insert({
      name,
      color,
      sort_order: newSortOrder,
    } as never)
    .select("id")
    .single();

  if (error) {
    console.error("Error creating stakeholder tag:", error);
    if (error.code === "23505") {
      return { error: "同じ名前のタグが既に存在します" };
    }
    return { error: "タグの作成に失敗しました" };
  }

  return { success: true, id: (tag as { id: string }).id };
}
