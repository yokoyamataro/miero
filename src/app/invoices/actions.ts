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
  type InvoiceDocumentType,
  type InvoiceItem,
  type InvoiceTemplateWithCategories,
  type InvoiceItemTemplate,
  type InvoiceItemCategory,
  type InvoiceTemplate,
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

// ============================================
// 業務一覧取得（請求書登録用）
// ============================================
export async function getProjectsForInvoice(): Promise<
  { id: string; code: string; name: string; contact_id: string | null }[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("projects")
    .select("id, code, name, contact_id")
    .order("code", { ascending: false })
    .limit(500);

  if (error) {
    console.error("Error fetching projects for invoice:", error);
    return [];
  }

  return (data as { id: string; code: string; name: string; contact_id: string | null }[]) || [];
}

// ============================================
// 業務の顧客情報取得
// ============================================
export async function getProjectCustomerInfo(projectId: string): Promise<{
  contacts: { id: string; name: string; accountName: string | null }[];
} | null> {
  const supabase = await createClient();

  // プロジェクトの情報を取得
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("contact_id")
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    return null;
  }

  const contactId = (project as { contact_id: string | null }).contact_id;
  if (!contactId) {
    return { contacts: [] };
  }

  // 連絡先を取得
  const { data: contact, error: contactError } = await supabase
    .from("contacts" as never)
    .select("id, last_name, first_name, account_id")
    .eq("id", contactId)
    .single();

  if (contactError || !contact) {
    return { contacts: [] };
  }

  const typedContact = contact as { id: string; last_name: string; first_name: string; account_id: string | null };

  // 法人情報を取得
  let accountName: string | null = null;
  if (typedContact.account_id) {
    const { data: account } = await supabase
      .from("accounts" as never)
      .select("company_name")
      .eq("id", typedContact.account_id)
      .single();
    accountName = (account as { company_name: string } | null)?.company_name || null;
  }

  return {
    contacts: [
      {
        id: typedContact.id,
        name: `${typedContact.last_name} ${typedContact.first_name}`,
        accountName,
      },
    ],
  };
}

// ============================================
// 全顧客リスト取得（相手先選択用）
// ============================================
export type RecipientOption = {
  id: string;
  label: string;
  type: "account" | "individual";
};

export async function getAllRecipients(): Promise<RecipientOption[]> {
  const supabase = await createClient();
  const recipients: RecipientOption[] = [];

  // 法人と関連する連絡先を取得
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, company_name")
    .is("deleted_at", null)
    .order("company_name");

  if (accounts) {
    const accountIds = accounts.map((a) => a.id);

    // 法人に紐付く連絡先を取得
    if (accountIds.length > 0) {
      const { data: accountContacts } = await supabase
        .from("contacts")
        .select("id, last_name, first_name, account_id")
        .in("account_id", accountIds)
        .is("deleted_at", null)
        .order("last_name");

      if (accountContacts) {
        // 法人ごとにグループ化して追加
        for (const account of accounts) {
          const contacts = accountContacts.filter((c) => c.account_id === account.id);
          if (contacts.length > 0) {
            for (const contact of contacts) {
              recipients.push({
                id: contact.id,
                label: `${account.company_name} - ${contact.last_name} ${contact.first_name}`,
                type: "account",
              });
            }
          } else {
            // 連絡先がない法人は法人名のみで表示（IDはaccount_idを使用）
            // ※実際には連絡先IDが必要なため、スキップ
          }
        }
      }
    }
  }

  // 個人顧客（法人に紐付かない連絡先）を取得
  const { data: individuals } = await supabase
    .from("contacts")
    .select("id, last_name, first_name")
    .is("account_id", null)
    .is("deleted_at", null)
    .order("last_name");

  if (individuals) {
    for (const ind of individuals) {
      recipients.push({
        id: ind.id,
        label: `${ind.last_name} ${ind.first_name}`,
        type: "individual",
      });
    }
  }

  return recipients;
}

