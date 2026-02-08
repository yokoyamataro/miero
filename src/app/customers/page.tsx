import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { CustomerTabs } from "./customer-tabs";
import type { Account, Contact, Employee, DocumentTemplate } from "@/types/database";

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

  // 法人一覧を取得
  const { data: accounts } = await supabase
    .from("accounts" as never)
    .select("*, contacts(*)")
    .is("deleted_at", null)
    .order("company_name_kana");

  // 個人顧客一覧を取得（account_idがnullのcontacts）
  const { data: individuals } = await supabase
    .from("contacts" as never)
    .select("*")
    .is("account_id", null)
    .is("deleted_at", null)
    .order("last_name_kana");

  // 全連絡先を取得（法人担当者含む）
  const { data: allContacts } = await supabase
    .from("contacts" as never)
    .select("*")
    .is("deleted_at", null)
    .order("last_name_kana");

  // 社員一覧を取得
  const { data: employees } = await supabase
    .from("employees")
    .select("id, name, email, role, created_at, updated_at")
    .order("name");

  // テンプレート一覧を取得
  const { data: templates } = await supabase
    .from("document_templates")
    .select("*")
    .order("sort_order");

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">顧客管理</h1>
        <div className="flex gap-2">
          <Link href="/accounts/new">
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              法人登録
            </Button>
          </Link>
          <Link href="/contacts/new">
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              個人登録
            </Button>
          </Link>
        </div>
      </div>

      <CustomerTabs
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
