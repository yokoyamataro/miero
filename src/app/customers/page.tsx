import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { CustomerTabs } from "./customer-tabs";

export default async function CustomersPage() {
  const supabase = await createClient();

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
        accounts={(accounts || []) as never[]}
        individuals={(individuals || []) as never[]}
      />
    </main>
  );
}
