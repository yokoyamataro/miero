"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Manual, ManualWithAuthor, Employee } from "@/types/database";

export interface ManualFormData {
  title: string;
  category: string | null;
  body: string;
  tags: string[];
  is_published: boolean;
}

export async function getManuals(options?: {
  category?: string;
  publishedOnly?: boolean;
  keyword?: string;
}): Promise<ManualWithAuthor[]> {
  const supabase = await createClient();

  let query = supabase
    .from("manuals")
    .select("*")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (options?.category) {
    query = query.eq("category", options.category);
  }
  if (options?.publishedOnly) {
    query = query.eq("is_published", true);
  }
  if (options?.keyword) {
    query = query.or(
      `title.ilike.%${options.keyword}%,body.ilike.%${options.keyword}%`
    );
  }

  const { data: manuals, error } = await query;

  if (error) {
    console.error("Error fetching manuals:", error);
    return [];
  }

  const manualList = (manuals || []) as Manual[];

  // 作成者情報をまとめて取得
  const authorIds = Array.from(
    new Set(manualList.map((m) => m.created_by).filter((v): v is string => !!v))
  );

  let authorMap = new Map<string, Employee>();
  if (authorIds.length > 0) {
    const { data: employees } = await supabase
      .from("employees")
      .select("*")
      .in("id", authorIds);
    for (const emp of (employees || []) as Employee[]) {
      authorMap.set(emp.id, emp);
    }
  }

  return manualList.map((m) => ({
    ...m,
    author: m.created_by ? authorMap.get(m.created_by) || null : null,
  }));
}

export async function getManualById(id: string): Promise<ManualWithAuthor | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("manuals")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error || !data) {
    console.error("Error fetching manual:", error);
    return null;
  }

  const manual = data as Manual;

  let author: Employee | null = null;
  if (manual.created_by) {
    const { data: emp } = await supabase
      .from("employees")
      .select("*")
      .eq("id", manual.created_by)
      .maybeSingle();
    author = (emp as Employee) || null;
  }

  return { ...manual, author };
}

export async function getManualCategories(): Promise<string[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("manuals")
    .select("category")
    .is("deleted_at", null)
    .not("category", "is", null);

  if (error) {
    console.error("Error fetching manual categories:", error);
    return [];
  }

  const categories = new Set<string>();
  for (const row of (data || []) as Array<{ category: string | null }>) {
    if (row.category) categories.add(row.category);
  }
  return Array.from(categories).sort();
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

export async function createManual(data: ManualFormData) {
  const supabase = await createClient();
  const createdBy = await getCurrentEmployeeId();

  const { data: inserted, error } = await supabase
    .from("manuals")
    .insert({
      title: data.title,
      category: data.category,
      body: data.body,
      tags: data.tags,
      is_published: data.is_published,
      created_by: createdBy,
    } as never)
    .select("id")
    .single();

  if (error) {
    console.error("Error creating manual:", error);
    return { error: error.message };
  }

  revalidatePath("/manuals");
  return { success: true, id: (inserted as { id: string }).id };
}

export async function updateManual(id: string, data: ManualFormData) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("manuals")
    .update({
      title: data.title,
      category: data.category,
      body: data.body,
      tags: data.tags,
      is_published: data.is_published,
    } as never)
    .eq("id", id);

  if (error) {
    console.error("Error updating manual:", error);
    return { error: error.message };
  }

  revalidatePath("/manuals");
  revalidatePath(`/manuals/${id}`);
  return { success: true };
}

export async function deleteManual(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("manuals")
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", id);

  if (error) {
    console.error("Error deleting manual:", error);
    return { error: error.message };
  }

  revalidatePath("/manuals");
  return { success: true };
}

const MANUAL_IMAGES_BUCKET = "manual-images";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

export async function uploadManualImage(
  formData: FormData
): Promise<{ url?: string; error?: string }> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "ファイルが指定されていません" };
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return { error: `ファイルサイズが大きすぎます（最大${MAX_IMAGE_BYTES / 1024 / 1024}MB）` };
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return { error: `画像形式が未対応です（${file.type}）` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "ログインが必要です" };
  }

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "png";
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const path = `${user.id}/${timestamp}-${random}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from(MANUAL_IMAGES_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadErr) {
    console.error("Error uploading manual image:", uploadErr);
    return { error: `アップロード失敗: ${uploadErr.message}` };
  }

  const { data } = supabase.storage.from(MANUAL_IMAGES_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}
