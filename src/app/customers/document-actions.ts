"use server";

import { createClient } from "@/lib/supabase/server";
import type { DocumentTemplate, Employee, Account, Contact } from "@/types/database";

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

// 文書生成用データ取得
export async function generateDocument(request: {
  templateId: string;
  recipientType: "account" | "contact";
  recipientId: string;
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

  // 2. 宛先情報取得
  let recipientData: {
    company_name: string;
    name: string;
    postal_code: string;
    address: string;
  };

  if (request.recipientType === "account") {
    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", request.recipientId)
      .single();

    if (accountError || !account) {
      return { success: false, error: "法人が見つかりません" };
    }

    const acct = account as Account;
    recipientData = {
      company_name: acct.company_name || "",
      name: "",
      postal_code: acct.postal_code || "",
      address: `${acct.prefecture || ""}${acct.city || ""}${acct.street || ""}${acct.building || ""}`,
    };
  } else {
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("*, account:accounts(*)")
      .eq("id", request.recipientId)
      .single();

    if (contactError || !contact) {
      return { success: false, error: "個人が見つかりません" };
    }

    const cont = contact as Contact & { account: Account | null };
    // 個人の住所があればそれを使用、なければ法人の住所
    const hasOwnAddress = cont.postal_code || cont.prefecture;
    recipientData = {
      company_name: cont.account?.company_name || "",
      name: `${cont.last_name} ${cont.first_name}`,
      postal_code: hasOwnAddress
        ? cont.postal_code || ""
        : cont.account?.postal_code || "",
      address: hasOwnAddress
        ? `${cont.prefecture || ""}${cont.city || ""}${cont.street || ""}${cont.building || ""}`
        : `${cont.account?.prefecture || ""}${cont.account?.city || ""}${cont.account?.street || ""}${cont.account?.building || ""}`,
    };
  }

  // 3. 差出人情報取得
  const { data: sender, error: senderError } = await supabase
    .from("employees")
    .select("*")
    .eq("id", request.senderId)
    .single();

  if (senderError || !sender) {
    return { success: false, error: "差出人が見つかりません" };
  }

  const emp = sender as Employee;

  // 4. プレースホルダー値マップを作成
  const placeholderValues = {
    宛先_会社名: recipientData.company_name,
    宛先_氏名: recipientData.name,
    宛先_郵便番号: recipientData.postal_code ? `〒${recipientData.postal_code}` : "",
    宛先_住所: recipientData.address,
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
      placeholderValues,
    }),
    fileName: `${templateData.name}_${new Date().toISOString().slice(0, 10)}.docx`,
  };
}
