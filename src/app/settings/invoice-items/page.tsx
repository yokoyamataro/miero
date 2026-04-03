import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { InvoiceItemManager } from "./invoice-item-manager";
import type { InvoiceTemplateWithCategories, InvoiceDocumentType } from "@/types/database";

export default async function InvoiceItemsPage() {
  const supabase = await createClient();

  // ログインユーザーの権限確認
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 管理者権限確認
  const { data: employee } = await supabase
    .from("employees")
    .select("role")
    .eq("auth_id", user.id)
    .single();

  if (!employee || employee.role !== "admin") {
    redirect("/");
  }

  // テンプレート一覧取得
  const { data: invoiceTemplates } = await supabase
    .from("invoice_templates")
    .select("*")
    .order("sort_order");

  // テンプレートIDを取得
  const templateIds = (invoiceTemplates || []).map((t: { id: string }) => t.id);

  // カテゴリ一覧取得
  const { data: categories } = templateIds.length > 0
    ? await supabase
        .from("invoice_item_categories")
        .select("*")
        .in("template_id", templateIds)
        .order("sort_order")
    : { data: [] };

  // カテゴリIDを取得
  const categoryIds = (categories || []).map((c: { id: string }) => c.id);

  // 項目一覧取得
  const { data: items } = categoryIds.length > 0
    ? await supabase
        .from("invoice_item_templates")
        .select("*")
        .in("category_id", categoryIds)
        .order("sort_order")
    : { data: [] };

  // 型定義
  type TemplateType = {
    id: string;
    name: string;
    document_type: InvoiceDocumentType;
    sort_order: number;
    created_at: string;
    updated_at: string;
  };
  type CategoryType = {
    id: string;
    template_id: string;
    name: string;
    sort_order: number;
    created_at: string;
    updated_at: string;
  };
  type ItemType = {
    id: string;
    category_id: string;
    name: string;
    description: string | null;
    default_note: string | null;
    default_unit: string | null;
    default_unit_price: number | null;
    sort_order: number;
    created_at: string;
    updated_at: string;
  };

  // テンプレートにカテゴリと項目を紐付け
  const templatesWithCategories: InvoiceTemplateWithCategories[] = (
    invoiceTemplates as TemplateType[] || []
  ).map((template) => ({
    ...template,
    categories: (categories as CategoryType[] || [])
      .filter((category) => category.template_id === template.id)
      .map((category) => ({
        ...category,
        items: (items as ItemType[] || []).filter(
          (item) => item.category_id === category.id
        ),
      })),
  }));

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">見積・請求テンプレート</h1>
      <p className="text-muted-foreground mb-6">
        見積書・請求書で使用するテンプレートを管理します。
        テンプレートごとに種別と項目を設定し、標準単価を設定できます。
      </p>
      <InvoiceItemManager templates={templatesWithCategories} />
    </main>
  );
}
