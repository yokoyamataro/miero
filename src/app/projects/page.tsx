import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CSVActions } from "./csv-actions";
import { ProjectList } from "./project-list";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const supabase = await createClient();

  // 業務データを取得
  const { data: projects, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  // 連絡先を取得
  const { data: contacts } = await supabase
    .from("contacts" as never)
    .select("*")
    .is("deleted_at", null);

  // 法人を取得
  const { data: accountsData } = await supabase
    .from("accounts" as never)
    .select("*")
    .is("deleted_at", null);

  // 連絡先と法人のマップを作成
  type ContactType = { id: string; last_name: string; first_name: string; account_id: string | null };
  type AccountType = { id: string; company_name: string };

  const contactMap = ((contacts as ContactType[]) || []).reduce((acc, c) => {
    acc[c.id] = c;
    return acc;
  }, {} as Record<string, ContactType>);

  const accountMap = ((accountsData as AccountType[]) || []).reduce((acc, a) => {
    acc[a.id] = a;
    return acc;
  }, {} as Record<string, AccountType>);

  // contact_id → 表示名のマップを作成
  const contactDisplayMap: Record<string, string> = {};
  for (const [id, contact] of Object.entries(contactMap)) {
    const name = `${contact.last_name} ${contact.first_name}`;
    if (contact.account_id) {
      const account = accountMap[contact.account_id];
      contactDisplayMap[id] = account ? `${account.company_name} (${name})` : name;
    } else {
      contactDisplayMap[id] = name;
    }
  }

  // 担当者マップを作成
  const { data: employeesData } = await supabase
    .from("employees")
    .select("id, name")
    .order("name");

  type EmployeeType = { id: string; name: string };
  const employees = (employeesData as EmployeeType[]) || [];
  const employeeNameMap: Record<string, string> = {};
  for (const e of employees) {
    employeeNameMap[e.id] = e.name;
  }

  if (error) {
    console.error("Error fetching projects:", error);
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold">業務一覧</h1>
          <p className="text-muted-foreground">全業務の検索・閲覧・登録</p>
        </div>
        <div className="flex items-center gap-2">
          <CSVActions />
          <Link href="/projects/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新規登録
            </Button>
          </Link>
        </div>
      </header>

      {error && (
        <Card className="mb-6 border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">データの取得に失敗しました: {error.message}</p>
          </CardContent>
        </Card>
      )}

      <ProjectList
        projects={projects || []}
        employees={employees}
        contactDisplayMap={contactDisplayMap}
        employeeMap={employeeNameMap}
      />
    </main>
  );
}
