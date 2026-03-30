"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type {
  StandardTaskTemplate,
  StandardTaskItem,
  ProjectStandardTask,
  ProjectStandardTaskProgress,
  StandardTaskStatus,
} from "@/types/database";

// 工程表用のプロジェクト型
export interface WorkflowProject {
  id: string;
  code: string | null;
  name: string;
  status: string;
  manager_id: string | null;
  manager_name: string | null;
  template_id: string;
  template_name: string;
  project_standard_task_id: string;
  progress: {
    item_id: string;
    item_title: string;
    item_sort_order: number;
    status: StandardTaskStatus;
  }[];
}

// デバッグ情報取得
export async function getDebugInfo(templateId: string): Promise<{
  templateId: string;
  templateName: string | null;
  projectTasksCount: number;
  projectIds: string[];
  activeProjectsCount: number;
  projectStatuses: string[];
  error: string | null;
  workflowProjectsCount: number;
  workflowDebug: string;
}> {
  const supabase = await createClient();

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch (e) {
    return {
      templateId,
      templateName: null,
      projectTasksCount: 0,
      projectIds: [],
      activeProjectsCount: 0,
      projectStatuses: [],
      error: `adminClient作成失敗: ${e instanceof Error ? e.message : String(e)}`,
      workflowProjectsCount: 0,
      workflowDebug: "",
    };
  }

  // テンプレート情報
  const { data: template } = await supabase
    .from("standard_task_templates" as never)
    .select("name")
    .eq("id", templateId)
    .single();

  // project_standard_tasks
  const { data: projectTasks } = await supabase
    .from("project_standard_tasks" as never)
    .select("id, project_id")
    .eq("template_id", templateId);

  const projectIds = (projectTasks as { id: string; project_id: string }[] || []).map(pt => pt.project_id);

  // プロジェクト情報（全ステータス）- RLSバイパスのため管理者クライアント使用
  const { data: allProjects, error: allProjectsError } = projectIds.length > 0
    ? await adminClient
        .from("projects")
        .select("id, status")
        .in("id", projectIds)
    : { data: [], error: null };

  // 進行中のみ
  const { data: activeProjects, error: activeProjectsError } = projectIds.length > 0
    ? await adminClient
        .from("projects")
        .select("id")
        .in("id", projectIds)
        .eq("status", "進行中")
    : { data: [], error: null };

  const errorMessages: string[] = [];
  if (allProjectsError) errorMessages.push(`allProjects: ${allProjectsError.message}`);
  if (activeProjectsError) errorMessages.push(`activeProjects: ${activeProjectsError.message}`);

  // getWorkflowProjectsも呼んでみる
  const { projects: workflowProjects, debug: workflowDebug } = await getWorkflowProjectsWithDebug(templateId);

  return {
    templateId,
    templateName: (template as { name: string } | null)?.name || null,
    projectTasksCount: (projectTasks as unknown[] || []).length,
    projectIds,
    activeProjectsCount: (activeProjects as unknown[] || []).length,
    projectStatuses: (allProjects as { id: string; status: string }[] || []).map(p => p.status),
    error: errorMessages.length > 0 ? errorMessages.join("; ") : null,
    workflowProjectsCount: workflowProjects.length,
    workflowDebug,
  };
}

// テンプレート一覧（選択用）
export async function getWorkflowTemplates(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("standard_task_templates" as never)
    .select("id, name")
    .order("sort_order");

  if (error) {
    console.error("Error fetching templates:", error);
    return [];
  }

  return (data as { id: string; name: string }[]) || [];
}

// 指定テンプレートの項目一覧
export async function getTemplateItems(templateId: string): Promise<StandardTaskItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("standard_task_items" as never)
    .select("*")
    .eq("template_id", templateId)
    .order("sort_order");

  if (error) {
    console.error("Error fetching items:", error);
    return [];
  }

  return (data as StandardTaskItem[]) || [];
}

