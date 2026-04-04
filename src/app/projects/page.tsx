import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployeeId } from "@/app/calendar/actions";
import { CSVActions } from "./csv-actions";
import { ProjectList } from "./project-list";
import { ProjectListWrapper } from "./project-list-wrapper";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const currentEmployeeId = await getCurrentEmployeeId();

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

  // contact_id → 表示名のマップを作成（法人名または個人名のみ）
  const contactDisplayMap: Record<string, string> = {};
  for (const [id, contact] of Object.entries(contactMap)) {
    if (contact.account_id) {
      const account = accountMap[contact.account_id];
      contactDisplayMap[id] = account ? account.company_name : `${contact.last_name} ${contact.first_name}`;
    } else {
      contactDisplayMap[id] = `${contact.last_name} ${contact.first_name}`;
    }
  }

  // account_id → 表示名のマップを作成（法人顧客の直接参照用）
  const accountDisplayMap: Record<string, string> = {};
  for (const [id, account] of Object.entries(accountMap)) {
    accountDisplayMap[id] = account.company_name;
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

  // 2週間以内の閲覧履歴を取得（自分のもののみ）
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const { data: recentViews } = currentEmployeeId
    ? await supabase
        .from("project_views" as never)
        .select("project_id, viewed_at")
        .eq("employee_id", currentEmployeeId)
        .gte("viewed_at", twoWeeksAgo.toISOString())
        .order("viewed_at", { ascending: false })
    : { data: null };

  // 最近閲覧した業務IDのリスト（最新順）
  const recentProjectIds = (recentViews as { project_id: string; viewed_at: string }[] | null)?.map(
    (v) => v.project_id
  ) || [];

  // 標準フロー（テンプレート）を取得
  const { data: projectStandardTasks } = await supabase
    .from("project_standard_tasks" as never)
    .select("project_id, template_id");

  // テンプレート情報を取得
  const { data: templates } = await supabase
    .from("standard_task_templates" as never)
    .select("id, name, sort_order")
    .order("sort_order");

  type ProjectStandardTaskType = { project_id: string; template_id: string };
  type TemplateType = { id: string; name: string; sort_order: number };

  const templateMap = ((templates as TemplateType[]) || []).reduce((acc, t) => {
    acc[t.id] = t.name;
    return acc;
  }, {} as Record<string, string>);

  // project_id → テンプレート名の配列のマップを作成
  const standardTasksMap: Record<string, string[]> = {};
  for (const pst of (projectStandardTasks as ProjectStandardTaskType[]) || []) {
    const templateName = templateMap[pst.template_id];
    if (templateName) {
      if (!standardTasksMap[pst.project_id]) {
        standardTasksMap[pst.project_id] = [];
      }
      standardTasksMap[pst.project_id].push(templateName);
    }
  }

  // 工程表用テンプレート一覧
  const workflowTemplates = ((templates as TemplateType[]) || []).map((t) => ({
    id: t.id,
    name: t.name,
  }));

  if (error) {
    console.error("Error fetching projects:", error);
  }

  return (
    <main className="mx-auto px-4 py-8">
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

      <ProjectListWrapper
        projects={projects || []}
        contactDisplayMap={contactDisplayMap}
        accountDisplayMap={accountDisplayMap}
        employeeMap={employeeNameMap}
        recentProjectIds={recentProjectIds}
        standardTasksMap={standardTasksMap}
        workflowTemplates={workflowTemplates}
      />
    </main>
  );
}
