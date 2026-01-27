import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarView } from "./calendar-view";
import type { Project, Contact, Account, ProjectCategory } from "@/types/database";

type ViewMode = "month" | "week";

// 週の開始日（月曜日）を取得
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; view?: string; week?: string }>;
}) {
  const params = await searchParams;
  const today = new Date();
  const year = params.year ? parseInt(params.year, 10) : today.getFullYear();
  const month = params.month ? parseInt(params.month, 10) : today.getMonth() + 1;
  const viewMode: ViewMode = params.view === "week" ? "week" : "month";

  // 週表示の場合の週開始日
  let weekStart: Date;
  if (params.week) {
    weekStart = new Date(params.week);
  } else {
    weekStart = getWeekStart(new Date(year, month - 1, 1));
  }
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const supabase = await createClient();

  // 表示範囲の計算
  let rangeStart: Date;
  let rangeEnd: Date;

  if (viewMode === "week") {
    rangeStart = weekStart;
    rangeEnd = weekEnd;
  } else {
    rangeStart = new Date(year, month - 1, 1);
    rangeEnd = new Date(year, month, 0);
  }

  const rangeStartStr = rangeStart.toISOString().split("T")[0];
  const rangeEndStr = rangeEnd.toISOString().split("T")[0];

  // 該当期間に関連するプロジェクトを取得
  const { data: projects, error } = await supabase
    .from("projects")
    .select("*")
    .or(`start_date.is.null,start_date.lte.${rangeEndStr}`)
    .or(`end_date.is.null,end_date.gte.${rangeStartStr}`)
    .order("start_date", { ascending: true });

  // 連絡先と法人を取得
  const { data: contacts } = await supabase
    .from("contacts" as never)
    .select("*")
    .is("deleted_at", null);

  const { data: accounts } = await supabase
    .from("accounts" as never)
    .select("*")
    .is("deleted_at", null);

  // マップ作成
  const contactMap = ((contacts as Contact[]) || []).reduce((acc, c) => {
    acc[c.id] = c;
    return acc;
  }, {} as Record<string, Contact>);

  const accountMap = ((accounts as Account[]) || []).reduce((acc, a) => {
    acc[a.id] = a;
    return acc;
  }, {} as Record<string, Account>);

  // プロジェクトデータを整形
  const projectsWithContact = ((projects as Project[]) || []).map((project) => {
    const contact = project.contact_id ? contactMap[project.contact_id] : null;
    const account = contact?.account_id ? accountMap[contact.account_id] : null;

    let contactName = "";
    if (contact) {
      contactName = account
        ? `${account.company_name}`
        : `${contact.last_name} ${contact.first_name}`;
    }

    return {
      ...project,
      contactName,
    };
  });

  if (error) {
    console.error("Error fetching projects:", error);
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">カレンダー</h1>
        <p className="text-muted-foreground">業務スケジュールの可視化</p>
      </header>

      {error && (
        <Card className="mb-6 border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">データの取得に失敗しました: {error.message}</p>
          </CardContent>
        </Card>
      )}

      <CalendarView
        year={year}
        month={month}
        projects={projectsWithContact}
        viewMode={viewMode}
        weekStart={weekStart.toISOString().split("T")[0]}
      />
    </main>
  );
}
