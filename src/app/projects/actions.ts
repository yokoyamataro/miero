"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ProjectCategory, ProjectStatus, Contact, Account } from "@/types/database";

export interface CreateProjectData {
  code: string;
  category: ProjectCategory;
  name: string;
  status: ProjectStatus;
  contact_id: string | null;
  manager_id: string | null;
  start_date: string | null;
  end_date: string | null;
  fee_tax_excluded: number | null;
  location: string | null;
  details: Record<string, unknown>;
  monthly_allocations: Record<string, number>;
}

export async function createProject(data: CreateProjectData) {
  const supabase = await createClient();

  const { error } = await supabase.from("projects").insert({
    code: data.code,
    category: data.category,
    name: data.name,
    status: data.status,
    contact_id: data.contact_id || null,
    manager_id: data.manager_id || null,
    start_date: data.start_date || null,
    end_date: data.end_date || null,
    fee_tax_excluded: data.fee_tax_excluded || 0,
    location: data.location || null,
    details: data.details,
    monthly_allocations: data.monthly_allocations,
  });

  if (error) {
    console.error("Error creating project:", error);
    return { error: error.message };
  }

  revalidatePath("/projects");
  redirect("/projects");
}

// 個人顧客
export interface IndividualContact {
  id: string;
  name: string;
}

// 法人の担当者
export interface CorporateContact {
  id: string;
  name: string;
}

// 法人（担当者リスト付き）
export interface AccountWithContacts {
  id: string;
  companyName: string;
  contacts: CorporateContact[];
}

// 顧客データ全体
export interface CustomerData {
  accounts: AccountWithContacts[];
  individuals: IndividualContact[];
}

export async function getCustomerData(): Promise<CustomerData> {
  const supabase = await createClient();

  // 全ての連絡先を取得
  const { data: contacts, error: contactsError } = await supabase
    .from("contacts" as never)
    .select("*")
    .is("deleted_at", null)
    .order("last_name");

  if (contactsError) {
    console.error("Error fetching contacts:", contactsError);
    return { accounts: [], individuals: [] };
  }

  // 法人情報を取得
  const { data: accounts, error: accountsError } = await supabase
    .from("accounts" as never)
    .select("*")
    .is("deleted_at", null)
    .order("company_name");

  if (accountsError) {
    console.error("Error fetching accounts:", accountsError);
  }

  const typedContacts = (contacts as Contact[]) || [];
  const typedAccounts = (accounts as Account[]) || [];

  // 法人ごとに担当者をグループ化
  const contactsByAccountId = typedContacts
    .filter((c) => c.account_id)
    .reduce((acc, contact) => {
      const accountId = contact.account_id!;
      if (!acc[accountId]) acc[accountId] = [];
      acc[accountId].push({
        id: contact.id,
        name: `${contact.last_name} ${contact.first_name}`,
      });
      return acc;
    }, {} as Record<string, CorporateContact[]>);

  // 法人リスト（担当者付き）
  const accountsWithContacts: AccountWithContacts[] = typedAccounts.map((account) => ({
    id: account.id,
    companyName: account.company_name,
    contacts: contactsByAccountId[account.id] || [],
  }));

  // 個人顧客（法人に紐づいていない連絡先）
  const individuals: IndividualContact[] = typedContacts
    .filter((c) => !c.account_id)
    .map((contact) => ({
      id: contact.id,
      name: `${contact.last_name} ${contact.first_name}`,
    }));

  return {
    accounts: accountsWithContacts,
    individuals,
  };
}

// 後方互換性のため残す（新規作成フォーム用）
export interface ContactOption {
  id: string;
  name: string;
  type: "individual" | "corporate";
  company_name?: string;
  account_id?: string;
}

export async function getContacts(): Promise<ContactOption[]> {
  const supabase = await createClient();

  // 全ての連絡先を取得
  const { data: contacts, error: contactsError } = await supabase
    .from("contacts" as never)
    .select("*")
    .is("deleted_at", null)
    .order("last_name");

  if (contactsError) {
    console.error("Error fetching contacts:", contactsError);
    return [];
  }

  // 法人情報を取得
  const { data: accounts, error: accountsError } = await supabase
    .from("accounts" as never)
    .select("*")
    .is("deleted_at", null);

  if (accountsError) {
    console.error("Error fetching accounts:", accountsError);
  }

  const accountMap = ((accounts as Account[]) || []).reduce((acc, account) => {
    acc[account.id] = account;
    return acc;
  }, {} as Record<string, Account>);

  return ((contacts as Contact[]) || []).map((contact) => {
    const account = contact.account_id ? accountMap[contact.account_id] : null;
    return {
      id: contact.id,
      name: `${contact.last_name} ${contact.first_name}`,
      type: contact.account_id ? "corporate" : "individual",
      company_name: account?.company_name,
      account_id: contact.account_id || undefined,
    } as ContactOption;
  });
}

export async function getEmployees() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select("id, name")
    .order("name");

  if (error) {
    console.error("Error fetching employees:", error);
    return [];
  }

  return data;
}
