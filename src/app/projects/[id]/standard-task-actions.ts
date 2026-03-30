"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type {
  StandardTaskTemplate,
  StandardTaskItem,
  StandardTaskTemplateWithItems,
  ProjectStandardTask,
  ProjectStandardTaskProgress,
  ProjectStandardTaskWithDetails,
  StandardTaskStatus,
} from "@/types/database";

// ============================================
// 標準業務テンプレート取得
// ============================================

// 全テンプレート一覧（項目付き）
export async function getStandardTaskTemplates(): Promise<StandardTaskTemplateWithItems[]> {
  const supabase = await createClient();

  const { data: templates, error: templatesError } = await supabase
    .from("standard_task_templates" as never)
    .select("*")
    .order("sort_order", { ascending: true });

  if (templatesError || !templates) {
    console.error("Error fetching templates:", templatesError);
    return [];
  }

  const templateIds = (templates as StandardTaskTemplate[]).map((t) => t.id);

  const { data: items, error: itemsError } = await supabase
    .from("standard_task_items" as never)
    .select("*")
    .in("template_id", templateIds)
    .order("sort_order", { ascending: true });

  if (itemsError) {
    console.error("Error fetching items:", itemsError);
    return [];
  }

  const itemsByTemplate = new Map<string, StandardTaskItem[]>();
  (items as StandardTaskItem[] || []).forEach((item) => {
    const existing = itemsByTemplate.get(item.template_id) || [];
    existing.push(item);
    itemsByTemplate.set(item.template_id, existing);
  });

  return (templates as StandardTaskTemplate[]).map((template) => ({
    ...template,
    items: itemsByTemplate.get(template.id) || [],
  }));
}

// ============================================
// プロジェクトの標準業務取得
// ============================================

export async function getProjectStandardTasks(
  projectId: string
): Promise<ProjectStandardTaskWithDetails[]> {
  const supabase = await createClient();

  // プロジェクトに割り当てられた標準業務を取得
  const { data: projectTasks, error: ptError } = await supabase
    .from("project_standard_tasks" as never)
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (ptError || !projectTasks || projectTasks.length === 0) {
    return [];
  }

  const typedProjectTasks = projectTasks as ProjectStandardTask[];
  const templateIds = typedProjectTasks.map((pt) => pt.template_id);
  const projectTaskIds = typedProjectTasks.map((pt) => pt.id);

  // テンプレート情報を取得
  const { data: templates } = await supabase
    .from("standard_task_templates" as never)
    .select("*")
    .in("id", templateIds);

  const templateMap = new Map(
    (templates as StandardTaskTemplate[] || []).map((t) => [t.id, t])
  );

  // テンプレートの項目を取得
  const { data: items } = await supabase
    .from("standard_task_items" as never)
    .select("*")
    .in("template_id", templateIds)
    .order("sort_order", { ascending: true });

  const itemsByTemplate = new Map<string, StandardTaskItem[]>();
  (items as StandardTaskItem[] || []).forEach((item) => {
    const existing = itemsByTemplate.get(item.template_id) || [];
    existing.push(item);
    itemsByTemplate.set(item.template_id, existing);
  });

  // 進捗情報を取得
  const { data: progressData } = await supabase
    .from("project_standard_task_progress" as never)
    .select("*")
    .in("project_standard_task_id", projectTaskIds);

  const progressMap = new Map<string, Map<string, ProjectStandardTaskProgress>>();
  (progressData as ProjectStandardTaskProgress[] || []).forEach((p) => {
    if (!progressMap.has(p.project_standard_task_id)) {
      progressMap.set(p.project_standard_task_id, new Map());
    }
    progressMap.get(p.project_standard_task_id)!.set(p.item_id, p);
  });

  // 結果を組み立て（テンプレートが存在するもののみ）
  return typedProjectTasks
    .filter((pt) => templateMap.has(pt.template_id))
    .map((pt) => {
      const template = templateMap.get(pt.template_id)!;
      const templateItems = itemsByTemplate.get(pt.template_id) || [];
      const taskProgress = progressMap.get(pt.id) || new Map();

      return {
        ...pt,
        template,
        progress: templateItems.map((item) => {
          const p = taskProgress.get(item.id);
          return {
            item,
            status: (p?.status as StandardTaskStatus) || "未着手",
            updated_at: p?.updated_at || null,
          };
        }),
      };
    });
}

// ============================================
// プロジェクトに標準業務を割り当て
// ============================================

export async function assignStandardTaskToProject(
  projectId: string,
  templateId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  // 現在の最大sort_orderを取得
  const { data: existing } = await supabase
    .from("project_standard_tasks" as never)
    .select("sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const maxSortOrder = (existing as { sort_order: number }[] | null)?.[0]?.sort_order || 0;

  // 割り当て作成
  const { data: projectTask, error } = await supabase
    .from("project_standard_tasks" as never)
    .insert({
      project_id: projectId,
      template_id: templateId,
      sort_order: maxSortOrder + 1,
    } as never)
    .select("id")
    .single();

  if (error) {
    console.error("Error assigning standard task:", error);
    if (error.code === "23505") {
      return { error: "この標準業務は既に割り当てられています" };
    }
    return { error: "標準業務の割り当てに失敗しました" };
  }

  // テンプレートの項目を取得して進捗レコードを作成
  const { data: items } = await supabase
    .from("standard_task_items" as never)
    .select("id")
    .eq("template_id", templateId);

  if (items && items.length > 0) {
    const progressRecords = (items as { id: string }[]).map((item) => ({
      project_standard_task_id: (projectTask as { id: string }).id,
      item_id: item.id,
      status: "未着手",
    }));

    await supabase
      .from("project_standard_task_progress" as never)
      .insert(progressRecords as never);
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

// ============================================
// プロジェクトから標準業務を削除
// ============================================

export async function removeStandardTaskFromProject(
  projectStandardTaskId: string,
  projectId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  // 進捗も CASCADE で削除される
  const { error } = await supabase
    .from("project_standard_tasks" as never)
    .delete()
    .eq("id", projectStandardTaskId);

  if (error) {
    console.error("Error removing standard task:", error);
    return { error: "標準業務の削除に失敗しました" };
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

// ============================================
// 進捗状態の更新
// ============================================

export async function updateStandardTaskProgress(
  projectStandardTaskId: string,
  itemId: string,
  status: StandardTaskStatus,
  projectId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  // 現在のユーザーを取得
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let updatedBy: string | null = null;
  if (user) {
    const { data: employee } = await supabase
      .from("employees")
      .select("id")
      .eq("auth_id", user.id)
      .single();
    updatedBy = employee?.id || null;
  }

  // upsert で更新または作成
  const { error } = await supabase
    .from("project_standard_task_progress" as never)
    .upsert(
      {
        project_standard_task_id: projectStandardTaskId,
        item_id: itemId,
        status,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy,
      } as never,
      { onConflict: "project_standard_task_id,item_id" }
    );

  if (error) {
    console.error("Error updating progress:", error);
    return { error: "進捗の更新に失敗しました" };
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}
