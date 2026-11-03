import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CustomerTabs } from "./customer-tabs";
import type {
  Account,
  Contact,
  Customer,
  Employee,
  DocumentTemplate,
} from "@/types/database";

export default async function CustomersPage() {
  const supabase = await createClient();

  // ログインユーザーのemployee_idを取得
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

  // 新: customers 統合テーブル (顧客一覧タブ用)
  const { data: customersData } = await supabase
    .from("customers")
    .select("*")
    .is("deleted_at", null)
    .order("display_name_kana", { ascending: true });

  // 旧: accounts/contacts (文書作成タブ用、Phase 3-5 で統合予定)
  const { data: accounts } = await supabase
    .from("accounts" as never)
    .select("*")
    .is("deleted_at", null)
    .order("company_name_kana");

  const { data: individuals } = await supabase
    .from("contacts" as never)
    .select("*")
    .is("account_id", null)
    .is("deleted_at", null)
    .order("last_name_kana");

  const { data: allContacts } = await supabase
    .from("contacts" as never)
    .select("*")
    .is("deleted_at", null)
    .order("last_name_kana");

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
        accounts={(accounts || []) as Account[]}
        individuals={(individuals || []) as Contact[]}
        allContacts={(allContacts || []) as Contact[]}
        employees={(employees || []) as Employee[]}
        templates={(templates || []) as DocumentTemplate[]}
        currentEmployeeId={currentEmployeeId}
      />
    </main>
  );
}
