import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { WorkflowTable } from "./workflow-table";
import { getWorkflowTemplates, getTemplateItems, getWorkflowProjects } from "./actions";

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

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">工程表</h1>
      <p className="text-muted-foreground mb-6">
        標準業務ごとに進行中の業務の工程状況を確認・更新できます。
      </p>
      <WorkflowTable
        templates={templates}
        initialTemplateId={initialTemplateId}
        initialItems={initialItems}
        initialProjects={initialProjects}
      />
    </main>
  );
}
