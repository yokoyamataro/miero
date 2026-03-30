import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getWorkflowTemplates, getTemplateItems, getWorkflowProjects } from "@/app/workflow/actions";
import { MobileWorkflowView } from "./mobile-workflow-view";

export default async function MobileWorkflowPage() {
  const supabase = await createClient();

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
    <MobileWorkflowView
      templates={templates}
      initialTemplateId={initialTemplateId}
      initialItems={initialItems}
      initialProjects={initialProjects}
    />
  );
}
