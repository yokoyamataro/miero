import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { InvoiceItemManager } from "./invoice-item-manager";
import type { InvoiceItemCategoryWithTemplates } from "@/types/database";

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

  // カテゴリ一覧取得
  const { data: categories } = await supabase
    .from("invoice_item_categories")
    .select("*")
    .order("sort_order");

  // 各カテゴリの項目を取得
  const categoryIds = (categories || []).map((c: { id: string }) => c.id);
  const { data: templates } = categoryIds.length > 0
    ? await supabase
        .from("invoice_item_templates")
        .select("*")
        .in("category_id", categoryIds)
        .order("sort_order")
    : { data: [] };

  // カテゴリに項目を紐付け
  type CategoryType = {
    id: string;
    name: string;
    sort_order: number;
    created_at: string;
    updated_at: string;
  };
  type TemplateType = {
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

  const categoriesWithTemplates: InvoiceItemCategoryWithTemplates[] = (
    categories as CategoryType[] || []
  ).map((category) => ({
    ...category,
    templates: (templates as TemplateType[] || []).filter(
      (template) => template.category_id === category.id
    ),
  }));

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">請求項目マスタ</h1>
      <p className="text-muted-foreground mb-6">
        見積書・請求書で使用する項目のテンプレートを管理します。
        種別ごとに項目をグループ化し、標準単価を設定できます。
      </p>
      <InvoiceItemManager categories={categoriesWithTemplates} />
    </main>
  );
}
