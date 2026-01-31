import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import {
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
import { ProjectInfo, type ContactOption } from "./project-info";
import { getCurrentEmployeeId } from "./actions";



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
    { data: allContacts },
    { data: allAccounts },
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
    // 顧客選択用：全連絡先を取得
    supabase.from("contacts" as never).select("*").is("deleted_at", null).order("last_name"),
    // 顧客選択用：全法人を取得
    supabase.from("accounts" as never).select("*").is("deleted_at", null),
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
  const typedAllContacts = (allContacts as Contact[]) || [];
  const typedAllAccounts = (allAccounts as Account[]) || [];

  // 顧客選択肢を作成
  const accountMap = typedAllAccounts.reduce((acc, a) => {
    acc[a.id] = a;
    return acc;
  }, {} as Record<string, Account>);

  const contactOptions: ContactOption[] = typedAllContacts.map((c) => {
    const acc = c.account_id ? accountMap[c.account_id] : null;
    return {
      id: c.id,
      name: `${c.last_name} ${c.first_name}`,
      type: c.account_id ? "corporate" : "individual",
      companyName: acc?.company_name,
    };
  });

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
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 左カラム: 基本情報（インライン編集可能） */}
        <div className="lg:col-span-1">
          <ProjectInfo
            project={typedProject}
            contact={typedContact}
            account={typedAccount}
            manager={typedManager}
            employees={typedEmployees}
            contactOptions={contactOptions}
          />
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
