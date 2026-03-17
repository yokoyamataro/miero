import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployeeId } from "@/app/calendar/actions";
import { MobileProjectList } from "./mobile-project-list";

export default async function MobileProjectsPage() {
  const supabase = await createClient();
  const currentEmployeeId = await getCurrentEmployeeId();

  // 業務一覧を取得（進行中のみ、担当者でフィルタ可能）
  const { data: projects } = await supabase
    .from("projects")
    .select("id, code, category, name, status, is_urgent, is_on_hold, contact_id, manager_id, location, location_detail")
    .eq("status", "進行中")
    .order("code", { ascending: false })
    .limit(100);

  // 社員一覧
  const { data: employees } = await supabase
    .from("employees")
    .select("id, name")
    .order("name");

  // 連絡先と法人の情報
  const { data: contacts } = await supabase
    .from("contacts" as never)
    .select("id, last_name, first_name, account_id")
    .is("deleted_at", null);

  const { data: accounts } = await supabase
    .from("accounts" as never)
    .select("id, company_name")
    .is("deleted_at", null);

  // マップ作成
  type ContactType = { id: string; last_name: string; first_name: string; account_id: string | null };
  type AccountType = { id: string; company_name: string };

  const accountMap = new Map((accounts as AccountType[] || []).map((a) => [a.id, a.company_name]));
  const contactDisplayMap: Record<string, string> = {};
  (contacts as ContactType[] || []).forEach((c) => {
    const accountName = c.account_id ? accountMap.get(c.account_id) : null;
    contactDisplayMap[c.id] = accountName || `${c.last_name} ${c.first_name}`;
  });

  const employeeMap: Record<string, string> = {};
  (employees || []).forEach((e) => {
    employeeMap[e.id] = e.name;
  });

  return (
    <MobileProjectList
      projects={projects || []}
      employees={employees || []}
      contactDisplayMap={contactDisplayMap}
      employeeMap={employeeMap}
      currentEmployeeId={currentEmployeeId}
    />
  );
}
