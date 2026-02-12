"use server";

import { createClient } from "@/lib/supabase/server";
import {
  type Invoice,
  type InvoiceWithDetails,
  type BusinessEntity,
  type Project,
  type Contact,
  type Account,
  type Employee,
} from "@/types/database";

// ============================================
// 事業主体一覧取得
// ============================================
export async function getBusinessEntities(): Promise<BusinessEntity[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("business_entities" as never)
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Error fetching business entities:", error);
    return [];
  }

  return (data as BusinessEntity[]) || [];
}

// ============================================
// 請求書番号生成
// ============================================
export async function generateInvoiceNumber(
  projectCode: string,
  businessEntityCode: string
): Promise<{ invoiceNumber: string; sequenceNumber: number }> {
  const supabase = await createClient();

  // 同一業務・事業主体の既存請求書から最大連番を取得
  const { data: existingInvoices } = await supabase
    .from("invoices" as never)
    .select("sequence_number")
    .like("invoice_number", `${businessEntityCode}-${projectCode}-%`)
    .order("sequence_number", { ascending: false })
    .limit(1);

  const maxSequence = existingInvoices?.[0]
    ? (existingInvoices[0] as { sequence_number: number }).sequence_number
    : 0;
  const newSequence = maxSequence + 1;
  const sequenceStr = String(newSequence).padStart(2, "0");

  return {
    invoiceNumber: `${businessEntityCode}-${projectCode}-${sequenceStr}`,
    sequenceNumber: newSequence,
  };
}

// ============================================
// 請求書作成
// ============================================
export async function createInvoice(data: {
  project_id: string;
  project_code: string;
  business_entity_id: string;
  business_entity_code: string;
  invoice_date: string;
  recipient_contact_id: string | null;
  person_in_charge_id: string | null;
  fee_tax_excluded: number;
  expenses: number;
  total_amount: number;
  pdf_path: string | null;
  notes: string | null;
}): Promise<{ error?: string; invoice?: Invoice }> {
  const supabase = await createClient();

  // 請求書番号を生成
  const { invoiceNumber, sequenceNumber } = await generateInvoiceNumber(
    data.project_code,
    data.business_entity_code
  );

  const { data: invoice, error } = await supabase
    .from("invoices" as never)
    .insert({
      invoice_number: invoiceNumber,
      project_id: data.project_id,
      business_entity_id: data.business_entity_id,
      sequence_number: sequenceNumber,
      invoice_date: data.invoice_date,
      recipient_contact_id: data.recipient_contact_id,
      person_in_charge_id: data.person_in_charge_id,
      fee_tax_excluded: data.fee_tax_excluded,
      expenses: data.expenses,
      total_amount: data.total_amount,
      pdf_path: data.pdf_path,
      notes: data.notes,
    } as never)
    .select("*")
    .single();

  if (error) {
    console.error("Error creating invoice:", error);
    return { error: "請求書の作成に失敗しました" };
  }

  return { invoice: invoice as Invoice };
}

// ============================================
// 請求書更新
// ============================================
export async function updateInvoice(
  invoiceId: string,
  updates: {
    invoice_date?: string;
    recipient_contact_id?: string | null;
    person_in_charge_id?: string | null;
    fee_tax_excluded?: number;
    expenses?: number;
    total_amount?: number;
    pdf_path?: string | null;
    notes?: string | null;
    is_accounting_registered?: boolean;
    is_payment_received?: boolean;
    payment_received_date?: string | null;
  }
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("invoices" as never)
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", invoiceId);

  if (error) {
    console.error("Error updating invoice:", error);
    return { error: "請求書の更新に失敗しました" };
  }

  return {};
}

// ============================================
// 請求書削除（論理削除）
// ============================================
export async function deleteInvoice(invoiceId: string): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("invoices" as never)
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", invoiceId);

  if (error) {
    console.error("Error deleting invoice:", error);
    return { error: "請求書の削除に失敗しました" };
  }

  return {};
}

