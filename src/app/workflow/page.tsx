import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { WorkflowTable } from "./workflow-table";
import { getWorkflowTemplates, getTemplateItems, getWorkflowProjects, getDebugInfo } from "./actions";

export default async function WorkflowPage() {
  const supabase = await createClient();

  // ログイン確認
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // テンプレート一覧を取得
  const templates = await getWorkflowTemplates();

  // 初期表示用：最初のテンプレートを選択
  const initialTemplateId = templates.length > 0 ? templates[0].id : null;

  const [initialItems, initialProjects] = initialTemplateId
    ? await Promise.all([
        getTemplateItems(initialTemplateId),
        getWorkflowProjects(initialTemplateId),
      ])
    : [[], []];

  // デバッグ情報
  const debugInfo = initialTemplateId ? await getDebugInfo(initialTemplateId) : null;

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">工程表</h1>
      <p className="text-muted-foreground mb-6">
        標準業務ごとに進行中の業務の工程状況を確認・更新できます。
      </p>

      {/* デバッグ情報 */}
      {debugInfo && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded text-xs">
          <p><strong>デバッグ情報:</strong></p>
          <p>テンプレートID: {debugInfo.templateId}</p>
          <p>テンプレート名: {debugInfo.templateName || "取得失敗"}</p>
          <p>project_standard_tasks件数: {debugInfo.projectTasksCount}</p>
          <p>projectIds: {debugInfo.projectIds.join(", ") || "なし"}</p>
          <p>進行中プロジェクト件数: {debugInfo.activeProjectsCount}</p>
          <p>プロジェクトステータス: {debugInfo.projectStatuses.join(", ") || "なし"}</p>
          <p>getWorkflowProjects結果: {debugInfo.workflowProjectsCount}件</p>
          {debugInfo.error && (
            <p className="text-red-600 font-bold">エラー: {debugInfo.error}</p>
          )}
        </div>
      )}

      <WorkflowTable
        templates={templates}
        initialTemplateId={initialTemplateId}
        initialItems={initialItems}
        initialProjects={initialProjects}
      />
    </main>
  );
}
