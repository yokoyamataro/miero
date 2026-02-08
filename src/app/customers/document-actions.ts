"use server";

import { createClient } from "@/lib/supabase/server";
import type { DocumentTemplate, Employee, Account, Contact, Branch } from "@/types/database";

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
  branchId?: string;
  contactId?: string;
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

    // 支店が選択されている場合は支店の住所を使用
    if (request.branchId) {
      const { data: branch } = await supabase
        .from("branches")
        .select("*")
        .eq("id", request.branchId)
        .single();

      if (branch) {
        const br = branch as Branch;
        recipientData = {
          company_name: acct.company_name || "",
          name: "",
          postal_code: br.postal_code || "",
          address: `${br.prefecture || ""}${br.city || ""}${br.street || ""}${br.building || ""}`,
        };
      } else {
        // 支店が見つからない場合は本社の住所
        recipientData = {
          company_name: acct.company_name || "",
          name: "",
          postal_code: acct.postal_code || "",
          address: `${acct.prefecture || ""}${acct.city || ""}${acct.street || ""}${acct.building || ""}`,
        };
      }
    } else {
      // 本社選択時は法人の住所を使用
      recipientData = {
        company_name: acct.company_name || "",
        name: "",
        postal_code: acct.postal_code || "",
        address: `${acct.prefecture || ""}${acct.city || ""}${acct.street || ""}${acct.building || ""}`,
      };
    }
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

  // 3. 支店情報取得（法人選択時のみ）
  let branchData: {
    name: string;
    phone: string;
    fax: string;
    postal_code: string;
    address: string;
  } = {
    name: "",
    phone: "",
    fax: "",
    postal_code: "",
    address: "",
  };

  if (request.branchId) {
    const { data: branch } = await supabase
      .from("branches")
      .select("*")
      .eq("id", request.branchId)
      .single();

    if (branch) {
      const br = branch as Branch;
      branchData = {
        name: br.name || "",
        phone: br.phone || "",
        fax: br.fax || "",
        postal_code: br.postal_code || "",
        address: `${br.prefecture || ""}${br.city || ""}${br.street || ""}${br.building || ""}`,
      };
    }
  }

  // 4. 担当者情報取得（法人選択時のみ）
  let contactData: {
    name: string;
    nameWithKeisho: string;
    department: string;
    position: string;
    phone: string;
    email: string;
  } = {
    name: "",
    nameWithKeisho: "",
    department: "",
    position: "",
    phone: "",
    email: "",
  };

  if (request.contactId) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", request.contactId)
      .single();

    if (contact) {
      const cont = contact as Contact;
      contactData = {
        name: `${cont.last_name} ${cont.first_name}`,
        nameWithKeisho: `${cont.last_name} ${cont.first_name}様`,
        department: cont.department || "",
        position: cont.position || "",
        phone: cont.phone || "",
        email: cont.email || "",
      };
    }
  }

  // 5. 差出人情報取得
  const { data: sender, error: senderError } = await supabase
    .from("employees")
    .select("*")
    .eq("id", request.senderId)
    .single();

  if (senderError || !sender) {
    return { success: false, error: "差出人が見つかりません" };
  }

  const emp = sender as Employee;

  // 6. 敬称を決定（担当者が選択されていれば空、なければ「御中」）
  const hasContact = request.contactId && contactData.name;
  const keisho = hasContact ? "" : "御中";

  // 7. プレースホルダー値マップを作成
  const placeholderValues = {
    宛先_会社名: recipientData.company_name,
    宛先_氏名: recipientData.name,
    宛先_郵便番号: recipientData.postal_code ? `〒${recipientData.postal_code}` : "",
    宛先_住所: recipientData.address,
    敬称: keisho,
    支店名: branchData.name,
    支店_電話: branchData.phone,
    支店_FAX: branchData.fax,
    支店_郵便番号: branchData.postal_code ? `〒${branchData.postal_code}` : "",
    支店_住所: branchData.address,
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
