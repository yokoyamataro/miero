"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ProjectCategory, ProjectStatus, Contact, Account } from "@/types/database";

// カテゴリからプレフィックス文字を取得
const CATEGORY_PREFIX: Record<ProjectCategory, string> = {
  A_Survey: "A",
  B_Boundary: "B",
  C_Registration: "C",
  D_Inheritance: "D",
  E_Corporate: "E",
  F_Drone: "F",
  N_Farmland: "N",
};

// 次の業務コードを取得
export async function getNextProjectCode(category: ProjectCategory): Promise<string> {
  const supabase = await createClient();
  const prefix = CATEGORY_PREFIX[category];

  // 当該カテゴリの最大コードを取得
  const { data: projects, error } = await supabase
    .from("projects")
    .select("code")
    .like("code", `${prefix}%`)
    .order("code", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Error fetching max code:", error);
  }

  // 現在の年（西暦下2桁）
  const currentYear = new Date().getFullYear() % 100;

  if (!projects || projects.length === 0) {
    // 該当カテゴリに業務がない場合、年度の初番号（例: A250001）
    return `${prefix}${currentYear}0001`;
  }

  const maxCode = projects[0].code;
  // コードから数字部分を取得（例: A250013 -> 250013）
  const numPart = maxCode.slice(1);
  const numValue = parseInt(numPart, 10);

  // 次の番号
  const nextNum = numValue + 1;

  // 6桁でゼロパディング（例: A250014）
  return `${prefix}${String(nextNum).padStart(6, "0")}`;
}

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

// 新規法人を作成（簡易版）
export interface QuickAccountData {
  company_name: string;
  contact_last_name?: string;
  contact_first_name?: string;
}

export async function createQuickAccount(data: QuickAccountData): Promise<{
  success?: boolean;
  error?: string;
  account?: AccountWithContacts;
}> {
  const supabase = await createClient();

  // 法人を作成
  const { data: account, error: accountError } = await supabase
    .from("accounts" as never)
    .insert({
      company_name: data.company_name,
    } as never)
    .select()
    .single();

  if (accountError) {
    console.error("Error creating account:", accountError);
    return { error: accountError.message };
  }

  const typedAccount = account as Account;
  let contacts: CorporateContact[] = [];

  // 担当者名が入力されていれば作成
  if (data.contact_last_name && data.contact_first_name) {
    const { data: contact, error: contactError } = await supabase
      .from("contacts" as never)
      .insert({
        account_id: typedAccount.id,
        last_name: data.contact_last_name,
        first_name: data.contact_first_name,
        is_primary: true,
      } as never)
      .select()
      .single();

    if (contactError) {
      console.error("Error creating contact:", contactError);
    } else {
      const typedContact = contact as Contact;
      contacts = [{
        id: typedContact.id,
        name: `${typedContact.last_name} ${typedContact.first_name}`,
      }];
    }
  }

  revalidatePath("/projects");
  revalidatePath("/accounts");

  return {
    success: true,
    account: {
      id: typedAccount.id,
      companyName: typedAccount.company_name,
      contacts,
    },
  };
}

// 新規個人顧客を作成（簡易版）
export interface QuickIndividualData {
  last_name: string;
  first_name: string;
}

export async function createQuickIndividual(data: QuickIndividualData): Promise<{
  success?: boolean;
  error?: string;
  individual?: IndividualContact;
}> {
  const supabase = await createClient();

  const { data: contact, error } = await supabase
    .from("contacts" as never)
    .insert({
      account_id: null,
      last_name: data.last_name,
      first_name: data.first_name,
      is_primary: false,
    } as never)
    .select()
    .single();

  if (error) {
    console.error("Error creating individual contact:", error);
    return { error: error.message };
  }

  const typedContact = contact as Contact;

  revalidatePath("/projects");
  revalidatePath("/contacts");

  return {
    success: true,
    individual: {
      id: typedContact.id,
      name: `${typedContact.last_name} ${typedContact.first_name}`,
    },
  };
}
