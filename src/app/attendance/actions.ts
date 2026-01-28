"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// 今日の勤怠レコードを取得
export async function getTodayAttendance() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // auth_idから社員IDを取得
  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_id", user.id)
    .single();

  if (!employee) return null;

  const today = new Date().toISOString().split("T")[0];

  const { data: attendance } = await supabase
    .from("attendance_daily")
    .select("*")
    .eq("employee_id", employee.id)
    .eq("date", today)
    .single();

  return { attendance, employeeId: employee.id };
}

// 出勤打刻
export async function clockIn() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "ログインが必要です" };

  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_id", user.id)
    .single();

  if (!employee) return { error: "社員情報が見つかりません" };

  const today = new Date().toISOString().split("T")[0];
  const now = new Date().toISOString();

  // 既存レコードをチェック
  const { data: existing } = await supabase
    .from("attendance_daily")
    .select("id, clock_in")
    .eq("employee_id", employee.id)
    .eq("date", today)
    .single();

  if (existing?.clock_in) {
    return { error: "既に出勤打刻済みです" };
  }

  if (existing) {
    // 既存レコードを更新
    const { error } = await supabase
      .from("attendance_daily")
      .update({ clock_in: now })
      .eq("id", existing.id);

    if (error) return { error: error.message };
  } else {
    // 新規レコードを作成
    const { error } = await supabase
      .from("attendance_daily")
      .insert({
        employee_id: employee.id,
        date: today,
        clock_in: now,
        status: "Work",
      });

    if (error) return { error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}

// 退勤打刻
export async function clockOut() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "ログインが必要です" };

  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_id", user.id)
    .single();

  if (!employee) return { error: "社員情報が見つかりません" };

  const today = new Date().toISOString().split("T")[0];
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("attendance_daily")
    .select("id, clock_in, clock_out")
    .eq("employee_id", employee.id)
    .eq("date", today)
    .single();

  if (!existing?.clock_in) {
    return { error: "出勤打刻がありません" };
  }

  if (existing?.clock_out) {
    return { error: "既に退勤打刻済みです" };
  }

  const { error } = await supabase
    .from("attendance_daily")
    .update({ clock_out: now })
    .eq("id", existing.id);

  if (error) return { error: error.message };

  revalidatePath("/");
  return { success: true, attendanceId: existing.id };
}

// 工数を保存
export async function saveWorkLogs(
  attendanceId: string,
  logs: { projectId: string; minutes: number; comment?: string }[]
) {
  const supabase = await createClient();

  // 既存の工数ログを削除
  await supabase
    .from("work_logs")
    .delete()
    .eq("attendance_id", attendanceId);

  // 新しい工数ログを挿入
  const inserts = logs.map((log) => ({
    attendance_id: attendanceId,
    project_id: log.projectId,
    minutes: log.minutes,
    comment: log.comment || null,
  }));

  const { error } = await supabase
    .from("work_logs")
    .insert(inserts);

  if (error) return { error: error.message };

  revalidatePath("/");
  return { success: true };
}

// 進行中の業務を取得
export async function getActiveProjects() {
  const supabase = await createClient();

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, code, name, status")
    .in("status", ["受注", "着手", "進行中"])
    .is("deleted_at", null)
    .order("code", { ascending: false });

  if (error) return { error: error.message };
  return { projects };
}
