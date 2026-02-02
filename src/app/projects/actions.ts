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

// ============================================
// CSVエクスポート・インポート
// ============================================

// CSVエクスポート用のデータ取得
export async function getProjectsForExport(): Promise<{
  success: boolean;
  data?: string;
  error?: string;
}> {
  const supabase = await createClient();

  // 業務データを取得
  const { data: projects, error } = await supabase
    .from("projects")
    .select("*")
    .order("code", { ascending: true });

  if (error) {
    console.error("Error fetching projects for export:", error);
    return { success: false, error: error.message };
  }

  // 連絡先を取得
  const { data: contacts } = await supabase
    .from("contacts" as never)
    .select("*")
    .is("deleted_at", null);

  // 法人を取得
  const { data: accountsData } = await supabase
    .from("accounts" as never)
    .select("*")
    .is("deleted_at", null);

  // 担当者を取得
  const { data: employeesData } = await supabase
    .from("employees")
    .select("id, name");

  type ContactType = { id: string; last_name: string; first_name: string; account_id: string | null };
  type AccountType = { id: string; company_name: string };
  type EmployeeType = { id: string; name: string };

  const contactMap = ((contacts as ContactType[]) || []).reduce((acc, c) => {
    acc[c.id] = c;
    return acc;
  }, {} as Record<string, ContactType>);

  const accountMap = ((accountsData as AccountType[]) || []).reduce((acc, a) => {
    acc[a.id] = a;
    return acc;
  }, {} as Record<string, AccountType>);

  const employeeMap = ((employeesData as EmployeeType[]) || []).reduce((acc, e) => {
    acc[e.id] = e;
    return acc;
  }, {} as Record<string, EmployeeType>);

  // ヘルパー関数
  const getContactName = (contactId: string | null) => {
    if (!contactId) return "";
    const contact = contactMap[contactId];
    if (!contact) return "";
    return `${contact.last_name} ${contact.first_name}`;
  };

  const getCompanyName = (contactId: string | null) => {
    if (!contactId) return "";
    const contact = contactMap[contactId];
    if (!contact || !contact.account_id) return "";
    const account = accountMap[contact.account_id];
    return account?.company_name || "";
  };

  const getEmployeeName = (employeeId: string | null) => {
    if (!employeeId) return "";
    return employeeMap[employeeId]?.name || "";
  };

  // CSVヘッダー
  const headers = [
    "業務コード",
    "カテゴリ",
    "業務名",
    "ステータス",
    "法人名",
    "顧客名",
    "担当者",
    "着手日",
    "完了予定日",
    "税抜報酬額",
    "エリア",
  ];

  // CSVデータ行
  const rows = (projects || []).map((project) => {
    return [
      project.code || "",
      project.category || "",
      project.name || "",
      project.status || "",
      getCompanyName(project.contact_id),
      getContactName(project.contact_id),
      getEmployeeName(project.manager_id),
      project.start_date || "",
      project.end_date || "",
      project.fee_tax_excluded?.toString() || "",
      project.location || "",
    ];
  });

  // CSV文字列を生成
  const escapeCSV = (value: string) => {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const csvContent = [
    headers.map(escapeCSV).join(","),
    ...rows.map((row) => row.map(escapeCSV).join(",")),
  ].join("\n");

  return { success: true, data: csvContent };
}

// カテゴリ名からカテゴリコードへの変換マップ
const CATEGORY_NAME_TO_CODE: Record<string, ProjectCategory> = {
  "A_Survey": "A_Survey",
  "B_Boundary": "B_Boundary",
  "C_Registration": "C_Registration",
  "D_Inheritance": "D_Inheritance",
  "E_Corporate": "E_Corporate",
  "F_Drone": "F_Drone",
  "N_Farmland": "N_Farmland",
};

// ステータスの有効値
const VALID_STATUSES: ProjectStatus[] = ["受注", "着手", "進行中", "完了", "請求済"];

// CSVインポート
export async function importProjectsFromCSV(csvContent: string): Promise<{
  success: boolean;
  imported: number;
  errors: string[];
}> {
  const supabase = await createClient();
  const errors: string[] = [];
  let imported = 0;

  // CSVをパース
  const lines = csvContent.split("\n").filter((line) => line.trim());
  if (lines.length < 2) {
    return { success: false, imported: 0, errors: ["CSVにデータがありません"] };
  }

  // ヘッダー行をスキップしてデータ行を処理
  const dataLines = lines.slice(1);

  // 担当者マップを作成（名前 → ID）
  const { data: employeesData } = await supabase.from("employees").select("id, name");
  const employeeNameToId = ((employeesData as { id: string; name: string }[]) || []).reduce(
    (acc, e) => {
      acc[e.name] = e.id;
      return acc;
    },
    {} as Record<string, string>
  );

  for (let i = 0; i < dataLines.length; i++) {
    const lineNum = i + 2; // 1行目はヘッダーなので+2
    const line = dataLines[i];

    // CSVをパース（カンマ区切り、クォート対応）
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        if (inQuotes && line[j + 1] === '"') {
          current += '"';
          j++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    // 必須フィールドのチェック
    const [code, category, name, status, , , managerName, startDate, endDate, fee, location] = values;

    if (!code || !category || !name) {
      errors.push(`${lineNum}行目: 業務コード、カテゴリ、業務名は必須です`);
      continue;
    }

    // カテゴリの検証
    const categoryCode = CATEGORY_NAME_TO_CODE[category];
    if (!categoryCode) {
      errors.push(`${lineNum}行目: 無効なカテゴリ「${category}」`);
      continue;
    }

    // ステータスの検証
    const validStatus = status && VALID_STATUSES.includes(status as ProjectStatus)
      ? (status as ProjectStatus)
      : "受注";

    // 担当者のID取得
    const managerId = managerName ? employeeNameToId[managerName] || null : null;

    // 日付の検証
    const isValidDate = (dateStr: string) => {
      if (!dateStr) return true;
      const date = new Date(dateStr);
      return !isNaN(date.getTime());
    };

    if (!isValidDate(startDate)) {
      errors.push(`${lineNum}行目: 無効な着手日「${startDate}」`);
      continue;
    }

    if (!isValidDate(endDate)) {
      errors.push(`${lineNum}行目: 無効な完了予定日「${endDate}」`);
      continue;
    }

    // 金額の検証
    const feeNumber = fee ? parseInt(fee, 10) : null;
    if (fee && isNaN(feeNumber as number)) {
      errors.push(`${lineNum}行目: 無効な報酬額「${fee}」`);
      continue;
    }

    // 既存の業務コードをチェック（重複防止）
    const { data: existing } = await supabase
      .from("projects")
      .select("id")
      .eq("code", code)
      .single();

    if (existing) {
      errors.push(`${lineNum}行目: 業務コード「${code}」は既に存在します`);
      continue;
    }

    // データベースに挿入
    const { error: insertError } = await supabase.from("projects").insert({
      code,
      category: categoryCode,
      name,
      status: validStatus,
      contact_id: null,
      manager_id: managerId,
      start_date: startDate || null,
      end_date: endDate || null,
      fee_tax_excluded: feeNumber || 0,
      location: location || null,
      details: {},
      monthly_allocations: {},
    });

    if (insertError) {
      errors.push(`${lineNum}行目: ${insertError.message}`);
      continue;
    }

    imported++;
  }

  if (imported > 0) {
    revalidatePath("/projects");
  }

  return {
    success: errors.length === 0,
    imported,
    errors,
  };
}
