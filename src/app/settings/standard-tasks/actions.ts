"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ============================================
// テンプレート操作
// ============================================

export async function createTemplate(name: string): Promise<{ success?: boolean; error?: string; id?: string }> {
  const supabase = await createClient();

  // 最大sort_orderを取得
  const { data: existing } = await supabase
    .from("standard_task_templates" as never)
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1);

  const maxSortOrder = (existing as { sort_order: number }[] | null)?.[0]?.sort_order || 0;

  const { data, error } = await supabase
    .from("standard_task_templates" as never)
    .insert({
      name,
      sort_order: maxSortOrder + 1,
    } as never)
    .select("id")
    .single();

  if (error) {
    console.error("Error creating template:", error);
    if (error.code === "23505") {
      return { error: "同じ名前のテンプレートが既に存在します" };
    }
    return { error: "テンプレートの作成に失敗しました" };
  }

  revalidatePath("/settings/standard-tasks");
  return { success: true, id: (data as { id: string }).id };
}

export async function updateTemplate(
  id: string,
  name: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("standard_task_templates" as never)
    .update({ name, updated_at: new Date().toISOString() } as never)
    .eq("id", id);

  if (error) {
    console.error("Error updating template:", error);
    if (error.code === "23505") {
      return { error: "同じ名前のテンプレートが既に存在します" };
    }
    return { error: "テンプレートの更新に失敗しました" };
  }

  revalidatePath("/settings/standard-tasks");
  return { success: true };
}

export async function deleteTemplate(id: string): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  // CASCADE削除で項目も削除される
  const { error } = await supabase
    .from("standard_task_templates" as never)
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting template:", error);
    return { error: "テンプレートの削除に失敗しました" };
  }

  revalidatePath("/settings/standard-tasks");
  return { success: true };
}

export async function reorderTemplates(
  templates: { id: string; sort_order: number }[]
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  // 各テンプレートのsort_orderを更新
  for (const template of templates) {
    const { error } = await supabase
      .from("standard_task_templates" as never)
      .update({ sort_order: template.sort_order } as never)
      .eq("id", template.id);

    if (error) {
      console.error("Error reordering templates:", error);
      return { error: "テンプレートの並び替えに失敗しました" };
    }
  }

  revalidatePath("/settings/standard-tasks");
  revalidatePath("/projects");
  return { success: true };
}

// ============================================
// 項目操作
// ============================================

export async function createItem(
  templateId: string,
  title: string
): Promise<{ success?: boolean; error?: string; id?: string }> {
  const supabase = await createClient();

  // 最大sort_orderを取得
  const { data: existing } = await supabase
    .from("standard_task_items" as never)
    .select("sort_order")
    .eq("template_id", templateId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const maxSortOrder = (existing as { sort_order: number }[] | null)?.[0]?.sort_order || 0;

  const { data, error } = await supabase
    .from("standard_task_items" as never)
    .insert({
      template_id: templateId,
      title,
      sort_order: maxSortOrder + 1,
    } as never)
    .select("id")
    .single();

  if (error) {
    console.error("Error creating item:", error);
    return { error: "項目の作成に失敗しました" };
  }

  revalidatePath("/settings/standard-tasks");
  return { success: true, id: (data as { id: string }).id };
}

export async function updateItem(
  id: string,
  title: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("standard_task_items" as never)
    .update({ title } as never)
    .eq("id", id);

  if (error) {
    console.error("Error updating item:", error);
    return { error: "項目の更新に失敗しました" };
  }

  revalidatePath("/settings/standard-tasks");
  return { success: true };
}

export async function deleteItem(id: string): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("standard_task_items" as never)
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting item:", error);
    return { error: "項目の削除に失敗しました" };
  }

  revalidatePath("/settings/standard-tasks");
  return { success: true };
}

export async function reorderItems(
  items: { id: string; sort_order: number }[]
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  // 各項目のsort_orderを更新
  for (const item of items) {
    const { error } = await supabase
      .from("standard_task_items" as never)
      .update({ sort_order: item.sort_order } as never)
      .eq("id", item.id);

    if (error) {
      console.error("Error reordering items:", error);
      return { error: "項目の並び替えに失敗しました" };
    }
  }

  revalidatePath("/settings/standard-tasks");
  return { success: true };
}
