"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ProjectCategory, ProjectStatus } from "@/types/database";
import { createProjectFolder } from "@/lib/dropbox/client";

// カテゴリからプレフィックス文字を取得
const CATEGORY_PREFIX: Record<ProjectCategory, string> = {
  A_Survey: "A",
  B_Boundary: "B",
  C_Registration: "C",
  D_Inheritance: "D",
  E_Corporate: "E",
  F_Drone: "F",
  N_Farmland: "N",
  S_General: "S",
  Z_Other: "Z",
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
  account_id?: string | null;
  customer_id?: string | null;
  manager_id: string | null;
  start_date: string | null;
  end_date: string | null;
  fee_tax_excluded: number | null;
  location: string | null;
  location_detail: string | null;
  notes: string | null;
}

export async function createProject(data: CreateProjectData): Promise<{
  error?: string;
  projectId?: string;
}> {
  const supabase = await createClient();

  // Dropboxフォルダを自動作成
  let mainFolderPath: string | null = null;
  const dropboxResult = await createProjectFolder(data.category, data.code, data.name);
  if (dropboxResult.success && dropboxResult.path) {
    mainFolderPath = dropboxResult.path;
  } else if (dropboxResult.error) {
    console.warn("Dropbox folder creation failed:", dropboxResult.error);
    // フォルダ作成に失敗しても業務登録は続行
  }

  const { data: project, error } = await supabase.from("projects").insert({
    code: data.code,
    category: data.category,
    name: data.name,
    status: data.status,
    contact_id: data.contact_id || null,
    account_id: data.account_id || null,
    customer_id: data.customer_id || null,
    manager_id: data.manager_id || null,
    start_date: data.start_date || null,
    end_date: data.end_date || null,
    fee_tax_excluded: data.fee_tax_excluded || 0,
    location: data.location || null,
    location_detail: data.location_detail || null,
    notes: data.notes || null,
    main_folder_path: mainFolderPath,
  }).select("id").single();

  if (error) {
    console.error("Error creating project:", error);
    return { error: error.message };
  }

  revalidatePath("/projects");
  return { projectId: (project as { id: string }).id };
}

// 複数カテゴリの業務を一括作成
export interface CreateProjectsData {
  categories: ProjectCategory[];
  customCodes?: Record<ProjectCategory, string>; // カスタム業務コード（指定時はこちらを使用）
  name: string;
  status: ProjectStatus;
  contact_id: string | null;
  account_id?: string | null;
  customer_id?: string | null;
  manager_id: string | null;
  start_date: string | null;
  end_date: string | null;
  fee_tax_excluded: number | null;
  location: string | null;
  location_detail: string | null;
  notes: string | null;
}

export async function createProjects(data: CreateProjectsData): Promise<{
  error?: string;
  projectIds?: string[];
  primaryProjectId?: string;
}> {
  const supabase = await createClient();
  const projectIds: string[] = [];

  // 各カテゴリの業務コードを取得（カスタムコードがあればそちらを使用）
  const projectCodes: Record<ProjectCategory, string> = {} as Record<ProjectCategory, string>;
  for (const category of data.categories) {
    projectCodes[category] = data.customCodes?.[category] || await getNextProjectCode(category);
  }

  // 各業務を作成
  for (const category of data.categories) {
    const code = projectCodes[category];

    // Dropboxフォルダを自動作成
    let mainFolderPath: string | null = null;
    const dropboxResult = await createProjectFolder(category, code, data.name);
    if (dropboxResult.success && dropboxResult.path) {
      mainFolderPath = dropboxResult.path;
    } else if (dropboxResult.error) {
      console.warn("Dropbox folder creation failed:", dropboxResult.error);
    }

    const { data: project, error } = await supabase.from("projects").insert({
      code,
      category,
      name: data.name,
      status: data.status,
      contact_id: data.contact_id || null,
      account_id: data.account_id || null,
      customer_id: data.customer_id || null,
      manager_id: data.manager_id || null,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      fee_tax_excluded: data.fee_tax_excluded || 0,
      location: data.location || null,
      location_detail: data.location_detail || null,
      notes: data.notes || null,
      main_folder_path: mainFolderPath,
    }).select("id").single();

    if (error) {
      console.error("Error creating project:", error);
      return { error: error.message };
    }

    projectIds.push((project as { id: string }).id);
  }

  // 複数業務の場合は関連業務として相互リンク
  if (projectIds.length > 1) {
    for (let i = 0; i < projectIds.length; i++) {
      for (let j = i + 1; j < projectIds.length; j++) {
        const { error: relatedError } = await supabase
          .from("related_projects" as never)
          .insert({
            project_id: projectIds[i],
            related_project_id: projectIds[j],
          } as never);

        if (relatedError) {
          console.warn("Error creating related project link:", relatedError);
        }
      }
    }
  }

  revalidatePath("/projects");
  return {
    projectIds,
    primaryProjectId: projectIds[0],
  };
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

  // 顧客 (customers) を取得
  const { data: customersData } = await supabase
    .from("customers")
    .select("id, type, display_name, contact_last_name, contact_first_name");

  // 担当者を取得
  const { data: employeesData } = await supabase
    .from("employees")
    .select("id, name");

  type CustomerType = {
    id: string;
    type: "corporate" | "individual";
    display_name: string;
    contact_last_name: string | null;
    contact_first_name: string | null;
  };
  type EmployeeType = { id: string; name: string };

  const customerMap = ((customersData as CustomerType[]) || []).reduce((acc, c) => {
    acc[c.id] = c;
    return acc;
  }, {} as Record<string, CustomerType>);

  const employeeMap = ((employeesData as EmployeeType[]) || []).reduce((acc, e) => {
    acc[e.id] = e;
    return acc;
  }, {} as Record<string, EmployeeType>);

  // ヘルパー関数
  const getCustomerName = (customerId: string | null) =>
    customerId ? customerMap[customerId]?.display_name || "" : "";

  const getCustomerKind = (customerId: string | null) => {
    if (!customerId) return "";
    const c = customerMap[customerId];
    if (!c) return "";
    return c.type === "corporate" ? "法人" : "個人";
  };

  const getCustomerContactName = (customerId: string | null) => {
    if (!customerId) return "";
    const c = customerMap[customerId];
    if (!c || c.type !== "corporate") return "";
    const parts = [c.contact_last_name, c.contact_first_name].filter(Boolean);
    return parts.join(" ");
  };

  const getEmployeeName = (employeeId: string | null) =>
    employeeId ? employeeMap[employeeId]?.name || "" : "";

  // CSVヘッダー
  const headers = [
    "業務コード",
    "カテゴリ",
    "業務名",
    "ステータス",
    "顧客区分",
    "顧客名",
    "法人担当者",
    "業務担当者",
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
      getCustomerKind(project.customer_id),
      getCustomerName(project.customer_id),
      getCustomerContactName(project.customer_id),
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



// ============================================
// CSVインポート (Phase 3-6 で一旦無効化)
// customers 統合移行に合わせて customers ベースで再実装予定
// ============================================
export async function importProjectsFromCSV(_csvContent: string): Promise<{
  success: boolean;
  imported: number;
  errors: string[];
}> {
  return {
    success: false,
    imported: 0,
    errors: [
      "CSVインポートは現在停止中です (顧客モデル再編中)。再実装までお待ちください。",
    ],
  };
}
