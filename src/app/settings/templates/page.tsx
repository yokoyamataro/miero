import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TemplateManager } from "./template-manager";
import type { DocumentTemplate } from "@/types/database";

export default async function TemplatesPage() {
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
    .from("document_templates")
    .select("*")
    .order("sort_order");

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">文書テンプレート管理</h1>
      <TemplateManager templates={(templates || []) as DocumentTemplate[]} />
    </main>
  );
}
