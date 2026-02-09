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
  location_detail: string | null;
  details: Record<string, unknown>;
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
    location_detail: data.location_detail || null,
    details: data.details,
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

// 業務コードプレフィックスからカテゴリコードへの変換マップ
const CODE_PREFIX_TO_CATEGORY: Record<string, ProjectCategory> = {
  A: "A_Survey",
  B: "B_Boundary",
  C: "C_Registration",
  D: "D_Inheritance",
  E: "E_Corporate",
  F: "F_Drone",
  N: "N_Farmland",
};

// ステータスの有効値
const VALID_STATUSES: ProjectStatus[] = ["進行中", "進行中", "完了", "中止"];

// CSV行をパースするヘルパー
function parseCSVLine(line: string): string[] {
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
  return values;
}

// 日付文字列を ISO 形式に変換（2024/03/18 → 2024-03-18）
function normalizeDate(dateStr: string): string | null {
  if (!dateStr) return null;
  // YYYY/MM/DD → YYYY-MM-DD
  const normalized = dateStr.replace(/\//g, "-");
  const date = new Date(normalized);
  if (isNaN(date.getTime())) return null;
  return normalized;
}

// ヘッダーからCSV形式を判定
type CSVFormat = "standard" | "business" | "corporate" | "boundary";

function detectCSVFormat(headerValues: string[]): CSVFormat {
  const firstHeader = headerValues[0]?.trim();
  // B_境界測量CSVのヘッダー: ID,顧客,目的,担当者,進捗状況,着手,完了,税抜報酬,紹介者,市区町村,所在,...,▶境界測量,...
  if (firstHeader === "ID" && headerValues.some((h) => h.trim() === "▶境界測量")) {
    return "boundary";
  }
  // E_法人関係CSVのヘッダー: ID,顧客,依頼の目的,業務担当者,進捗状況,受託,完了,税抜報酬,次期改選,エリア,コメント
  if (firstHeader === "ID" && headerValues.some((h) => h.trim() === "依頼の目的")) {
    return "corporate";
  }
  // 業務管理CSVのヘッダー: ID,顧客,業務名,業務担当者,進捗状況,着手,完了,税抜報酬,業務の区分,エリア
  if (firstHeader === "ID" && headerValues.some((h) => h.trim() === "業務の区分")) {
    return "business";
  }
  return "standard";
}

// 境界測量CSV用の工程定義
interface BoundaryTaskDefinition {
  name: string;
  columnIndex: number;
}

// 境界測量CSV用のヘッダー列インデックスを解析
function parseBoundaryHeaders(headerValues: string[]): {
  boundaryTasks: BoundaryTaskDefinition[];
  siteSurveyTasks: BoundaryTaskDefinition[];
  columnMap: Record<string, number>;
} {
  const columnMap: Record<string, number> = {};
  for (let i = 0; i < headerValues.length; i++) {
    columnMap[headerValues[i].trim()] = i;
  }

  const boundaryTasks: BoundaryTaskDefinition[] = [];
  const siteSurveyTasks: BoundaryTaskDefinition[] = [];

  // ▶境界測量 の位置を探す
  const boundaryStartIdx = columnMap["▶境界測量"];
  // ▶敷地計測 の位置を探す
  const siteSurveyStartIdx = columnMap["▶敷地計測"];

  if (boundaryStartIdx !== undefined) {
    // ▶境界測量の後から▶敷地計測の前まで、または配列の終わりまでが境界測量の工程
    const endIdx = siteSurveyStartIdx !== undefined ? siteSurveyStartIdx : headerValues.length;
    for (let i = boundaryStartIdx + 1; i < endIdx; i++) {
      const name = headerValues[i].trim();
      if (name && !name.startsWith("▶")) {
        boundaryTasks.push({ name, columnIndex: i });
      }
    }
  }

  if (siteSurveyStartIdx !== undefined) {
    // ▶敷地計測の後から配列の終わりまでが敷地計測の工程
    for (let i = siteSurveyStartIdx + 1; i < headerValues.length; i++) {
      const name = headerValues[i].trim();
      if (name && !name.startsWith("▶")) {
        siteSurveyTasks.push({ name, columnIndex: i });
      }
    }
  }

  return { boundaryTasks, siteSurveyTasks, columnMap };
}

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

  // ヘッダー行を解析してCSV形式を判定
  const headerValues = parseCSVLine(lines[0]);
  const format = detectCSVFormat(headerValues);

  // データ行
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

  // 法人マップを作成（法人名 → contact_id）※business/boundary形式用
  let accountNameToContactId: Record<string, string> = {};
  if (format === "business" || format === "boundary") {
    // 法人を取得
    const { data: accountsData } = await supabase
      .from("accounts" as never)
      .select("*")
      .is("deleted_at", null);
    const typedAccounts = (accountsData as Account[]) || [];

    // 各法人のis_primary=trueの連絡先を取得
    const { data: contactsData } = await supabase
      .from("contacts" as never)
      .select("*")
      .is("deleted_at", null);
    const typedContacts = (contactsData as Contact[]) || [];

    // 法人名 → その法人の代表連絡先ID（is_primary優先、なければ最初の連絡先）
    for (const account of typedAccounts) {
      const accountContacts = typedContacts.filter((c) => c.account_id === account.id);
      const primaryContact = accountContacts.find((c) => c.is_primary);
      const contactId = primaryContact?.id || accountContacts[0]?.id || null;
      if (contactId) {
        accountNameToContactId[account.company_name] = contactId;
      }
    }
  }

  // 境界測量CSV用のヘッダー解析
  let boundaryTaskDefs: BoundaryTaskDefinition[] = [];
  let siteSurveyTaskDefs: BoundaryTaskDefinition[] = [];
  let boundaryColumnMap: Record<string, number> = {};
  if (format === "boundary") {
    const parsed = parseBoundaryHeaders(headerValues);
    boundaryTaskDefs = parsed.boundaryTasks;
    siteSurveyTaskDefs = parsed.siteSurveyTasks;
    boundaryColumnMap = parsed.columnMap;
  }

  for (let i = 0; i < dataLines.length; i++) {
    const lineNum = i + 2;
    const values = parseCSVLine(dataLines[i]);

    if (format === "boundary") {
      // B_境界測量CSV形式
      // ヘッダー: ID,顧客,目的,担当者,進捗状況,着手,完了,税抜報酬,紹介者,市区町村,所在,地図,詳細,グループ,▶境界測量,...工程...,▶敷地計測,...工程...
      const code = values[boundaryColumnMap["ID"]]?.trim();
      const customerName = values[boundaryColumnMap["顧客"]]?.trim();
      const purpose = values[boundaryColumnMap["目的"]]?.trim();
      const managerName = values[boundaryColumnMap["担当者"]]?.trim();
      const statusRaw = values[boundaryColumnMap["進捗状況"]]?.trim();
      const startDateRaw = values[boundaryColumnMap["着手"]]?.trim();
      const endDateRaw = values[boundaryColumnMap["完了"]]?.trim();
      const feeRaw = values[boundaryColumnMap["税抜報酬"]]?.trim();
      const area = values[boundaryColumnMap["市区町村"]]?.trim();
      const locationDetail = values[boundaryColumnMap["所在"]]?.trim();
      const notes = values[boundaryColumnMap["詳細"]]?.trim();

      // 空行をスキップ
      if (!code) {
        continue;
      }

      // 業務コードのプレフィックスからカテゴリを判定
      const prefix = code.charAt(0).toUpperCase();
      const categoryCode = CODE_PREFIX_TO_CATEGORY[prefix];
      if (!categoryCode) {
        errors.push(`${lineNum}行目: 業務コード「${code}」のプレフィックス「${prefix}」から有効なカテゴリを判定できません`);
        continue;
      }

      // ステータスのマッピング（停止→進行中）
      let validStatus: ProjectStatus = "進行中";
      if (statusRaw) {
        if (VALID_STATUSES.includes(statusRaw as ProjectStatus)) {
          validStatus = statusRaw as ProjectStatus;
        } else if (statusRaw === "停止") {
          validStatus = "進行中";
        } else if (statusRaw === "請求済") {
          validStatus = "完了";
        } else if (statusRaw === "受注") {
          validStatus = "進行中";
        } else if (statusRaw === "着手" || statusRaw === "作業中") {
          validStatus = "進行中";
        }
      }

      // 担当者
      const managerId = managerName ? employeeNameToId[managerName] || null : null;

      // 日付
      const startDate = normalizeDate(startDateRaw);
      const endDate = normalizeDate(endDateRaw);

      if (startDateRaw && !startDate) {
        errors.push(`${lineNum}行目: 無効な着手日「${startDateRaw}」`);
        continue;
      }
      if (endDateRaw && !endDate) {
        errors.push(`${lineNum}行目: 無効な完了日「${endDateRaw}」`);
        continue;
      }

      // 金額
      const feeClean = feeRaw ? feeRaw.replace(/,/g, "") : "";
      const feeNumber = feeClean ? parseInt(feeClean, 10) : null;
      if (feeClean && isNaN(feeNumber as number)) {
        errors.push(`${lineNum}行目: 無効な報酬額「${feeRaw}」`);
        continue;
      }

      // 顧客マッチング（法人名から）。該当なしの場合は法人を新規作成
      let contactId: string | null = null;
      if (customerName) {
        if (accountNameToContactId[customerName]) {
          contactId = accountNameToContactId[customerName];
        } else {
          // 法人を新規作成
          const { data: newAccount, error: accError } = await supabase
            .from("accounts" as never)
            .insert({ company_name: customerName } as never)
            .select("id")
            .single();

          if (!accError && newAccount) {
            const newAccountId = (newAccount as { id: string }).id;
            const { data: newContact, error: contactError } = await supabase
              .from("contacts" as never)
              .insert({
                account_id: newAccountId,
                last_name: customerName,
                first_name: "",
                is_primary: true,
              } as never)
              .select("id")
              .single();

            if (!contactError && newContact) {
              const newContactId = (newContact as { id: string }).id;
              accountNameToContactId[customerName] = newContactId;
              contactId = newContactId;
            }
          }
        }
      }

      // 既存チェック
      const { data: existing } = await supabase
        .from("projects")
        .select("id")
        .eq("code", code)
        .single();

      if (existing) {
        errors.push(`${lineNum}行目: 業務コード「${code}」は既に存在します`);
        continue;
      }

      // details に詳細を保存
      const details: Record<string, string> = {};
      if (notes) {
        details.notes = notes;
      }

      // 業務を作成
      const { data: projectData, error: insertError } = await supabase
        .from("projects")
        .insert({
          code,
          category: categoryCode,
          name: purpose || "（業務名未設定）",
          status: validStatus,
          contact_id: contactId,
          manager_id: managerId,
          start_date: startDate,
          end_date: endDate,
          fee_tax_excluded: feeNumber || 0,
          location: area || null,
          location_detail: locationDetail || null,
          details,
        })
        .select("id")
        .single();

      if (insertError) {
        errors.push(`${lineNum}行目: ${insertError.message}`);
        continue;
      }

      const projectId = (projectData as { id: string }).id;

      // タスクを作成（工程列をタスクに変換）
      // ▶境界測量かどうかを判定（TRUE/FALSEで判断）
      const isBoundarySurvey = values[boundaryColumnMap["▶境界測量"]]?.toUpperCase() === "TRUE";
      const isSiteSurvey = values[boundaryColumnMap["▶敷地計測"]]?.toUpperCase() === "TRUE";

      let taskSortOrder = 0;
      const tasksToInsert: Array<{
        project_id: string;
        title: string;
        is_completed: boolean;
        sort_order: number;
        assigned_to: string | null;
      }> = [];

      // 境界測量の工程をタスクとして追加
      if (isBoundarySurvey) {
        for (const taskDef of boundaryTaskDefs) {
          const cellValue = values[taskDef.columnIndex]?.toUpperCase();
          const isCompleted = cellValue === "TRUE";
          // FALSE（まだ実行していない工程）やTRUE（完了した工程）をタスクとして追加
          // 空やx等の場合は該当しない工程なのでスキップ
          if (cellValue === "TRUE" || cellValue === "FALSE") {
            tasksToInsert.push({
              project_id: projectId,
              title: taskDef.name,
              is_completed: isCompleted,
              sort_order: taskSortOrder++,
              assigned_to: managerId,
            });
          }
        }
      }

      // 敷地計測の工程をタスクとして追加
      if (isSiteSurvey) {
        for (const taskDef of siteSurveyTaskDefs) {
          const cellValue = values[taskDef.columnIndex]?.toUpperCase();
          const isCompleted = cellValue === "TRUE";
          if (cellValue === "TRUE" || cellValue === "FALSE") {
            tasksToInsert.push({
              project_id: projectId,
              title: taskDef.name,
              is_completed: isCompleted,
              sort_order: taskSortOrder++,
              assigned_to: managerId,
            });
          }
        }
      }

      // タスクを一括挿入
      if (tasksToInsert.length > 0) {
        const { error: taskError } = await supabase
          .from("tasks" as never)
          .insert(tasksToInsert as never);

        if (taskError) {
          errors.push(`${lineNum}行目: タスク作成エラー - ${taskError.message}`);
        }
      }

      imported++;
    } else if (format === "corporate") {
      // E_法人関係CSV形式: ID,顧客,依頼の目的,業務担当者,進捗状況,受託,完了,税抜報酬,次期改選,エリア,コメント
      const [code, customerName, purpose, managerName, statusRaw, startDateRaw, endDateRaw, feeRaw, nextElection, area, comment] = values;

      if (!code || !purpose) {
        errors.push(`${lineNum}行目: 業務コードと依頼の目的は必須です`);
        continue;
      }

      // 業務コードのプレフィックスからカテゴリを判定
      const prefix = code.charAt(0).toUpperCase();
      const categoryCode = CODE_PREFIX_TO_CATEGORY[prefix];
      if (!categoryCode) {
        errors.push(`${lineNum}行目: 業務コード「${code}」のプレフィックス「${prefix}」から有効なカテゴリを判定できません`);
        continue;
      }

      // ステータスのマッピング（旧ステータスも対応）
      let validStatus: ProjectStatus = "進行中";
      if (statusRaw) {
        const statusTrimmed = statusRaw.trim();
        if (VALID_STATUSES.includes(statusTrimmed as ProjectStatus)) {
          validStatus = statusTrimmed as ProjectStatus;
        } else if (statusTrimmed === "請求済") {
          validStatus = "完了";
        } else if (statusTrimmed === "受注") {
          validStatus = "進行中";
        } else if (statusTrimmed === "着手" || statusTrimmed === "作業中") {
          validStatus = "進行中";
        }
      }

      // 担当者
      const managerId = managerName ? employeeNameToId[managerName.trim()] || null : null;

      // 日付
      const startDate = normalizeDate(startDateRaw);
      const endDate = normalizeDate(endDateRaw);

      if (startDateRaw && !startDate) {
        errors.push(`${lineNum}行目: 無効な受託日「${startDateRaw}」`);
        continue;
      }
      if (endDateRaw && !endDate) {
        errors.push(`${lineNum}行目: 無効な完了日「${endDateRaw}」`);
        continue;
      }

      // 金額
      const feeClean = feeRaw ? feeRaw.replace(/,/g, "") : "";
      const feeNumber = feeClean ? parseInt(feeClean, 10) : null;
      if (feeClean && isNaN(feeNumber as number)) {
        errors.push(`${lineNum}行目: 無効な報酬額「${feeRaw}」`);
        continue;
      }

      // 顧客マッチング（法人名から）
      let contactId: string | null = null;
      if (customerName) {
        const trimmedName = customerName.trim();
        if (accountNameToContactId[trimmedName]) {
          contactId = accountNameToContactId[trimmedName];
        } else if (trimmedName) {
          // 法人を新規作成
          const { data: newAccount, error: accError } = await supabase
            .from("accounts" as never)
            .insert({ company_name: trimmedName } as never)
            .select("id")
            .single();

          if (!accError && newAccount) {
            const newAccountId = (newAccount as { id: string }).id;
            const { data: newContact, error: contactError } = await supabase
              .from("contacts" as never)
              .insert({
                account_id: newAccountId,
                last_name: trimmedName,
                first_name: "",
                is_primary: true,
              } as never)
              .select("id")
              .single();

            if (!contactError && newContact) {
              const newContactId = (newContact as { id: string }).id;
              accountNameToContactId[trimmedName] = newContactId;
              contactId = newContactId;
            }
          }
        }
      }

      // 既存チェック
      const { data: existing } = await supabase
        .from("projects")
        .select("id")
        .eq("code", code)
        .single();

      if (existing) {
        errors.push(`${lineNum}行目: 業務コード「${code}」は既に存在します`);
        continue;
      }

      // details に次期改選とコメントを保存
      const details: Record<string, string> = {};
      if (nextElection) {
        details.next_election = nextElection.trim();
      }
      if (comment) {
        details.comment = comment.trim();
      }

      const { error: insertError } = await supabase.from("projects").insert({
        code,
        category: categoryCode,
        name: purpose.trim(),
        status: validStatus,
        contact_id: contactId,
        manager_id: managerId,
        start_date: startDate,
        end_date: endDate,
        fee_tax_excluded: feeNumber || 0,
        location: area?.trim() || null,
        location_detail: null,
        details,
      });

      if (insertError) {
        errors.push(`${lineNum}行目: ${insertError.message}`);
        continue;
      }

      imported++;
    } else if (format === "business") {
      // 業務管理CSV形式: ID,顧客,業務名,業務担当者,進捗状況,着手,完了,税抜報酬,業務の区分,エリア
      const [code, customerName, name, managerName, statusRaw, startDateRaw, endDateRaw, feeRaw, surveyType, area] = values;

      if (!code || !name) {
        errors.push(`${lineNum}行目: 業務コードと業務名は必須です`);
        continue;
      }

      // 業務コードのプレフィックスからカテゴリを判定
      const prefix = code.charAt(0).toUpperCase();
      const categoryCode = CODE_PREFIX_TO_CATEGORY[prefix];
      if (!categoryCode) {
        errors.push(`${lineNum}行目: 業務コード「${code}」のプレフィックス「${prefix}」から有効なカテゴリを判定できません`);
        continue;
      }

      // ステータスのマッピング（旧ステータスも対応）
      let validStatus: ProjectStatus = "進行中";
      if (statusRaw) {
        const statusTrimmed = statusRaw.trim();
        if (VALID_STATUSES.includes(statusTrimmed as ProjectStatus)) {
          validStatus = statusTrimmed as ProjectStatus;
        } else if (statusTrimmed === "請求済") {
          validStatus = "完了";
        } else if (statusTrimmed === "受注") {
          validStatus = "進行中";
        } else if (statusTrimmed === "着手" || statusTrimmed === "作業中") {
          validStatus = "進行中";
        }
      }

      // 担当者
      const managerId = managerName ? employeeNameToId[managerName.trim()] || null : null;

      // 日付
      const startDate = normalizeDate(startDateRaw);
      const endDate = normalizeDate(endDateRaw);

      if (startDateRaw && !startDate) {
        errors.push(`${lineNum}行目: 無効な着手日「${startDateRaw}」`);
        continue;
      }
      if (endDateRaw && !endDate) {
        errors.push(`${lineNum}行目: 無効な完了日「${endDateRaw}」`);
        continue;
      }

      // 金額
      const feeClean = feeRaw ? feeRaw.replace(/,/g, "") : "";
      const feeNumber = feeClean ? parseInt(feeClean, 10) : null;
      if (feeClean && isNaN(feeNumber as number)) {
        errors.push(`${lineNum}行目: 無効な報酬額「${feeRaw}」`);
        continue;
      }

      // 顧客マッチング（法人名から）。該当なしの場合は法人を新規作成
      let contactId: string | null = null;
      if (customerName) {
        const trimmedName = customerName.trim();
        if (accountNameToContactId[trimmedName]) {
          contactId = accountNameToContactId[trimmedName];
        } else if (trimmedName) {
          // 法人を新規作成
          const { data: newAccount, error: accError } = await supabase
            .from("accounts" as never)
            .insert({ company_name: trimmedName } as never)
            .select("id")
            .single();

          if (!accError && newAccount) {
            const newAccountId = (newAccount as { id: string }).id;
            // 代表連絡先を作成（法人名をそのまま姓に）
            const { data: newContact, error: contactError } = await supabase
              .from("contacts" as never)
              .insert({
                account_id: newAccountId,
                last_name: trimmedName,
                first_name: "",
                is_primary: true,
              } as never)
              .select("id")
              .single();

            if (!contactError && newContact) {
              const newContactId = (newContact as { id: string }).id;
              accountNameToContactId[trimmedName] = newContactId;
              contactId = newContactId;
            }
          }
        }
      }

      // 既存チェック
      const { data: existing } = await supabase
        .from("projects")
        .select("id")
        .eq("code", code)
        .single();

      if (existing) {
        errors.push(`${lineNum}行目: 業務コード「${code}」は既に存在します`);
        continue;
      }

      // details に業務の区分を保存
      const details: Record<string, string> = {};
      if (surveyType) {
        details.survey_type = surveyType.trim();
      }

      const { error: insertError } = await supabase.from("projects").insert({
        code,
        category: categoryCode,
        name,
        status: validStatus,
        contact_id: contactId,
        manager_id: managerId,
        start_date: startDate,
        end_date: endDate,
        fee_tax_excluded: feeNumber || 0,
        location: area?.trim() || null,
        location_detail: null,
        details,
      });

      if (insertError) {
        errors.push(`${lineNum}行目: ${insertError.message}`);
        continue;
      }

      imported++;
    } else {
      // 標準CSV形式: 業務コード,カテゴリ,業務名,ステータス,法人名,顧客名,担当者,着手日,完了予定日,税抜報酬額,エリア
      const [code, category, name, status, , , managerName, startDate, endDate, fee, location] = values;

      if (!code || !category || !name) {
        errors.push(`${lineNum}行目: 業務コード、カテゴリ、業務名は必須です`);
        continue;
      }

      const categoryCode = CATEGORY_NAME_TO_CODE[category];
      if (!categoryCode) {
        errors.push(`${lineNum}行目: 無効なカテゴリ「${category}」`);
        continue;
      }

      // ステータスのマッピング（旧ステータスも対応）
      let validStatus: ProjectStatus = "進行中";
      if (status) {
        const statusTrimmed = status.trim();
        if (VALID_STATUSES.includes(statusTrimmed as ProjectStatus)) {
          validStatus = statusTrimmed as ProjectStatus;
        } else if (statusTrimmed === "請求済") {
          validStatus = "完了";
        } else if (statusTrimmed === "受注") {
          validStatus = "進行中";
        } else if (statusTrimmed === "着手" || statusTrimmed === "作業中") {
          validStatus = "進行中";
        }
      }

      const managerId = managerName ? employeeNameToId[managerName] || null : null;

      const normalizedStart = normalizeDate(startDate);
      const normalizedEnd = normalizeDate(endDate);

      if (startDate && !normalizedStart) {
        errors.push(`${lineNum}行目: 無効な着手日「${startDate}」`);
        continue;
      }

      if (endDate && !normalizedEnd) {
        errors.push(`${lineNum}行目: 無効な完了予定日「${endDate}」`);
        continue;
      }

      const feeNumber = fee ? parseInt(fee, 10) : null;
      if (fee && isNaN(feeNumber as number)) {
        errors.push(`${lineNum}行目: 無効な報酬額「${fee}」`);
        continue;
      }

      const { data: existing } = await supabase
        .from("projects")
        .select("id")
        .eq("code", code)
        .single();

      if (existing) {
        errors.push(`${lineNum}行目: 業務コード「${code}」は既に存在します`);
        continue;
      }

      const { error: insertError } = await supabase.from("projects").insert({
        code,
        category: categoryCode,
        name,
        status: validStatus,
        contact_id: null,
        manager_id: managerId,
        start_date: normalizedStart,
        end_date: normalizedEnd,
        fee_tax_excluded: feeNumber || 0,
        location: location || null,
        location_detail: null,
        details: {},
      });

      if (insertError) {
        errors.push(`${lineNum}行目: ${insertError.message}`);
        continue;
      }

      imported++;
    }
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
