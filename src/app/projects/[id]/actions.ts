"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  type TaskInsert,
  type ProjectStatus,
  type ProjectCategory,
  type StakeholderTag,
  type ProjectStakeholder,
  type ProjectStakeholderWithDetails,
  type Contact,
  type Account,
  type TaskTemplateSet,
  type TaskTemplateItem,
  type TaskTemplateSetWithItems,
  type Task,
  type Industry,
  DEFAULT_INDUSTRIES,
} from "@/types/database";

// ============================================
// Project Actions
// ============================================

export async function updateProject(
  projectId: string,
  updates: {
    name?: string;
    status?: ProjectStatus;
    is_urgent?: boolean;
    is_on_hold?: boolean;
    category?: ProjectCategory;
    contact_id?: string | null;
    manager_id?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    fee_tax_excluded?: number | null;
    location?: string | null;
    location_detail?: string | null;
    notes?: string | null;
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
    is_completed?: boolean;
    due_date?: string | null;
    assigned_to?: string | null;
    sort_order?: number;
    // 時間管理
    estimated_minutes?: number | null;
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
// Task Template Set Actions
// ============================================

// テンプレートセット一覧取得（アイテム含む）
export async function getTaskTemplateSets(): Promise<TaskTemplateSetWithItems[]> {
  const supabase = await createClient();

  // セット一覧を取得
  const { data: sets, error: setsError } = await supabase
    .from("task_template_sets" as never)
    .select("*")
    .order("created_at", { ascending: false });

  if (setsError || !sets) {
    console.error("Error fetching task template sets:", setsError);
    return [];
  }

  // 各セットのアイテムを取得
  const setIds = (sets as TaskTemplateSet[]).map((s) => s.id);
  const { data: items, error: itemsError } = await supabase
    .from("task_template_items" as never)
    .select("*")
    .in("set_id", setIds)
    .order("sort_order", { ascending: true });

  if (itemsError) {
    console.error("Error fetching task template items:", itemsError);
    return [];
  }

  // セットにアイテムを紐付け
  const itemsBySetId = (items as TaskTemplateItem[] || []).reduce((acc, item) => {
    if (!acc[item.set_id]) acc[item.set_id] = [];
    acc[item.set_id].push(item);
    return acc;
  }, {} as Record<string, TaskTemplateItem[]>);

  return (sets as TaskTemplateSet[]).map((set) => ({
    ...set,
    items: itemsBySetId[set.id] || [],
  }));
}

// テンプレートセット作成（プロジェクトの全タスクから）
export async function createTaskTemplateSetFromProject(
  projectId: string,
  setName: string
): Promise<{ success?: boolean; error?: string; id?: string }> {
  const supabase = await createClient();

  // プロジェクトのタスクを取得
  const { data: tasks, error: tasksError } = await supabase
    .from("tasks" as never)
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (tasksError) {
    console.error("Error fetching tasks:", tasksError);
    return { error: "タスクの取得に失敗しました" };
  }

  if (!tasks || (tasks as Task[]).length === 0) {
    return { error: "保存するタスクがありません" };
  }

  // セットを作成
  const { data: set, error: setError } = await supabase
    .from("task_template_sets" as never)
    .insert({ name: setName } as never)
    .select("id")
    .single();

  if (setError || !set) {
    console.error("Error creating task template set:", setError);
    return { error: "テンプレートセットの作成に失敗しました" };
  }

  const setId = (set as { id: string }).id;

  // アイテムを作成
  const itemsToInsert = (tasks as Task[]).map((task, index) => ({
    set_id: setId,
    title: task.title,
    estimated_minutes: task.estimated_minutes,
    sort_order: index,
  }));

  const { error: itemsError } = await supabase
    .from("task_template_items" as never)
    .insert(itemsToInsert as never);

  if (itemsError) {
    console.error("Error creating task template items:", itemsError);
    // セットを削除してロールバック
    await supabase.from("task_template_sets" as never).delete().eq("id", setId);
    return { error: "テンプレートアイテムの作成に失敗しました" };
  }

  return { success: true, id: setId };
}

// テンプレートセット削除
export async function deleteTaskTemplateSet(
  setId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  // ON DELETE CASCADEでアイテムも自動削除される
  const { error } = await supabase
    .from("task_template_sets" as never)
    .delete()
    .eq("id", setId);

  if (error) {
    console.error("Error deleting task template set:", error);
    return { error: "テンプレートセットの削除に失敗しました" };
  }

  return { success: true };
}

// テンプレートセットからタスクを一括作成
export async function createTasksFromTemplateSet(
  projectId: string,
  setId: string,
  defaultAssigneeId?: string | null
): Promise<{ success?: boolean; error?: string; created?: number }> {
  const supabase = await createClient();

  // テンプレートアイテムを取得
  const { data: items, error: fetchError } = await supabase
    .from("task_template_items" as never)
    .select("*")
    .eq("set_id", setId)
    .order("sort_order", { ascending: true });

  if (fetchError || !items) {
    console.error("Error fetching template items:", fetchError);
    return { error: "テンプレートの取得に失敗しました" };
  }

  if ((items as TaskTemplateItem[]).length === 0) {
    return { error: "テンプレートにタスクがありません" };
  }

  // 現在の最大sort_orderを取得
  const { data: maxOrder } = await supabase
    .from("tasks" as never)
    .select("sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  let currentSortOrder = ((maxOrder as { sort_order: number } | null)?.sort_order ?? -1) + 1;

  // タスクを作成
  const tasksToInsert = (items as TaskTemplateItem[]).map((item) => ({
    project_id: projectId,
    title: item.title,
    estimated_minutes: item.estimated_minutes,
    is_completed: false,
    sort_order: currentSortOrder++,
    assigned_to: defaultAssigneeId || null,
  }));

  const { error: insertError } = await supabase
    .from("tasks" as never)
    .insert(tasksToInsert as never);

  if (insertError) {
    console.error("Error creating tasks from template set:", insertError);
    return { error: "タスクの作成に失敗しました" };
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: true, created: tasksToInsert.length };
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

// ============================================
// Contact/Account Actions (顧客情報編集)
// ============================================

// 連絡先（個人/担当者）を更新
export async function updateContact(
  contactId: string,
  updates: {
    last_name?: string;
    first_name?: string;
    last_name_kana?: string | null;
    first_name_kana?: string | null;
    email?: string | null;
    phone?: string | null;
    postal_code?: string | null;
    prefecture?: string | null;
    city?: string | null;
    street?: string | null;
    building?: string | null;
    department?: string | null;
    position?: string | null;
  }
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("contacts" as never)
    .update(updates as never)
    .eq("id", contactId);

  if (error) {
    console.error("Error updating contact:", error);
    return { error: "連絡先の更新に失敗しました" };
  }

  return { success: true };
}

// 法人を更新
export async function updateAccount(
  accountId: string,
  updates: {
    company_name?: string;
    company_name_kana?: string | null;
    main_phone?: string | null;
    fax?: string | null;
    postal_code?: string | null;
    prefecture?: string | null;
    city?: string | null;
    street?: string | null;
    building?: string | null;
  }
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("accounts" as never)
    .update(updates as never)
    .eq("id", accountId);

  if (error) {
    console.error("Error updating account:", error);
    return { error: "法人情報の更新に失敗しました" };
  }

  return { success: true };
}

// ============================================
// 新規顧客作成 (個人/法人+担当者)
// ============================================

// 個人顧客を作成
export async function createIndividualContact(data: {
  last_name: string;
  first_name: string;
  last_name_kana?: string | null;
  first_name_kana?: string | null;
  birth_date?: string | null;
  email?: string | null;
  phone?: string | null;
  postal_code?: string | null;
  prefecture?: string | null;
  city?: string | null;
  street?: string | null;
  building?: string | null;
  notes?: string | null;
}): Promise<{ success?: boolean; error?: string; contactId?: string }> {
  const supabase = await createClient();

  const { data: contact, error } = await supabase
    .from("contacts" as never)
    .insert({
      last_name: data.last_name,
      first_name: data.first_name,
      last_name_kana: data.last_name_kana || null,
      first_name_kana: data.first_name_kana || null,
      birth_date: data.birth_date || null,
      email: data.email || null,
      phone: data.phone || null,
      postal_code: data.postal_code || null,
      prefecture: data.prefecture || null,
      city: data.city || null,
      notes: data.notes || null,
      street: data.street || null,
      building: data.building || null,
      account_id: null,
      is_primary: false,
    } as never)
    .select("id")
    .single();

  if (error) {
    console.error("Error creating individual contact:", error);
    return { error: "個人顧客の作成に失敗しました" };
  }

  return { success: true, contactId: (contact as { id: string }).id };
}

// 法人＋担当者を作成
export async function createCorporateContact(data: {
  // 法人情報
  company_name: string;
  company_name_kana?: string | null;
  main_phone?: string | null;
  fax?: string | null;
  postal_code?: string | null;
  prefecture?: string | null;
  city?: string | null;
  street?: string | null;
  building?: string | null;
  // 担当者情報
  contact_last_name: string;
  contact_first_name: string;
  contact_last_name_kana?: string | null;
  contact_first_name_kana?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  contact_department?: string | null;
  contact_position?: string | null;
}): Promise<{ success?: boolean; error?: string; contactId?: string; accountId?: string }> {
  const supabase = await createClient();

  // 法人を作成
  const { data: account, error: accountError } = await supabase
    .from("accounts" as never)
    .insert({
      company_name: data.company_name,
      company_name_kana: data.company_name_kana || null,
      main_phone: data.main_phone || null,
      fax: data.fax || null,
      postal_code: data.postal_code || null,
      prefecture: data.prefecture || null,
      city: data.city || null,
      street: data.street || null,
      building: data.building || null,
    } as never)
    .select("id")
    .single();

  if (accountError) {
    console.error("Error creating account:", accountError);
    return { error: "法人の作成に失敗しました" };
  }

  const accountId = (account as { id: string }).id;

  // 担当者を作成
  const { data: contact, error: contactError } = await supabase
    .from("contacts" as never)
    .insert({
      last_name: data.contact_last_name,
      first_name: data.contact_first_name,
      last_name_kana: data.contact_last_name_kana || null,
      first_name_kana: data.contact_first_name_kana || null,
      email: data.contact_email || null,
      phone: data.contact_phone || null,
      department: data.contact_department || null,
      position: data.contact_position || null,
      account_id: accountId,
      is_primary: true,
    } as never)
    .select("id")
    .single();

  if (contactError) {
    console.error("Error creating contact:", contactError);
    return { error: "担当者の作成に失敗しました", accountId };
  }

  return {
    success: true,
    contactId: (contact as { id: string }).id,
    accountId,
  };
}

// 既存の法人に担当者を追加
export async function addContactToAccount(data: {
  account_id: string;
  last_name: string;
  first_name: string;
  last_name_kana?: string | null;
  first_name_kana?: string | null;
  email?: string | null;
  phone?: string | null;
  department?: string | null;
  position?: string | null;
  is_primary?: boolean;
}): Promise<{ success?: boolean; error?: string; contactId?: string }> {
  const supabase = await createClient();

  const { data: contact, error: contactError } = await supabase
    .from("contacts" as never)
    .insert({
      account_id: data.account_id,
      last_name: data.last_name,
      first_name: data.first_name,
      last_name_kana: data.last_name_kana || null,
      first_name_kana: data.first_name_kana || null,
      email: data.email || null,
      phone: data.phone || null,
      department: data.department || null,
      position: data.position || null,
      is_primary: data.is_primary ?? false,
    } as never)
    .select("id")
    .single();

  if (contactError) {
    console.error("Error adding contact to account:", contactError);
    return { error: "担当者の追加に失敗しました" };
  }

  return {
    success: true,
    contactId: (contact as { id: string }).id,
  };
}

// ============================================
// 業種一覧取得
// ============================================
export async function getIndustries(): Promise<Industry[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("industries" as never)
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Error fetching industries:", error);
    const now = new Date().toISOString();
    return DEFAULT_INDUSTRIES.map((name, i) => ({
      id: `default-${i}`,
      name,
      sort_order: i,
      created_at: now,
      updated_at: now,
    }));
  }

  return (data as Industry[]) || [];
}

// ============================================
// 法人+担当者を作成（共通モーダル用）
// ============================================
export interface AccountFormData {
  company_name: string;
  company_name_kana: string | null;
  corporate_number: string | null;
  main_phone: string | null;
  fax: string | null;
  postal_code: string | null;
  prefecture: string | null;
  city: string | null;
  street: string | null;
  building: string | null;
  industry: string | null;
  notes: string | null;
}

export interface ContactFormData {
  id?: string;
  last_name: string;
  first_name: string;
  last_name_kana: string | null;
  first_name_kana: string | null;
  phone: string | null;
  email: string | null;
  department: string | null;
  position: string | null;
  is_primary: boolean;
  branch_id: string | null;
}

export interface BranchFormData {
  id?: string;
  name: string;
  phone: string | null;
  fax: string | null;
  postal_code: string | null;
  prefecture: string | null;
  city: string | null;
  street: string | null;
  building: string | null;
}

export async function createAccountWithContacts(
  accountData: AccountFormData,
  contacts: ContactFormData[],
  branches: BranchFormData[]
): Promise<{ error?: string; accountId?: string; primaryContactId?: string }> {
  const supabase = await createClient();

  // 法人を作成
  const { data: account, error: accountError } = await supabase
    .from("accounts" as never)
    .insert({
      company_name: accountData.company_name,
      company_name_kana: accountData.company_name_kana,
      corporate_number: accountData.corporate_number,
      main_phone: accountData.main_phone,
      fax: accountData.fax,
      postal_code: accountData.postal_code,
      prefecture: accountData.prefecture,
      city: accountData.city,
      street: accountData.street,
      building: accountData.building,
      industry: accountData.industry,
      notes: accountData.notes,
    } as never)
    .select("id")
    .single();

  if (accountError || !account) {
    console.error("Error creating account:", accountError);
    return { error: "法人の作成に失敗しました" };
  }

  const accountId = (account as { id: string }).id;

  // 支店を作成
  const branchIdMap: Record<string, string> = {};
  for (const branch of branches) {
    if (!branch.name.trim()) continue;

    const { data: newBranch, error: branchError } = await supabase
      .from("branches" as never)
      .insert({
        account_id: accountId,
        name: branch.name,
        phone: branch.phone,
        fax: branch.fax,
        postal_code: branch.postal_code,
        prefecture: branch.prefecture,
        city: branch.city,
        street: branch.street,
        building: branch.building,
      } as never)
      .select("id")
      .single();

    if (!branchError && newBranch) {
      branchIdMap[branch.id || ""] = (newBranch as { id: string }).id;
    }
  }

  // 担当者を作成
  let primaryContactId: string | undefined;
  for (const contact of contacts) {
    if (!contact.last_name.trim() && !contact.first_name.trim()) continue;

    const branchId = contact.branch_id ? branchIdMap[contact.branch_id] || null : null;

    const { data: newContact, error: contactError } = await supabase
      .from("contacts" as never)
      .insert({
        account_id: accountId,
        branch_id: branchId,
        last_name: contact.last_name,
        first_name: contact.first_name,
        last_name_kana: contact.last_name_kana,
        first_name_kana: contact.first_name_kana,
        phone: contact.phone,
        email: contact.email,
        department: contact.department,
        position: contact.position,
        is_primary: contact.is_primary,
      } as never)
      .select("id")
      .single();

    if (!contactError && newContact) {
      if (contact.is_primary) {
        primaryContactId = (newContact as { id: string }).id;
      } else if (!primaryContactId) {
        primaryContactId = (newContact as { id: string }).id;
      }
    }
  }

  return { accountId, primaryContactId };
}
