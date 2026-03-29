import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { StandardTaskManager } from "./standard-task-manager";
import type { StandardTaskTemplateWithItems } from "@/types/database";

export default async function StandardTasksPage() {
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
  const { data: templates } = await supabase
    .from("standard_task_templates" as never)
    .select("*")
    .order("sort_order");

  // 各テンプレートの項目を取得
  const templateIds = (templates || []).map((t: { id: string }) => t.id);
  const { data: items } = templateIds.length > 0
    ? await supabase
        .from("standard_task_items" as never)
        .select("*")
        .in("template_id", templateIds)
        .order("sort_order")
    : { data: [] };

  // テンプレートに項目を紐付け
  type TemplateType = { id: string; name: string; sort_order: number; created_at: string; updated_at: string };
  type ItemType = { id: string; template_id: string; title: string; sort_order: number; created_at: string };

  const templatesWithItems: StandardTaskTemplateWithItems[] = (templates as TemplateType[] || []).map((template) => ({
    ...template,
    items: (items as ItemType[] || []).filter((item) => item.template_id === template.id),
  }));

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">標準業務管理</h1>
      <p className="text-muted-foreground mb-6">
        業務に割り当て可能な標準業務テンプレートを管理します。
      </p>
      <StandardTaskManager templates={templatesWithItems} />
    </main>
  );
}
