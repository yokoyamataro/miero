import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CustomerTabs } from "./customer-tabs";
import type { Customer, Employee, DocumentTemplate } from "@/types/database";

export default async function CustomersPage() {
  const supabase = await createClient();

  // ログインユーザーの employee_id を取得
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let currentEmployeeId: string | null = null;
  if (user) {
    const adminClient = createAdminClient();
    const { data: employee } = await adminClient
      .from("employees")
      .select("id")
      .eq("auth_id", user.id)
      .single();
    currentEmployeeId = employee?.id || null;
  }

  // customers 統合テーブル (顧客一覧 + 文書作成タブ 両方で使用)
  const { data: customersData } = await supabase
    .from("customers")
    .select("*")
    .is("deleted_at", null)
    .order("display_name_kana", { ascending: true });

  const { data: employees } = await supabase
    .from("employees")
    .select("id, name, email, role, created_at, updated_at")
    .order("name");

  const { data: templates } = await supabase
    .from("document_templates")
    .select("*")
    .order("sort_order");

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">顧客管理</h1>
      </div>

      <CustomerTabs
        customers={(customersData || []) as Customer[]}
        employees={(employees || []) as Employee[]}
        templates={(templates || []) as DocumentTemplate[]}
        currentEmployeeId={currentEmployeeId}
      />
    </main>
  );
}
