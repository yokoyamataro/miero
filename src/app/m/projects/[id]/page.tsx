import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { MobileProjectDetail } from "./mobile-project-detail";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MobileProjectDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  // プロジェクト詳細を取得
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (!project) {
    notFound();
  }

  // タスク一覧を取得
  const { data: tasks } = await supabase
    .from("tasks" as never)
    .select("*")
    .eq("project_id", id)
    .order("sort_order", { ascending: true });

  // 社員情報
  const { data: employees } = await supabase
    .from("employees")
    .select("id, name");

  // 連絡先情報
  type ContactType = { id: string; last_name: string; first_name: string; account_id: string | null };
  type AccountType = { id: string; company_name: string };

  let customerName: string | null = null;
  if (project.contact_id) {
    const { data: contact } = await supabase
      .from("contacts" as never)
      .select("id, last_name, first_name, account_id")
      .eq("id", project.contact_id)
      .single();

    if (contact) {
      const typedContact = contact as ContactType;
      if (typedContact.account_id) {
        const { data: account } = await supabase
          .from("accounts" as never)
          .select("id, company_name")
          .eq("id", typedContact.account_id)
          .single();
        const typedAccount = account as AccountType | null;
        customerName = typedAccount?.company_name || `${typedContact.last_name} ${typedContact.first_name}`;
      } else {
        customerName = `${typedContact.last_name} ${typedContact.first_name}`;
      }
    }
  }

  const employeeMap: Record<string, string> = {};
  (employees || []).forEach((e) => {
    employeeMap[e.id] = e.name;
  });

  return (
    <MobileProjectDetail
      project={project}
      tasks={tasks || []}
      customerName={customerName}
      employeeMap={employeeMap}
    />
  );
}
