"use server";

import { createClient } from "@/lib/supabase/server";
import type { DocumentTemplate, Employee, Customer } from "@/types/database";

// テンプレート一覧取得
export async function getDocumentTemplates(): Promise<DocumentTemplate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_templates")
    .select("*")
    .order("sort_order");

  if (error) {
    console.error("Error fetching templates:", error);
    return [];
  }
  return (data as DocumentTemplate[]) || [];
}

// 社員一覧取得
export async function getEmployeesForDocument(): Promise<Employee[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select("id, name, email, role, created_at, updated_at")
    .order("name");

  if (error) {
    console.error("Error fetching employees:", error);
    return [];
  }
  return (data as Employee[]) || [];
}

// 日付を令和形式に変換
function formatJapaneseDate(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  // 令和は2019年5月1日から
  const reiwaYear = year - 2018;
  return `令和${reiwaYear}年${month}月${day}日`;
}

// 文書生成用データ取得 (Phase 3-5: customers テーブルベース)
export async function generateDocument(request: {
  templateId: string;
  customerId: string;
  senderId: string;
  documentDate: string;
}): Promise<{
  success: boolean;
  data?: string;
  fileName?: string;
  error?: string;
}> {
  const supabase = await createClient();

  // 1. テンプレート情報取得
  const { data: template, error: templateError } = await supabase
    .from("document_templates")
    .select("*")
    .eq("id", request.templateId)
    .single();

  if (templateError || !template) {
    return { success: false, error: "テンプレートが見つかりません" };
  }

  // 2. 顧客情報取得
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("*")
    .eq("id", request.customerId)
    .maybeSingle();

  if (customerError || !customer) {
    return { success: false, error: "顧客が見つかりません" };
  }

  const cust = customer as Customer;

  // 3. 宛先情報と担当者情報を顧客タイプに応じて組み立て
  const buildAddress = (c: Customer): string =>
    [c.prefecture, c.city, c.street, c.building].filter(Boolean).join("");

  let recipientCompanyName = "";
  let recipientName = "";
  const recipientPostalCode = cust.postal_code || "";
  const recipientAddress = buildAddress(cust);

  const contactData = {
    name: "",
    nameWithKeisho: "",
    department: "",
    position: "",
    phone: "",
    email: "",
  };

  if (cust.type === "corporate") {
    recipientCompanyName = cust.display_name || "";
    // 担当者情報 (customer 内の contact_* カラム)
    if (cust.contact_last_name || cust.contact_first_name) {
      const name = `${cust.contact_last_name ?? ""} ${cust.contact_first_name ?? ""}`.trim();
      contactData.name = name;
      contactData.nameWithKeisho = name ? `${name}様` : "";
    }
    contactData.department = cust.contact_department || "";
    contactData.position = cust.contact_position || "";
    contactData.phone = cust.contact_phone || "";
    contactData.email = cust.contact_email || "";
  } else {
    // 個人
    recipientName = cust.display_name || "";
  }

  // 4. 差出人情報取得
  const { data: sender, error: senderError } = await supabase
    .from("employees")
    .select("*")
    .eq("id", request.senderId)
    .single();

  if (senderError || !sender) {
    return { success: false, error: "差出人が見つかりません" };
  }

  const emp = sender as Employee;

  // 5. 敬称を決定（法人で担当者がいる場合は空、個人は様、法人のみは御中）
  let keisho = "";
  if (cust.type === "individual") {
    keisho = "様";
  } else if (!contactData.name) {
    keisho = "御中";
  }

  // 6. プレースホルダー値マップ
  const placeholderValues = {
    宛先_会社名: recipientCompanyName,
    宛先_氏名: recipientName,
    宛先_郵便番号: recipientPostalCode ? `〒${recipientPostalCode}` : "",
    宛先_住所: recipientAddress,
    敬称: keisho,
    担当者_氏名: contactData.name,
    担当者_氏名様: contactData.nameWithKeisho,
    担当者_部署: contactData.department,
    担当者_役職: contactData.position,
    担当者_電話: contactData.phone,
    担当者_メール: contactData.email,
    差出人_氏名: emp.name,
    差出人_メール: emp.email || "",
    作成日: formatJapaneseDate(new Date()),
    指定日付: formatJapaneseDate(new Date(request.documentDate)),
  };

  const templateData = template as DocumentTemplate;

  return {
    success: true,
    data: JSON.stringify({
      templateFileName: templateData.file_name,
      storagePath: templateData.storage_path,
      placeholderValues,
    }),
    fileName: `${templateData.name}_${new Date().toISOString().slice(0, 10)}.docx`,
  };
}
