"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type {
  SkillCategory,
  SkillCategoryWithItems,
  SkillItem,
  EmployeeSkill,
  SkillLevel,
  Employee,
} from "@/types/database";

// =============================================
// マスタ: カテゴリ
// =============================================

export async function getSkillCategoriesWithItems(): Promise<SkillCategoryWithItems[]> {
  const supabase = await createClient();

  const { data: categories, error: catErr } = await supabase
    .from("skill_categories")
    .select("*")
    .order("sort_order", { ascending: true });

  if (catErr) {
    console.error("Error fetching skill categories:", catErr);
    return [];
  }

  const catList = (categories || []) as SkillCategory[];
  if (catList.length === 0) return [];

  const { data: items, error: itemErr } = await supabase
    .from("skill_items")
    .select("*")
    .in(
      "category_id",
      catList.map((c) => c.id)
    )
    .order("sort_order", { ascending: true });

  if (itemErr) {
    console.error("Error fetching skill items:", itemErr);
  }

  const itemList = (items || []) as SkillItem[];

  return catList.map((c) => ({
    ...c,
    items: itemList.filter((it) => it.category_id === c.id),
  }));
}

export async function createSkillCategory(name: string, description?: string) {
  const supabase = await createClient();

  const { data: maxOrder } = await supabase
    .from("skill_categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = ((maxOrder as { sort_order: number } | null)?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("skill_categories")
    .insert({
      name,
      description: description || null,
      sort_order: nextOrder,
    } as never)
    .select("id")
    .single();

  if (error) {
    console.error("Error creating skill category:", error);
    return { error: error.message };
  }

  revalidatePath("/skills");
  revalidatePath("/skills/settings");
  return { success: true, id: (data as { id: string }).id };
}

export async function updateSkillCategory(
  id: string,
  name: string,
  description?: string
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("skill_categories")
    .update({ name, description: description || null } as never)
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/skills");
  revalidatePath("/skills/settings");
  return { success: true };
}

export async function deleteSkillCategory(id: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("skill_categories").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/skills");
  revalidatePath("/skills/settings");
  return { success: true };
}

// =============================================
// マスタ: 項目
// =============================================

export async function createSkillItem(
  categoryId: string,
  name: string,
  description?: string
) {
  const supabase = await createClient();

  const { data: maxOrder } = await supabase
    .from("skill_items")
    .select("sort_order")
    .eq("category_id", categoryId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = ((maxOrder as { sort_order: number } | null)?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("skill_items")
    .insert({
      category_id: categoryId,
      name,
      description: description || null,
      sort_order: nextOrder,
    } as never)
    .select("id")
    .single();

  if (error) {
    console.error("Error creating skill item:", error);
    return { error: error.message };
  }

  revalidatePath("/skills");
  revalidatePath("/skills/settings");
  return { success: true, id: (data as { id: string }).id };
}

export async function updateSkillItem(
  id: string,
  name: string,
  description?: string
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("skill_items")
    .update({ name, description: description || null } as never)
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/skills");
  revalidatePath("/skills/settings");
  return { success: true };
}

export async function deleteSkillItem(id: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("skill_items").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/skills");
  revalidatePath("/skills/settings");
  return { success: true };
}

// =============================================
// 評価: 社員×スキル項目
// =============================================

export async function getAllEmployeeSkills(): Promise<EmployeeSkill[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.from("employee_skills").select("*");

  if (error) {
    console.error("Error fetching employee skills:", error);
    return [];
  }

  return (data || []) as EmployeeSkill[];
}

export async function getEmployees(): Promise<Employee[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .order("name");

  if (error) {
    console.error("Error fetching employees:", error);
    return [];
  }

  return (data || []) as Employee[];
}

async function getCurrentEmployeeId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();

  return (employee as { id: string } | null)?.id ?? null;
}

export async function setEmployeeSkillLevel(
  employeeId: string,
  skillItemId: string,
  level: SkillLevel,
  note?: string | null
) {
  const supabase = await createClient();
  const updatedBy = await getCurrentEmployeeId();

  const { error } = await supabase
    .from("employee_skills")
    .upsert(
      {
        employee_id: employeeId,
        skill_item_id: skillItemId,
        level,
        note: note ?? null,
        updated_by: updatedBy,
      } as never,
      { onConflict: "employee_id,skill_item_id" }
    );

  if (error) {
    console.error("Error setting employee skill:", error);
    return { error: error.message };
  }

  revalidatePath("/skills");
  return { success: true };
}
