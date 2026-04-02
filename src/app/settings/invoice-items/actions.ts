"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ============================================
// カテゴリ（種別）操作
// ============================================

export async function createCategory(name: string) {
  const supabase = await createClient();

  // 最大sort_orderを取得
  const { data: maxOrder } = await supabase
    .from("invoice_item_categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const nextOrder = (maxOrder?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from("invoice_item_categories")
    .insert({ name, sort_order: nextOrder })
    .select("id")
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/settings/invoice-items");
  return { success: true, id: data.id };
}

export async function updateCategory(id: string, name: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("invoice_item_categories")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/settings/invoice-items");
  return { success: true };
}

export async function deleteCategory(id: string) {
  const supabase = await createClient();

  // 項目が存在するかチェック
  const { count } = await supabase
    .from("invoice_item_templates")
    .select("*", { count: "exact", head: true })
    .eq("category_id", id);

  if (count && count > 0) {
    return { success: false, error: "この種別には項目が存在します。先に項目を削除してください。" };
  }

  const { error } = await supabase
    .from("invoice_item_categories")
    .delete()
    .eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/settings/invoice-items");
  return { success: true };
}

export async function reorderCategories(items: { id: string; sort_order: number }[]) {
  const supabase = await createClient();

  for (const item of items) {
    await supabase
      .from("invoice_item_categories")
      .update({ sort_order: item.sort_order })
      .eq("id", item.id);
  }

  revalidatePath("/settings/invoice-items");
  return { success: true };
}

// ============================================
// テンプレート（項目）操作
// ============================================

export async function createTemplate(
  categoryId: string,
  data: {
    name: string;
    description?: string | null;
    default_note?: string | null;
    default_unit?: string | null;
    default_unit_price?: number | null;
  }
) {
  const supabase = await createClient();

  // 最大sort_orderを取得
  const { data: maxOrder } = await supabase
    .from("invoice_item_templates")
    .select("sort_order")
    .eq("category_id", categoryId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const nextOrder = (maxOrder?.sort_order ?? 0) + 1;

  const { data: inserted, error } = await supabase
    .from("invoice_item_templates")
    .insert({
      category_id: categoryId,
      name: data.name,
      description: data.description || null,
      default_note: data.default_note || null,
      default_unit: data.default_unit || null,
      default_unit_price: data.default_unit_price ?? null,
      sort_order: nextOrder,
    })
    .select("id")
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/settings/invoice-items");
  return { success: true, id: inserted.id };
}

export async function updateTemplate(
  id: string,
  data: {
    name: string;
    description?: string | null;
    default_note?: string | null;
    default_unit?: string | null;
    default_unit_price?: number | null;
  }
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("invoice_item_templates")
    .update({
      name: data.name,
      description: data.description || null,
      default_note: data.default_note || null,
      default_unit: data.default_unit || null,
      default_unit_price: data.default_unit_price ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/settings/invoice-items");
  return { success: true };
}

export async function deleteTemplate(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("invoice_item_templates")
    .delete()
    .eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/settings/invoice-items");
  return { success: true };
}

export async function reorderTemplates(items: { id: string; sort_order: number }[]) {
  const supabase = await createClient();

  for (const item of items) {
    await supabase
      .from("invoice_item_templates")
      .update({ sort_order: item.sort_order })
      .eq("id", item.id);
  }

  revalidatePath("/settings/invoice-items");
  return { success: true };
}
