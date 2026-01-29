import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, MapPin, User, Calendar, CircleDollarSign, Building2 } from "lucide-react";
import {
  PROJECT_CATEGORY_LABELS,
  PROJECT_STATUS_COLORS,
  type ProjectCategory,
  type ProjectStatus,
  type Project,
  type Contact,
  type Account,
  type Employee,
  type Task,
  type Comment,
  type CommentAcknowledgement,
} from "@/types/database";
import { TaskList } from "./task-list";
import { CommentSection } from "./comment-section";
import { getCurrentEmployeeId } from "./actions";

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

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // プロジェクト取得
  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !project) {
    notFound();
  }

  // 関連データを並列取得
  const [
    { data: contact },
    { data: account },
    { data: manager },
    { data: tasks },
    { data: comments },
    { data: employees },
    { data: acknowledgements },
    currentEmployeeId,
  ] = await Promise.all([
    project.contact_id
      ? supabase.from("contacts" as never).select("*").eq("id", project.contact_id).single()
      : Promise.resolve({ data: null }),
    (async () => {
      if (!project.contact_id) return { data: null };
      const { data: c } = await supabase
        .from("contacts" as never)
        .select("account_id")
        .eq("id", project.contact_id)
        .single();
      if (!c || !(c as { account_id: string | null }).account_id) return { data: null };
      return supabase
        .from("accounts" as never)
        .select("*")
        .eq("id", (c as { account_id: string }).account_id)
        .single();
    })(),
    project.manager_id
      ? supabase.from("employees").select("*").eq("id", project.manager_id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from("tasks" as never)
      .select("*")
      .eq("project_id", id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("comments" as never)
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("employees").select("*").order("name"),
    supabase.from("comment_acknowledgements" as never).select("*"),
    getCurrentEmployeeId(),
  ]);

  const typedProject = project as Project;
  const typedContact = contact as Contact | null;
  const typedAccount = account as Account | null;
  const typedManager = manager as Employee | null;
  const typedTasks = (tasks as Task[]) || [];
  const typedComments = (comments as Comment[]) || [];
  const typedEmployees = (employees as Employee[]) || [];
  const typedAcknowledgements = (acknowledgements as CommentAcknowledgement[]) || [];

  // コメントIDごとの確認者リストを作成
  const acknowledgementsByCommentId = typedAcknowledgements.reduce((acc, ack) => {
    if (!acc[ack.comment_id]) acc[ack.comment_id] = [];
    acc[ack.comment_id].push(ack);
    return acc;
  }, {} as Record<string, CommentAcknowledgement[]>);

  // 親タスクとサブタスクを整理
  const parentTasks = typedTasks.filter((t) => !t.parent_id);
  const subtaskMap = typedTasks.reduce((acc, t) => {
    if (t.parent_id) {
      if (!acc[t.parent_id]) acc[t.parent_id] = [];
      acc[t.parent_id].push(t);
    }
    return acc;
  }, {} as Record<string, Task[]>);

  const tasksWithSubtasks = parentTasks.map((t) => ({
    ...t,
    subtasks: subtaskMap[t.id] || [],
  }));

  // 顧客表示名
  const customerName = typedContact
    ? typedAccount
      ? `${typedAccount.company_name} (${typedContact.last_name} ${typedContact.first_name})`
      : `${typedContact.last_name} ${typedContact.first_name}`
    : "-";

  return (
    <main className="container mx-auto px-4 py-8">
      <header className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/projects">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              一覧に戻る
            </Button>
          </Link>
        </div>
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="font-mono text-muted-foreground">{typedProject.code}</span>
              <Badge className="bg-blue-100 text-blue-800">
                {PROJECT_CATEGORY_LABELS[typedProject.category]}
              </Badge>
              <Badge className={PROJECT_STATUS_COLORS[typedProject.status]}>
                {typedProject.status}
              </Badge>
            </div>
            <h1 className="text-2xl font-bold">{typedProject.name}</h1>
          </div>
          <Link href={`/projects/${id}/edit`}>
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              編集
            </Button>
          </Link>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 左カラム: 基本情報 */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">基本情報</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm text-muted-foreground">顧客</div>
                  <div>{customerName}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm text-muted-foreground">担当者</div>
                  <div>{typedManager?.name || "-"}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm text-muted-foreground">期間</div>
                  <div>
                    {formatDate(typedProject.start_date)}
                    {typedProject.end_date && ` 〜 ${formatDate(typedProject.end_date)}`}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CircleDollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm text-muted-foreground">報酬（税抜）</div>
                  <div>{formatCurrency(typedProject.fee_tax_excluded)}</div>
                </div>
              </div>

              {typedProject.location && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-sm text-muted-foreground">所在地</div>
                    <div>{typedProject.location}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* カテゴリ別詳細 */}
          {typedProject.details && Object.keys(typedProject.details).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">カテゴリ別詳細</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-2 text-sm">
                  {Object.entries(typedProject.details).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <dt className="text-muted-foreground">{key}</dt>
                      <dd>{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          )}
        </div>

        {/* 右カラム: タスク & コメント */}
        <div className="lg:col-span-2 space-y-6">
          <TaskList
            projectId={id}
            tasks={tasksWithSubtasks}
            employees={typedEmployees}
          />

          <CommentSection
            projectId={id}
            comments={typedComments}
            employees={typedEmployees}
            acknowledgementsByCommentId={acknowledgementsByCommentId}
            currentEmployeeId={currentEmployeeId}
          />
        </div>
      </div>
    </main>
  );
}
