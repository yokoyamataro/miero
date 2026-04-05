import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkCalendarSets, getEmployeesWithCalendarSet } from "./actions";
import { WorkCalendarManager } from "./work-calendar-manager";

export default async function WorkCalendarsPage() {
  const supabase = await createClient();

  // 認証確認
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 権限確認（adminのみ）
  const { data: employee } = await supabase
    .from("employees")
    .select("role")
    .eq("auth_id", user.id)
    .single();

  if (!employee || employee.role !== "admin") {
    redirect("/");
  }

  // データ取得
  const [calendarSets, employees] = await Promise.all([
    getWorkCalendarSets(),
    getEmployeesWithCalendarSet(),
  ]);

  return (
    <div className="container mx-auto py-6 max-w-6xl">
      <h1 className="text-2xl font-bold mb-6">勤怠カレンダー設定</h1>
      <WorkCalendarManager
        initialSets={calendarSets}
        employees={employees}
      />
    </div>
  );
}