// ============================================
// 請求書テンプレート一覧取得（項目選択用）
// ============================================
export async function getInvoiceTemplates(): Promise<InvoiceTemplateWithCategories[]> {
  const supabase = await createClient();

  // テンプレート一覧取得
  const { data: templates, error: templatesError } = await supabase
    .from("invoice_templates" as never)
    .select("*")
    .order("sort_order");

  if (templatesError || !templates) {
    console.error("Error fetching invoice templates:", templatesError);
    return [];
  }

  const typedTemplates = templates as InvoiceTemplate[];
  const templateIds = typedTemplates.map((t) => t.id);

  if (templateIds.length === 0) {
    return [];
  }

  // カテゴリ一覧取得
  const { data: categories, error: categoriesError } = await supabase
    .from("invoice_item_categories" as never)
    .select("*")
    .in("template_id", templateIds)
    .order("sort_order");

  if (categoriesError) {
    console.error("Error fetching invoice item categories:", categoriesError);
    return typedTemplates.map((t) => ({ ...t, categories: [] }));
  }

  const typedCategories = (categories as InvoiceItemCategory[]) || [];
  const categoryIds = typedCategories.map((c) => c.id);

  // 項目一覧取得
  const { data: items, error: itemsError } = categoryIds.length > 0
    ? await supabase
        .from("invoice_item_templates" as never)
        .select("*")
        .in("category_id", categoryIds)
        .order("sort_order")
    : { data: [], error: null };

  if (itemsError) {
    console.error("Error fetching invoice item templates:", itemsError);
  }

  const typedItems = (items as InvoiceItemTemplate[]) || [];

  // 階層構造に組み立て
  return typedTemplates.map((template) => ({
    ...template,
    categories: typedCategories
      .filter((category) => category.template_id === template.id)
      .map((category) => ({
        ...category,
        items: typedItems.filter((item) => item.category_id === category.id),
      })),
  }));
}

// ============================================
// 請求書作成（明細付き）
// ============================================
export async function createInvoiceWithItems(data: {
  project_id: string;
  project_code: string;
  business_entity_id: string;
  business_entity_code: string;
  invoice_date: string;
  recipient_contact_id: string | null;
  person_in_charge_id: string | null;
  document_type: InvoiceDocumentType;
  expenses: number;
  notes: string | null;
  tax_rate: number;
  items: {
    item_template_id: string | null;
    category_name: string | null;
    name: string;
    description: string | null;
    unit: string | null;
    quantity: number;
    unit_price: number;
    amount: number;
    sort_order: number;
  }[];
}): Promise<{ error?: string; invoice?: Invoice }> {
  const supabase = await createClient();

  // 計算
  const subtotal = data.items.reduce((sum, item) => sum + item.amount, 0);
  const taxAmount = Math.floor(subtotal * data.tax_rate);
  const totalAmount = subtotal + taxAmount + data.expenses;

  // 請求書番号を生成
  const { invoiceNumber, sequenceNumber } = await generateInvoiceNumber(
    data.project_code,
    data.business_entity_code
  );

  // 請求書を作成
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices" as never)
    .insert({
      invoice_number: invoiceNumber,
      project_id: data.project_id,
      business_entity_id: data.business_entity_id,
      sequence_number: sequenceNumber,
      invoice_date: data.invoice_date,
      recipient_contact_id: data.recipient_contact_id,
      person_in_charge_id: data.person_in_charge_id,
      document_type: data.document_type,
      fee_tax_excluded: subtotal,
      expenses: data.expenses,
      total_amount: totalAmount,
      subtotal: subtotal,
      tax_amount: taxAmount,
      tax_rate: data.tax_rate,
      notes: data.notes,
    } as never)
    .select("*")
    .single();

  if (invoiceError || !invoice) {
    console.error("Error creating invoice:", invoiceError);
    return { error: "請求書の作成に失敗しました" };
  }

  const typedInvoice = invoice as Invoice;

  // 明細項目を作成
  console.log("Creating invoice items, count:", data.items.length);
  if (data.items.length > 0) {
    const itemsToInsert = data.items.map((item) => ({
      invoice_id: typedInvoice.id,
      item_template_id: item.item_template_id,
      category_name: item.category_name,
      name: item.name,
      description: item.description,
      unit: item.unit,
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: item.amount,
      sort_order: item.sort_order,
    }));

    console.log("Items to insert:", JSON.stringify(itemsToInsert, null, 2));

    const { error: itemsError } = await supabase
      .from("invoice_items" as never)
      .insert(itemsToInsert as never);

    if (itemsError) {
      console.error("Error creating invoice items:", itemsError);
      // 請求書は作成されているので、ロールバックせずにエラーを返す
      return { error: "明細項目の作成に失敗しました: " + itemsError.message };
    }
    console.log("Invoice items created successfully");
  } else {
    console.log("No items to insert");
  }

  return { invoice: typedInvoice };
}

// ============================================
// 請求書の明細取得
// ============================================
export async function getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invoice_items" as never)
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("sort_order");

  if (error) {
    console.error("Error fetching invoice items:", error);
    return [];
  }

  return (data as InvoiceItem[]) || [];
}

