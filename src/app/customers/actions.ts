"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Customer, CustomerInsert, CustomerType } from "@/types/database";

// =============================================
// 共通フォームデータ型
// =============================================

export interface CustomerFormData {
  type: CustomerType;

  // 共通
  display_name: string;
  display_name_kana: string | null;
  phone: string | null;
  email: string | null;
  postal_code: string | null;
  prefecture: string | null;
  city: string | null;
  street: string | null;
  building: string | null;
  notes: string | null;

  // 法人固有
  corporate_number: string | null;
  industry: string | null;
  fax: string | null;
  contact_last_name: string | null;
  contact_first_name: string | null;
  contact_last_name_kana: string | null;
  contact_first_name_kana: string | null;
  contact_department: string | null;
  contact_position: string | null;
  contact_phone: string | null;
  contact_email: string | null;

  // 個人固有
  last_name: string | null;
  first_name: string | null;
  last_name_kana: string | null;
  first_name_kana: string | null;
  birth_date: string | null;
}

// =============================================
// 一覧取得
// =============================================

export async function getCustomers(options?: {
  type?: CustomerType;
  keyword?: string;
}): Promise<Customer[]> {
  const supabase = await createClient();

  let query = supabase
    .from("customers")
    .select("*")
    .is("deleted_at", null)
    .order("display_name_kana", { ascending: true });

  if (options?.type) {
    query = query.eq("type", options.type);
  }
  if (options?.keyword) {
    const kw = options.keyword;
    query = query.or(
      `display_name.ilike.%${kw}%,display_name_kana.ilike.%${kw}%,phone.ilike.%${kw}%,email.ilike.%${kw}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching customers:", error);
    return [];
  }

  return (data || []) as Customer[];
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("Error fetching customer:", error);
    return null;
  }
  return (data as Customer) || null;
}

// =============================================
// 作成
// =============================================

export async function createCustomer(data: CustomerFormData) {
  const supabase = await createClient();

  const payload = normalizeFormDataToInsert(data);

  const { data: inserted, error } = await supabase
    .from("customers")
    .insert(payload as never)
    .select("id")
    .single();

  if (error) {
    console.error("Error creating customer:", error);
    return { error: error.message };
  }

  revalidatePath("/customers");
  return { success: true, id: (inserted as { id: string }).id };
}

// =============================================
// 更新
// =============================================

export async function updateCustomer(id: string, data: CustomerFormData) {
  const supabase = await createClient();

  const payload = normalizeFormDataToInsert(data);

  const { error } = await supabase
    .from("customers")
    .update(payload as never)
    .eq("id", id);

  if (error) {
    console.error("Error updating customer:", error);
    return { error: error.message };
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return { success: true };
}

// =============================================
// 削除（論理削除）
// =============================================

export async function deleteCustomer(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("customers")
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", id);

  if (error) {
    console.error("Error deleting customer:", error);
    return { error: error.message };
  }

  revalidatePath("/customers");
  return { success: true };
}

// =============================================
// 内部: FormData → Insert 型 (type に合わせて不要カラムを null に)
// =============================================

function normalizeFormDataToInsert(data: CustomerFormData): CustomerInsert {
  const base: CustomerInsert = {
    type: data.type,
    display_name: data.display_name.trim(),
    display_name_kana: data.display_name_kana || null,
    phone: data.phone || null,
    email: data.email || null,
    postal_code: data.postal_code || null,
    prefecture: data.prefecture || null,
    city: data.city || null,
    street: data.street || null,
    building: data.building || null,
    notes: data.notes || null,
  };

  if (data.type === "corporate") {
    return {
      ...base,
      corporate_number: data.corporate_number || null,
      industry: data.industry || null,
      fax: data.fax || null,
      contact_last_name: data.contact_last_name || null,
      contact_first_name: data.contact_first_name || null,
      contact_last_name_kana: data.contact_last_name_kana || null,
      contact_first_name_kana: data.contact_first_name_kana || null,
      contact_department: data.contact_department || null,
      contact_position: data.contact_position || null,
      contact_phone: data.contact_phone || null,
      contact_email: data.contact_email || null,
      // 個人固有は null
      last_name: null,
      first_name: null,
      last_name_kana: null,
      first_name_kana: null,
      birth_date: null,
    };
  }

  // individual
  return {
    ...base,
    last_name: data.last_name || null,
    first_name: data.first_name || null,
    last_name_kana: data.last_name_kana || null,
    first_name_kana: data.first_name_kana || null,
    birth_date: data.birth_date || null,
    // 法人固有は null
    corporate_number: null,
    industry: null,
    fax: null,
    contact_last_name: null,
    contact_first_name: null,
    contact_last_name_kana: null,
    contact_first_name_kana: null,
    contact_department: null,
    contact_position: null,
    contact_phone: null,
    contact_email: null,
  };
}