// 工程表データ取得（デバッグ用）
async function getWorkflowProjectsWithDebug(templateId: string): Promise<{ projects: WorkflowProject[]; debug: string }> {
  const debugSteps: string[] = [];
  const supabase = await createClient();

  let adminClient;
  try {
    adminClient = createAdminClient();
    debugSteps.push("adminClient:OK");
  } catch (e) {
    return { projects: [], debug: `adminClient:FAIL(${e instanceof Error ? e.message : String(e)})` };
  }

  // テンプレート情報を取得
  const { data: template, error: templateError } = await supabase
    .from("standard_task_templates" as never)
    .select("id, name")
    .eq("id", templateId)
    .single();

  if (templateError || !template) {
    return { projects: [], debug: `template:FAIL(${templateError?.message || "no data"})` };
  }
  debugSteps.push("template:OK");

  // テンプレートの項目を取得
  const { data: items, error: itemsError } = await supabase
    .from("standard_task_items" as never)
    .select("*")
    .eq("template_id", templateId)
    .order("sort_order");

  if (itemsError) {
    debugSteps.push(`items:FAIL(${itemsError.message})`);
  } else {
    debugSteps.push(`items:${(items || []).length}`);
  }

  const templateItems = (items as StandardTaskItem[]) || [];

  // このテンプレートが割り当てられているプロジェクトを取得
  const { data: projectTasks, error: projectTasksError } = await supabase
    .from("project_standard_tasks" as never)
    .select("id, project_id, template_id")
    .eq("template_id", templateId);

  if (projectTasksError) {
    return { projects: [], debug: debugSteps.join(",") + `,projectTasks:FAIL(${projectTasksError.message})` };
  }

  if (!projectTasks || projectTasks.length === 0) {
    return { projects: [], debug: debugSteps.join(",") + ",projectTasks:0" };
  }
  debugSteps.push(`projectTasks:${projectTasks.length}`);

  const typedProjectTasks = projectTasks as ProjectStandardTask[];
  const projectIds = typedProjectTasks.map((pt) => pt.project_id);

  // プロジェクト情報を取得（進行中のみ）- RLSバイパスのため管理者クライアント使用
  const { data: projects, error: projectsError } = await adminClient
    .from("projects")
    .select("id, code, name, status, manager_id")
    .in("id", projectIds)
    .eq("status", "進行中");

  if (projectsError) {
    return { projects: [], debug: debugSteps.join(",") + `,projects:FAIL(${projectsError.message})` };
  }

  if (!projects || projects.length === 0) {
    return { projects: [], debug: debugSteps.join(",") + ",projects:0" };
  }
  debugSteps.push(`projects:${projects.length}`);

  // 以下、結果組み立て（getWorkflowProjectsと同じ）
  type ProjectType = {
    id: string;
    code: string | null;
    name: string;
    status: string;
    manager_id: string | null;
  };

  const typedProjects = projects as ProjectType[];
  const activeProjectIds = new Set(typedProjects.map((p) => p.id));

  const managerIds = typedProjects.map((p) => p.manager_id).filter((id): id is string => !!id);
  const { data: managers } = managerIds.length > 0
    ? await adminClient
        .from("employees")
        .select("id, name")
        .in("id", managerIds)
    : { data: [] };

  const managerMap = new Map(
    ((managers as { id: string; name: string }[]) || []).map((m) => [m.id, m.name])
  );

  const activeProjectTaskIds = typedProjectTasks
    .filter((pt) => activeProjectIds.has(pt.project_id))
    .map((pt) => pt.id);

  const { data: progressData } = activeProjectTaskIds.length > 0
    ? await supabase
        .from("project_standard_task_progress" as never)
        .select("*")
        .in("project_standard_task_id", activeProjectTaskIds)
    : { data: [] };

  const progressMap = new Map<string, Map<string, ProjectStandardTaskProgress>>();
  ((progressData as ProjectStandardTaskProgress[]) || []).forEach((p) => {
    if (!progressMap.has(p.project_standard_task_id)) {
      progressMap.set(p.project_standard_task_id, new Map());
    }
    progressMap.get(p.project_standard_task_id)!.set(p.item_id, p);
  });

  const result: WorkflowProject[] = [];

  for (const project of typedProjects) {
    const projectTask = typedProjectTasks.find((pt) => pt.project_id === project.id);
    if (!projectTask) continue;

    const taskProgress = progressMap.get(projectTask.id) || new Map();

    result.push({
      id: project.id,
      code: project.code,
      name: project.name,
      status: project.status,
      manager_id: project.manager_id,
      manager_name: project.manager_id ? managerMap.get(project.manager_id) || null : null,
      template_id: templateId,
      template_name: (template as { name: string }).name,
      project_standard_task_id: projectTask.id,
      progress: templateItems.map((item) => {
        const p = taskProgress.get(item.id);
        return {
          item_id: item.id,
          item_title: item.title,
          item_sort_order: item.sort_order,
          status: (p?.status as StandardTaskStatus) || "未着手",
        };
      }),
    });
  }

  result.sort((a, b) => {
    if (!a.code && !b.code) return 0;
    if (!a.code) return 1;
    if (!b.code) return -1;
    return a.code.localeCompare(b.code);
  });

  debugSteps.push(`result:${result.length}`);
  return { projects: result, debug: debugSteps.join(",") };
}

// 工程表データ取得
export async function getWorkflowProjects(templateId: string): Promise<WorkflowProject[]> {
  const { projects } = await getWorkflowProjectsWithDebug(templateId);
  return projects;
}

// ステータス更新
export async function updateWorkflowStatus(
  projectStandardTaskId: string,
  itemId: string,
  status: StandardTaskStatus
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
    console.error("Error updating workflow status:", error);
    return { error: "ステータスの更新に失敗しました" };
  }

  revalidatePath("/workflow");
  return { success: true };
}
