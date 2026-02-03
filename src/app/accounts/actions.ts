"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { AccountInsert, ContactInsert, AccountWithContacts, Industry, IndustryInsert, Branch } from "@/types/database";
import { DEFAULT_INDUSTRIES } from "@/types/database";

export interface AccountFormData {
  company_name: string;
  company_name_kana: string | null;
  corporate_number: string | null;
  main_phone: string | null;
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
  postal_code: string | null;
  prefecture: string | null;
  city: string | null;
  street: string | null;
  building: string | null;
}

export async function getAccountById(id: string): Promise<AccountWithContacts | null> {
  const supabase = await createClient();

  const { data: account, error: accountError } = await supabase
    .from("accounts" as never)
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (accountError) {
    console.error("Error fetching account:", accountError);
    return null;
  }

  const { data: contacts, error: contactsError } = await supabase
    .from("contacts" as never)
    .select("*")
    .eq("account_id", id)
    .is("deleted_at", null)
    .order("is_primary", { ascending: false })
    .order("last_name");

  if (contactsError) {
    console.error("Error fetching contacts:", contactsError);
  }

  const { data: branches, error: branchesError } = await supabase
    .from("branches" as never)
    .select("*")
    .eq("account_id", id)
    .is("deleted_at", null)
    .order("name");

  if (branchesError) {
    console.error("Error fetching branches:", branchesError);
  }

  return {
    ...(account as AccountWithContacts),
    contacts: (contacts || []) as AccountWithContacts["contacts"],
    branches: (branches || []) as Branch[],
  };
}

export async function createAccount(
  data: AccountFormData,
  contacts: ContactFormData[],
  branches: BranchFormData[]
) {
  const supabase = await createClient();

  const accountInsert: AccountInsert = {
    company_name: data.company_name,
    company_name_kana: data.company_name_kana || null,
    corporate_number: data.corporate_number || null,
    main_phone: data.main_phone || null,
    postal_code: data.postal_code || null,
    prefecture: data.prefecture || null,
    city: data.city || null,
    street: data.street || null,
    building: data.building || null,
    industry: data.industry || null,
    notes: data.notes || null,
  };

  const { data: account, error: accountError } = await supabase
    .from("accounts" as never)
    .insert(accountInsert as never)
    .select()
    .single();

  if (accountError) {
    console.error("Error creating account:", accountError);
    return { error: accountError.message };
  }

  const accountId = (account as { id: string }).id;

  // 支店を作成し、IDのマッピングを保持
  const branchIdMap: Record<string, string> = {};
  if (branches.length > 0) {
    for (const branch of branches) {
      const { data: newBranch, error: branchError } = await supabase
        .from("branches" as never)
        .insert({
          account_id: accountId,
          name: branch.name,
          phone: branch.phone || null,
          postal_code: branch.postal_code || null,
          prefecture: branch.prefecture || null,
          city: branch.city || null,
          street: branch.street || null,
          building: branch.building || null,
        } as never)
        .select()
        .single();

      if (branchError) {
        console.error("Error creating branch:", branchError);
        return { error: branchError.message };
      }

      // 一時IDから実際のIDへのマッピング
      if (branch.id && newBranch) {
        branchIdMap[branch.id] = (newBranch as { id: string }).id;
      }
    }
  }

  if (contacts.length > 0) {
    const contactsToInsert = contacts.map((c) => ({
      account_id: accountId,
      branch_id: c.branch_id ? branchIdMap[c.branch_id] || null : null,
      last_name: c.last_name,
      first_name: c.first_name,
      last_name_kana: c.last_name_kana || null,
      first_name_kana: c.first_name_kana || null,
      phone: c.phone || null,
      email: c.email || null,
      department: c.department || null,
      position: c.position || null,
      is_primary: c.is_primary,
    }));

    const { error: contactsError } = await supabase
      .from("contacts" as never)
      .insert(contactsToInsert as never);

    if (contactsError) {
      console.error("Error creating contacts:", contactsError);
      return { error: contactsError.message };
    }
  }

  revalidatePath("/accounts");
  return { success: true };
}

