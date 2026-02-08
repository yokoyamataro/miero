"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { AccountInsert, ContactInsert, AccountWithContacts, Industry, IndustryInsert, Branch, Project } from "@/types/database";
import { DEFAULT_INDUSTRIES } from "@/types/database";

// 関連業務の型
export interface RelatedProject {
  id: string;
  code: string;
  name: string;
  status: string;
  category: string | null;
  start_date: string | null;
  end_date: string | null;
  relationship: "顧客" | "関係者";
  stakeholder_tag?: string;
}

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
    fax: data.fax || null,
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
          fax: branch.fax || null,
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
      fax: data.fax || null,
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
          fax: branch.fax || null,
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

  // 既存の連絡先を取得
  const { data: existingContacts } = await supabase
    .from("contacts" as never)
    .select("id")
    .eq("account_id", id)
    .is("deleted_at", null);

  type ExistingContact = { id: string };
  const existingContactList = (existingContacts || []) as ExistingContact[];

  // 既存連絡先ID
  const existingContactIds = new Set(existingContactList.map((c) => c.id));
  const newContactIds = new Set(contacts.filter((c) => c.id).map((c) => c.id));

  // 削除された連絡先を論理削除（既存にあって新しいリストにないもの）
  const contactsToDelete = Array.from(existingContactIds).filter((cid) => !newContactIds.has(cid));
  if (contactsToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("contacts" as never)
      .update({ deleted_at: new Date().toISOString() } as never)
      .in("id", contactsToDelete);

    if (deleteError) {
      console.error("Error soft-deleting contacts:", deleteError);
      return { error: deleteError.message };
    }
  }

  // 連絡先を更新または作成
  for (const c of contacts) {
    const contactData = {
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
    };

    if (c.id && existingContactIds.has(c.id)) {
      // 既存の連絡先を更新
      const { error: updateError } = await supabase
        .from("contacts" as never)
        .update(contactData as never)
        .eq("id", c.id);

      if (updateError) {
        console.error("Error updating contact:", updateError);
        return { error: updateError.message };
      }
    } else {
      // 新しい連絡先を作成
      const { error: insertError } = await supabase
        .from("contacts" as never)
        .insert(contactData as never);

      if (insertError) {
        console.error("Error creating contact:", insertError);
        return { error: insertError.message };
      }
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

// ============================================
// 関連業務取得
// ============================================

// 法人に関連する業務を取得（顧客として、または関係者として）
export async function getRelatedProjectsForAccount(accountId: string): Promise<RelatedProject[]> {
  const supabase = await createClient();

  // 1. この法人に属する連絡先IDを取得
  const { data: contacts, error: contactsError } = await supabase
    .from("contacts" as never)
    .select("id")
    .eq("account_id", accountId)
    .is("deleted_at", null);

  if (contactsError) {
    console.error("Error fetching contacts for account:", contactsError);
    return [];
  }

  const contactIds = (contacts || []).map((c: { id: string }) => c.id);

  if (contactIds.length === 0) {
    return [];
  }

  const relatedProjects: RelatedProject[] = [];

  // 2. 顧客として紐づいている業務を取得
  const { data: customerProjects, error: customerError } = await supabase
    .from("projects" as never)
    .select("id, code, name, status, category, start_date, end_date")
    .in("contact_id", contactIds);

  if (customerError) {
    console.error("Error fetching customer projects:", customerError);
  } else if (customerProjects) {
    for (const p of customerProjects as Project[]) {
      relatedProjects.push({
        id: p.id,
        code: p.code,
        name: p.name,
        status: p.status,
        category: p.category,
        start_date: p.start_date,
        end_date: p.end_date,
        relationship: "顧客",
      });
    }
  }

  // 3. 関係者として紐づいている業務を取得
  const { data: stakeholderData, error: stakeholderError } = await supabase
    .from("project_stakeholders" as never)
    .select(`
      project_id,
      tag:stakeholder_tags(name),
      project:projects(id, code, name, status, category, start_date, end_date)
    `)
    .in("contact_id", contactIds);

  if (stakeholderError) {
    console.error("Error fetching stakeholder projects:", stakeholderError);
  } else if (stakeholderData) {
    for (const s of stakeholderData as Array<{
      project_id: string;
      tag: { name: string } | null;
      project: Project | null;
    }>) {
      if (s.project) {
        // 既に顧客として追加されていないかチェック
        const existing = relatedProjects.find((rp) => rp.id === s.project!.id);
        if (!existing) {
          relatedProjects.push({
            id: s.project.id,
            code: s.project.code,
            name: s.project.name,
            status: s.project.status,
            category: s.project.category,
            start_date: s.project.start_date,
            end_date: s.project.end_date,
            relationship: "関係者",
            stakeholder_tag: s.tag?.name,
          });
        }
      }
    }
  }

  // start_dateの降順でソート
  relatedProjects.sort((a, b) => {
    if (!a.start_date && !b.start_date) return 0;
    if (!a.start_date) return 1;
    if (!b.start_date) return -1;
    return b.start_date.localeCompare(a.start_date);
  });

  return relatedProjects;
}

// ============================================
// 法人から個人への移行
// ============================================

export interface ConvertToIndividualData {
  accountId: string;
  lastName: string;
  firstName: string;
  lastNameKana: string | null;
  firstNameKana: string | null;
}

export async function convertAccountToIndividual(
  data: ConvertToIndividualData
): Promise<{ success?: boolean; error?: string; contactId?: string }> {
  const supabase = await createClient();

  // 1. 法人情報を取得
  const { data: account, error: accountError } = await supabase
    .from("accounts" as never)
    .select("*")
    .eq("id", data.accountId)
    .is("deleted_at", null)
    .single();

  if (accountError || !account) {
    return { error: "法人が見つかりません" };
  }

  const acct = account as {
    id: string;
    postal_code: string | null;
    prefecture: string | null;
    city: string | null;
    street: string | null;
    building: string | null;
    main_phone: string | null;
    notes: string | null;
  };

  // 2. 個人顧客（contact）を作成（account_id = null）
  const { data: newContact, error: contactError } = await supabase
    .from("contacts" as never)
    .insert({
      account_id: null,
      branch_id: null,
      last_name: data.lastName,
      first_name: data.firstName,
      last_name_kana: data.lastNameKana || null,
      first_name_kana: data.firstNameKana || null,
      phone: acct.main_phone || null,
      postal_code: acct.postal_code || null,
      prefecture: acct.prefecture || null,
      city: acct.city || null,
      street: acct.street || null,
      building: acct.building || null,
      notes: acct.notes || null,
      is_primary: false,
    } as never)
    .select()
    .single();

  if (contactError || !newContact) {
    console.error("Error creating individual contact:", contactError);
    return { error: "個人の作成に失敗しました" };
  }

  const newContactId = (newContact as { id: string }).id;

  // 3. 法人に紐づく既存の連絡先を取得
  const { data: existingContacts } = await supabase
    .from("contacts" as never)
    .select("id")
    .eq("account_id", data.accountId)
    .is("deleted_at", null);

  const existingContactIds = (existingContacts || []).map((c: { id: string }) => c.id);

  // 4. 業務の顧客を新しい個人に付け替え
  if (existingContactIds.length > 0) {
    const { error: projectError } = await supabase
      .from("projects" as never)
      .update({ contact_id: newContactId } as never)
      .in("contact_id", existingContactIds);

    if (projectError) {
      console.error("Error updating projects:", projectError);
      return { error: "業務の移行に失敗しました" };
    }

    // 5. 関係者も新しい個人に付け替え
    const { error: stakeholderError } = await supabase
      .from("project_stakeholders" as never)
      .update({ contact_id: newContactId } as never)
      .in("contact_id", existingContactIds);

    if (stakeholderError) {
      console.error("Error updating stakeholders:", stakeholderError);
      return { error: "関係者の移行に失敗しました" };
    }
  }

  // 6. 法人と関連データを論理削除
  await supabase
    .from("contacts" as never)
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("account_id", data.accountId);

  await supabase
    .from("branches" as never)
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("account_id", data.accountId);

  await supabase
    .from("accounts" as never)
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", data.accountId);

  revalidatePath("/customers");
  return { success: true, contactId: newContactId };
}

// ============================================
// 法人の統合
// ============================================

export interface MergeAccountsData {
  sourceAccountId: string; // 統合元（削除される法人）
  targetAccountId: string; // 統合先（残る法人）
}

export async function mergeAccounts(
  data: MergeAccountsData
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  // 1. 両方の法人が存在するか確認
  const { data: sourceAccount } = await supabase
    .from("accounts" as never)
    .select("id")
    .eq("id", data.sourceAccountId)
    .is("deleted_at", null)
    .single();

  const { data: targetAccount } = await supabase
    .from("accounts" as never)
    .select("id")
    .eq("id", data.targetAccountId)
    .is("deleted_at", null)
    .single();

  if (!sourceAccount || !targetAccount) {
    return { error: "法人が見つかりません" };
  }

  // 2. 統合元の連絡先を統合先に移動
  const { error: contactsError } = await supabase
    .from("contacts" as never)
    .update({
      account_id: data.targetAccountId,
      branch_id: null, // 支店は統合先に存在しないのでnullに
    } as never)
    .eq("account_id", data.sourceAccountId)
    .is("deleted_at", null);

  if (contactsError) {
    console.error("Error moving contacts:", contactsError);
    return { error: "連絡先の移動に失敗しました" };
  }

  // 3. 統合元の支店を論理削除（連絡先は既に移動済み）
  await supabase
    .from("branches" as never)
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("account_id", data.sourceAccountId);

  // 4. 統合元の法人を論理削除
  const { error: deleteError } = await supabase
    .from("accounts" as never)
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", data.sourceAccountId);

  if (deleteError) {
    console.error("Error deleting source account:", deleteError);
    return { error: "統合元の削除に失敗しました" };
  }

  revalidatePath("/customers");
  return { success: true };
}