// ============================================
// 明細項目の更新
// ============================================
export async function updateInvoiceItems(
  invoiceId: string,
  items: {
    id?: string;
    item_template_id: string | null;
    category_name: string | null;
    name: string;
    description: string | null;
    unit: string | null;
    quantity: number;
    unit_price: number;
    amount: number;
    sort_order: number;
  }[],
  taxRate: number,
  expenses: number
): Promise<{ error?: string }> {
  const supabase = await createClient();

  // 既存の明細を削除
  const { error: deleteError } = await supabase
    .from("invoice_items" as never)
    .delete()
    .eq("invoice_id", invoiceId);

  if (deleteError) {
    console.error("Error deleting invoice items:", deleteError);
    return { error: "明細の更新に失敗しました" };
  }

  // 新しい明細を挿入
  if (items.length > 0) {
    const itemsToInsert = items.map((item) => ({
      invoice_id: invoiceId,
      item_template_id: item.item_template_id,
      category_name: item.category_name,
      name: item.name,
      description: item.description,
      unit: item.unit,
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: item.amount,
      sort_order: item.sort_order,
    }));

    const { error: insertError } = await supabase
      .from("invoice_items" as never)
      .insert(itemsToInsert as never);

    if (insertError) {
      console.error("Error inserting invoice items:", insertError);
      return { error: "明細の更新に失敗しました" };
    }
  }

  // 請求書の金額を再計算
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const taxAmount = Math.floor(subtotal * taxRate);
  const totalAmount = subtotal + taxAmount + expenses;

  const { error: updateError } = await supabase
    .from("invoices" as never)
    .update({
      fee_tax_excluded: subtotal,
      subtotal: subtotal,
      tax_amount: taxAmount,
      tax_rate: taxRate,
      expenses: expenses,
      total_amount: totalAmount,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", invoiceId);

  if (updateError) {
    console.error("Error updating invoice totals:", updateError);
    return { error: "請求書金額の更新に失敗しました" };
  }

  return {};
}

// ============================================
// 明細読み込み用の請求書/見積書一覧取得
// ============================================
export type InvoiceForImport = {
  id: string;
  invoice_number: string;
  document_type: InvoiceDocumentType | null;
  invoice_date: string;
  project_code: string;
  project_name: string;
  total_amount: number;
};

export async function getInvoicesForImport(): Promise<InvoiceForImport[]> {
  const supabase = await createClient();

  const { data: invoices, error } = await supabase
    .from("invoices")
    .select(`
      id,
      invoice_number,
      document_type,
      invoice_date,
      total_amount,
      project_id
    `)
    .is("deleted_at", null)
    .order("invoice_date", { ascending: false })
    .limit(100);

  if (error || !invoices) {
    console.error("Error fetching invoices for import:", error);
    return [];
  }

  // プロジェクト情報を取得
  const projectIds = Array.from(new Set(invoices.map((i) => i.project_id)));
  const { data: projects } = await supabase
    .from("projects")
    .select("id, code, name")
    .in("id", projectIds);

  const projectMap = new Map(projects?.map((p) => [p.id, p]) || []);

  return invoices.map((inv) => {
    const project = projectMap.get(inv.project_id);
    return {
      id: inv.id,
      invoice_number: inv.invoice_number,
      document_type: inv.document_type as InvoiceDocumentType | null,
      invoice_date: inv.invoice_date,
      project_code: project?.code || "",
      project_name: project?.name || "",
      total_amount: inv.total_amount,
    };
  });
}

// ============================================
// 請求書/見積書から明細項目を取得（読み込み用）
// ============================================
export async function getInvoiceItemsForImport(invoiceId: string): Promise<{
  items: {
    item_template_id: string | null;
    category_name: string | null;
    name: string;
    description: string | null;
    unit: string | null;
    quantity: number;
    unit_price: number;
    amount: number;
  }[];
  taxRate: number;
  expenses: number;
} | null> {
  const supabase = await createClient();

  // 請求書情報を取得
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("tax_rate, expenses")
    .eq("id", invoiceId)
    .single();

  if (invoiceError || !invoice) {
    console.error("Error fetching invoice:", invoiceError);
    return null;
  }

  // 明細項目を取得
  const { data: items, error: itemsError } = await supabase
    .from("invoice_items")
    .select("item_template_id, category_name, name, description, unit, quantity, unit_price, amount")
    .eq("invoice_id", invoiceId)
    .order("sort_order", { ascending: true });

  if (itemsError) {
    console.error("Error fetching invoice items:", itemsError);
    return null;
  }

  return {
    items: (items || []).map((item) => ({
      item_template_id: item.item_template_id,
      category_name: item.category_name,
      name: item.name,
      description: item.description,
      unit: item.unit,
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: item.amount,
    })),
    taxRate: invoice.tax_rate || 0.1,
    expenses: invoice.expenses || 0,
  };
}