export async function updateAccount(
  id: string,
  data: AccountFormData,
  contacts: ContactFormData[],
  branches: BranchFormData[]
) {
  const supabase = await createClient();

  const { error: accountError } = await supabase
    .from("accounts" as never)
    .update({
      company_name: data.company_name,
      company_name_kana: data.company_name_kana || null,
      corporate_number: data.corporate_number || null,
      main_phone: data.main_phone || null,
      postal_code: data.postal_code || null,
      prefecture: data.prefecture || null,
      city: data.city || null,
      street: data.street || null,
      building: data.building || null,
      industry: data.industry || null,
      notes: data.notes || null,
    } as never)
    .eq("id", id);

  if (accountError) {
    console.error("Error updating account:", accountError);
    return { error: accountError.message };
  }

  // 既存の支店を論理削除
  const { error: deleteBranchesError } = await supabase
    .from("branches" as never)
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("account_id", id)
    .is("deleted_at", null);

  if (deleteBranchesError) {
    console.error("Error soft-deleting branches:", deleteBranchesError);
    return { error: deleteBranchesError.message };
  }

  // 新しい支店を作成し、IDのマッピングを保持
  const branchIdMap: Record<string, string> = {};
  if (branches.length > 0) {
    for (const branch of branches) {
      const { data: newBranch, error: branchError } = await supabase
        .from("branches" as never)
        .insert({
          account_id: id,
          name: branch.name,
          phone: branch.phone || null,
          postal_code: branch.postal_code || null,
          prefecture: branch.prefecture || null,
          city: branch.city || null,
          street: branch.street || null,
          building: branch.building || null,
        } as never)
        .select()
        .single();

      if (branchError) {
        console.error("Error creating branch:", branchError);
        return { error: branchError.message };
      }

      // 一時IDから実際のIDへのマッピング
      if (branch.id && newBranch) {
        branchIdMap[branch.id] = (newBranch as { id: string }).id;
      }
    }
  }

  // 既存の連絡先を論理削除
  const { error: deleteError } = await supabase
    .from("contacts" as never)
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("account_id", id)
    .is("deleted_at", null);

  if (deleteError) {
    console.error("Error soft-deleting contacts:", deleteError);
    return { error: deleteError.message };
  }

  // 新しい連絡先を作成
  if (contacts.length > 0) {
    const contactsToInsert = contacts.map((c) => ({
      account_id: id,
      branch_id: c.branch_id ? branchIdMap[c.branch_id] || null : null,
      last_name: c.last_name,
      first_name: c.first_name,
      last_name_kana: c.last_name_kana || null,
      first_name_kana: c.first_name_kana || null,
      phone: c.phone || null,
      email: c.email || null,
      department: c.department || null,
      position: c.position || null,
      is_primary: c.is_primary,
    }));

    const { error: contactsError } = await supabase
      .from("contacts" as never)
      .insert(contactsToInsert as never);

    if (contactsError) {
      console.error("Error creating contacts:", contactsError);
      return { error: contactsError.message };
    }
  }

  revalidatePath("/accounts");
  return { success: true };
}

export async function deleteAccount(id: string) {
  const supabase = await createClient();

  // 論理削除
  const { error } = await supabase
    .from("accounts" as never)
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", id);

  if (error) {
    console.error("Error deleting account:", error);
    return { error: error.message };
  }

  // 関連する支店も論理削除
  await supabase
    .from("branches" as never)
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("account_id", id);

  // 関連する連絡先も論理削除
  await supabase
    .from("contacts" as never)
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("account_id", id);

  revalidatePath("/accounts");
  return { success: true };
}

// ============================================
// 業種マスタ
// ============================================

// 業種一覧を取得
export async function getIndustries(): Promise<Industry[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("industries")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Error fetching industries:", error);
    // テーブルがない場合はデフォルト値を返す
    return DEFAULT_INDUSTRIES.map((name, index) => ({
      id: `default-${index}`,
      name,
      sort_order: index,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
  }

  // データがない場合はデフォルト値を返す
  if (!data || data.length === 0) {
    return DEFAULT_INDUSTRIES.map((name, index) => ({
      id: `default-${index}`,
      name,
      sort_order: index,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
  }

  return data as Industry[];
}

// 業種を追加
export async function createIndustry(name: string): Promise<{
  success?: boolean;
  error?: string;
  industry?: Industry;
}> {
  const supabase = await createClient();

  // 最大のsort_orderを取得
  const { data: maxOrder } = await supabase
    .from("industries")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const newSortOrder = (maxOrder?.sort_order ?? DEFAULT_INDUSTRIES.length - 1) + 1;

  const { data, error } = await supabase
    .from("industries")
    .insert({
      name,
      sort_order: newSortOrder,
    } as never)
    .select()
    .single();

  if (error) {
    console.error("Error creating industry:", error);
    if (error.code === "23505") {
      return { error: "同じ名前の業種が既に存在します" };
    }
    return { error: "業種の追加に失敗しました" };
  }

  revalidatePath("/accounts");
  return { success: true, industry: data as Industry };
}

// デフォルト業種を初期化（テーブルが空の場合）
export async function initializeDefaultIndustries(): Promise<void> {
  const supabase = await createClient();

  // 既存データを確認
  const { data: existing } = await supabase
    .from("industries")
    .select("id")
    .limit(1);

  if (existing && existing.length > 0) {
    return; // 既にデータがある
  }

  // デフォルト業種を挿入
  const industriesToInsert = DEFAULT_INDUSTRIES.map((name, index) => ({
    name,
    sort_order: index,
  }));

  await supabase
    .from("industries")
    .insert(industriesToInsert as never);
}
