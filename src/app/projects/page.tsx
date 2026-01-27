import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  PROJECT_CATEGORY_LABELS,
  PROJECT_STATUS_COLORS,
  type ProjectCategory,
  type ProjectStatus,
} from "@/types/database";
import { ProjectFilters } from "./project-filters";

// 日付フォーマット
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

// 金額フォーマット
function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return "-";
  return `¥${amount.toLocaleString()}`;
}

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

  // 担当者マップを作成
  const { data: employeesData } = await supabase
    .from("employees")
    .select("id, name");

  type EmployeeType = { id: string; name: string };
  const employeeMap = ((employeesData as EmployeeType[]) || []).reduce((acc, e) => {
    acc[e.id] = e;
    return acc;
  }, {} as Record<string, EmployeeType>);

  // ヘルパー関数
  const getContactDisplay = (contactId: string | null) => {
    if (!contactId) return "-";
    const contact = contactMap[contactId];
    if (!contact) return "-";
    const name = `${contact.last_name} ${contact.first_name}`;
    if (contact.account_id) {
      const account = accountMap[contact.account_id];
      return account ? `${account.company_name} (${name})` : name;
    }
    return name;
  };

  // 担当者リストを取得（フィルター用）
  const { data: employees } = await supabase
    .from("employees")
    .select("id, name")
    .order("name");

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
        <Link href="/projects/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            新規登録
          </Button>
        </Link>
      </header>

      {/* フィルター */}
      <ProjectFilters employees={employees || []} />

      {/* 業務リスト */}
      <div className="space-y-4">
        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">データの取得に失敗しました: {error.message}</p>
            </CardContent>
          </Card>
        )}

        {projects && projects.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground py-8">
                業務データがありません。新規登録してください。
              </p>
            </CardContent>
          </Card>
        )}

        {projects && projects.map((project) => (
          <Link key={project.id} href={`/projects/${project.id}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-muted-foreground">
                      {project.code}
                    </span>
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                  </div>
                  <div className="flex gap-2">
                    <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                      {PROJECT_CATEGORY_LABELS[project.category as ProjectCategory]}
                    </Badge>
                    <Badge className={PROJECT_STATUS_COLORS[project.status as ProjectStatus]}>
                      {project.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 text-sm md:grid-cols-4">
                  <div>
                    <span className="text-muted-foreground">顧客: </span>
                    {getContactDisplay(project.contact_id)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">担当: </span>
                    {project.manager_id ? employeeMap[project.manager_id]?.name || "-" : "-"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">期間: </span>
                    {formatDate(project.start_date)}
                    {project.end_date && ` 〜 ${formatDate(project.end_date)}`}
                  </div>
                  <div>
                    <span className="text-muted-foreground">報酬: </span>
                    {formatCurrency(project.fee_tax_excluded)}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
