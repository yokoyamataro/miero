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
  type StakeholderTag,
  type ProjectStakeholderWithDetails,
  type BusinessEntity,
} from "@/types/database";
import { TaskList } from "./task-list";
import { CommentSection } from "./comment-section";
import { ProjectInfo, type CustomerData, type CorporateContact } from "./project-info";
import { StakeholderSection } from "./stakeholder-section";
import { ProjectNotes } from "./project-notes";
import { InvoiceSection } from "./invoice-section";
import { getCurrentEmployeeId, getStakeholderTags, getProjectStakeholders, getIndustries } from "./actions";
import { getBusinessEntities, getProjectInvoices } from "@/app/invoices/actions";



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
    stakeholderTags,
    projectStakeholders,
    industries,
    businessEntities,
    projectInvoices,
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
    getStakeholderTags(),
    getProjectStakeholders(id),
    getIndustries(),
    getBusinessEntities(),
    getProjectInvoices(id),
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

  // タスクの時間集計
  const taskTimeTotals = {
    estimatedMinutes: typedTasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0),
    actualMinutes: typedTasks.reduce((sum, t) => sum + (t.actual_minutes || 0), 0),
  };

  // 顧客データを作成（法人→担当者の2段階選択用）
  const contactsByAccountId = typedAllContacts
    .filter((c) => c.account_id)
    .reduce((acc, c) => {
      const accountId = c.account_id!;
      if (!acc[accountId]) acc[accountId] = [];
      acc[accountId].push({
        id: c.id,
        name: `${c.last_name} ${c.first_name}`,
      });
      return acc;
    }, {} as Record<string, CorporateContact[]>);

  const customerData: CustomerData = {
    accounts: typedAllAccounts.map((a) => ({
      id: a.id,
      companyName: a.company_name,
      contacts: contactsByAccountId[a.id] || [],
    })),
    individuals: typedAllContacts
      .filter((c) => !c.account_id)
      .map((c) => ({
        id: c.id,
        name: `${c.last_name} ${c.first_name}`,
      })),
  };

  // コメントIDごとの確認者リストを作成
  const acknowledgementsByCommentId = typedAcknowledgements.reduce((acc, ack) => {
    if (!acc[ack.comment_id]) acc[ack.comment_id] = [];
    acc[ack.comment_id].push(ack);
    return acc;
  }, {} as Record<string, CommentAcknowledgement[]>);


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
        <div className="lg:col-span-1 space-y-6">
          <ProjectInfo
            project={typedProject}
            contact={typedContact}
            account={typedAccount}
            manager={typedManager}
            employees={typedEmployees}
            customerData={customerData}
            currentEmployeeId={currentEmployeeId}
            taskTimeTotals={taskTimeTotals}
            industries={industries}
            stakeholderSection={
              <StakeholderSection
                projectId={id}
                stakeholders={projectStakeholders}
                tags={stakeholderTags}
                customerData={customerData}
              />
            }
          />

          {/* 請求管理セクション */}
          <InvoiceSection
            projectId={id}
            projectCode={typedProject.code}
            invoices={projectInvoices}
            businessEntities={businessEntities}
            employees={typedEmployees}
            customerData={customerData}
            defaultRecipientContactId={typedProject.contact_id}
          />
        </div>

        {/* 右カラム: ノート & タスク & コメント */}
        <div className="lg:col-span-2 space-y-6">
          <ProjectNotes
            projectId={id}
            notes={typedProject.notes}
          />

          <TaskList
            projectId={id}
            tasks={typedTasks}
            employees={typedEmployees}
            defaultAssigneeId={typedProject.manager_id}
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