// ============================================
// 業務の請求書一覧取得
// ============================================
export async function getProjectInvoices(projectId: string): Promise<InvoiceWithDetails[]> {
  const supabase = await createClient();

  // 請求書一覧を取得
  const { data: invoices, error } = await supabase
    .from("invoices" as never)
    .select("*")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("invoice_date", { ascending: false });

  if (error || !invoices) {
    console.error("Error fetching project invoices:", error);
    return [];
  }

  // 関連データを取得
  const typedInvoices = invoices as Invoice[];
  const businessEntityIds = Array.from(new Set(typedInvoices.map((i) => i.business_entity_id)));
  const contactIds = Array.from(new Set(typedInvoices.map((i) => i.recipient_contact_id).filter(Boolean))) as string[];
  const employeeIds = Array.from(new Set(typedInvoices.map((i) => i.person_in_charge_id).filter(Boolean))) as string[];

  const [
    { data: businessEntities },
    { data: contacts },
    { data: employees },
    { data: project },
  ] = await Promise.all([
    supabase
      .from("business_entities" as never)
      .select("*")
      .in("id", businessEntityIds),
    contactIds.length > 0
      ? supabase.from("contacts" as never).select("*").in("id", contactIds)
      : Promise.resolve({ data: [] }),
    employeeIds.length > 0
      ? supabase.from("employees").select("*").in("id", employeeIds)
      : Promise.resolve({ data: [] }),
    supabase.from("projects").select("*").eq("id", projectId).single(),
  ]);

  // 連絡先からaccount_idを取得してアカウント情報を取得
  const typedContacts = (contacts as Contact[]) || [];
  const accountIds = Array.from(new Set(typedContacts.map((c) => c.account_id).filter(Boolean))) as string[];

  const { data: accounts } = accountIds.length > 0
    ? await supabase.from("accounts" as never).select("*").in("id", accountIds)
    : { data: [] };

  // マップ作成
  const entityMap = new Map((businessEntities as BusinessEntity[] || []).map((e) => [e.id, e]));
  const contactMap = new Map(typedContacts.map((c) => [c.id, c]));
  const employeeMap = new Map(((employees as Employee[]) || []).map((e) => [e.id, e]));
  const accountMap = new Map(((accounts as Account[]) || []).map((a) => [a.id, a]));

  // 結合
  return typedInvoices.map((invoice) => {
    const contact = invoice.recipient_contact_id
      ? contactMap.get(invoice.recipient_contact_id) || null
      : null;
    const account = contact?.account_id
      ? accountMap.get(contact.account_id) || null
      : null;

    return {
      ...invoice,
      project: project as Project,
      businessEntity: entityMap.get(invoice.business_entity_id)!,
      recipientContact: contact,
      recipientAccount: account,
      personInCharge: invoice.person_in_charge_id
        ? employeeMap.get(invoice.person_in_charge_id) || null
        : null,
    };
  });
}

