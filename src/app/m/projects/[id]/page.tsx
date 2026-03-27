import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { MobileProjectDetail } from "./mobile-project-detail";

interface Props {
  params: Promise<{ id: string }>;
}

interface CalendarEvent {
  id: string;
  title: string;
  is_completed: boolean;
  start_date: string | null;
  sort_order: number;
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

  // スケジュール（calendar_events）を取得
  const { data: events } = await supabase
    .from("calendar_events")
    .select("id, title, is_completed, start_date, sort_order")
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

  // account_idが直接設定されている場合
  if (project.account_id) {
    const { data: account } = await supabase
      .from("accounts" as never)
      .select("id, company_name")
      .eq("id", project.account_id)
      .single();
    const typedAccount = account as AccountType | null;
    customerName = typedAccount?.company_name || null;
  } else if (project.contact_id) {
    // contact_id経由で取得
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
      events={(events as CalendarEvent[]) || []}
      customerName={customerName}
      employeeMap={employeeMap}
    />
  );
}