// ============================================
// 全請求書一覧取得（請求一覧ページ用）
// ============================================
export async function getAllInvoices(filters?: {
  businessEntityId?: string;
  isAccountingRegistered?: boolean;
  isPaymentReceived?: boolean;
  startDate?: string;
  endDate?: string;
}): Promise<InvoiceWithDetails[]> {
  const supabase = await createClient();

  let query = supabase
    .from("invoices" as never)
    .select("*")
    .is("deleted_at", null)
    .order("invoice_date", { ascending: false });

  // フィルタ適用
  if (filters?.businessEntityId) {
    query = query.eq("business_entity_id", filters.businessEntityId);
  }
  if (filters?.isAccountingRegistered !== undefined) {
    query = query.eq("is_accounting_registered", filters.isAccountingRegistered);
  }
  if (filters?.isPaymentReceived !== undefined) {
    query = query.eq("is_payment_received", filters.isPaymentReceived);
  }
  if (filters?.startDate) {
    query = query.gte("invoice_date", filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte("invoice_date", filters.endDate);
  }

  const { data: invoices, error } = await query;

  if (error || !invoices) {
    console.error("Error fetching all invoices:", error);
    return [];
  }

  const typedInvoices = invoices as Invoice[];

  // 関連データを取得
  const projectIds = Array.from(new Set(typedInvoices.map((i) => i.project_id)));
  const businessEntityIds2 = Array.from(new Set(typedInvoices.map((i) => i.business_entity_id)));
  const contactIds2 = Array.from(new Set(typedInvoices.map((i) => i.recipient_contact_id).filter(Boolean))) as string[];
  const employeeIds2 = Array.from(new Set(typedInvoices.map((i) => i.person_in_charge_id).filter(Boolean))) as string[];

  const [
    { data: projects },
    { data: businessEntities },
    { data: contacts },
    { data: employees },
  ] = await Promise.all([
    projectIds.length > 0
      ? supabase.from("projects").select("*").in("id", projectIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("business_entities" as never)
      .select("*")
      .in("id", businessEntityIds2),
    contactIds2.length > 0
      ? supabase.from("contacts" as never).select("*").in("id", contactIds2)
      : Promise.resolve({ data: [] }),
    employeeIds2.length > 0
      ? supabase.from("employees").select("*").in("id", employeeIds2)
      : Promise.resolve({ data: [] }),
  ]);

  // 連絡先からaccount_idを取得してアカウント情報を取得
  const typedContacts2 = (contacts as Contact[]) || [];
  const accountIds2 = Array.from(new Set(typedContacts2.map((c) => c.account_id).filter(Boolean))) as string[];

  const { data: accounts } = accountIds2.length > 0
    ? await supabase.from("accounts" as never).select("*").in("id", accountIds2)
    : { data: [] };

  // マップ作成
  const projectMap = new Map(((projects as Project[]) || []).map((p) => [p.id, p]));
  const entityMap = new Map((businessEntities as BusinessEntity[] || []).map((e) => [e.id, e]));
  const contactMap = new Map(typedContacts2.map((c) => [c.id, c]));
  const employeeMap = new Map(((employees as Employee[]) || []).map((e) => [e.id, e]));
  const accountMap = new Map(((accounts as Account[]) || []).map((a) => [a.id, a]));

  // 結合
  return typedInvoices.map((invoice) => {
    const contact = invoice.recipient_contact_id
      ? contactMap.get(invoice.recipient_contact_id) || null
      : null;
    const account = contact?.account_id
      ? accountMap.get(contact.account_id) || null
      : null;

    return {
      ...invoice,
      project: projectMap.get(invoice.project_id)!,
      businessEntity: entityMap.get(invoice.business_entity_id)!,
      recipientContact: contact,
      recipientAccount: account,
      personInCharge: invoice.person_in_charge_id
        ? employeeMap.get(invoice.person_in_charge_id) || null
        : null,
    };
  });
}

// ============================================
// 会計登録ステータス更新
// ============================================
export async function toggleAccountingRegistered(
  invoiceId: string,
  isRegistered: boolean
): Promise<{ error?: string }> {
  return updateInvoice(invoiceId, { is_accounting_registered: isRegistered });
}

// ============================================
// 入金ステータス更新（旧: チェックボックス用、互換性のため残す）
// ============================================
export async function togglePaymentReceived(
  invoiceId: string,
  isReceived: boolean,
  paymentDate?: string
): Promise<{ error?: string }> {
  return updateInvoice(invoiceId, {
    is_payment_received: isReceived,
    payment_received_date: isReceived ? (paymentDate || new Date().toISOString().split("T")[0]) : null,
  });
}

// ============================================
// 入金日更新（日付入力で入金済みフラグも自動設定）
// ============================================
export async function updatePaymentDate(
  invoiceId: string,
  paymentDate: string | null
): Promise<{ error?: string }> {
  return updateInvoice(invoiceId, {
    is_payment_received: !!paymentDate,
    payment_received_date: paymentDate,
  });
}

// ============================================
// PDF署名付きURL取得
// ============================================
export async function getInvoicePdfUrl(pdfPath: string): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase.storage
    .from("invoices")
    .createSignedUrl(pdfPath, 60 * 60); // 1時間有効

  if (error) {
    console.error("Error creating signed URL:", error);
    return { error: "PDFのURLを取得できませんでした" };
  }

  return { url: data.signedUrl };
}

// ============================================
// PDFアップロード
// ============================================
export async function uploadInvoicePdf(
  invoiceId: string,
  formData: FormData
): Promise<{ pdfPath?: string; error?: string }> {
  const supabase = await createClient();

  const file = formData.get("file") as File;
  if (!file) {
    return { error: "ファイルが選択されていません" };
  }

  // ファイル名を生成（invoiceId_timestamp.pdf）
  const timestamp = Date.now();
  const fileName = `${invoiceId}_${timestamp}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from("invoices")
    .upload(fileName, file, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    console.error("Error uploading PDF:", uploadError);
    return { error: "PDFのアップロードに失敗しました" };
  }

  // 請求書レコードを更新
  const { error: updateError } = await supabase
    .from("invoices" as never)
    .update({ pdf_path: fileName, updated_at: new Date().toISOString() } as never)
    .eq("id", invoiceId);

  if (updateError) {
    console.error("Error updating invoice:", updateError);
    return { error: "請求書の更新に失敗しました" };
  }

  return { pdfPath: fileName };
}
