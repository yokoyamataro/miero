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
    .select("id, clock_in, clock_out")
    .eq("employee_id", employee.id)
    .eq("date", today)
    .single();

  // 出勤済みかつ退勤していない場合はエラー
  if (existing?.clock_in && !existing?.clock_out) {
    return { error: "既に出勤打刻済みです" };
  }

  if (existing) {
    // 既存レコードを更新（再出勤の場合は退勤時刻もクリア）
    const { error } = await supabase
      .from("attendance_daily")
      .update({ clock_in: now, clock_out: null })
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
  return { success: true };
}

// 勤怠詳細を更新（休憩/備考/ステータス）
// 本日のレコードが存在しない場合は新規作成
export type AttendanceStatus = "Work" | "PaidLeave" | "Absence" | "HolidayWork";

export async function updateTodayAttendanceDetail(data: {
  breakMinutes?: number;
  note?: string | null;
  status?: AttendanceStatus;
}) {
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

  const { data: existing } = await supabase
    .from("attendance_daily")
    .select("id")
    .eq("employee_id", employee.id)
    .eq("date", today)
    .maybeSingle();

  const payload: Record<string, unknown> = {};
  if (data.breakMinutes !== undefined) payload.break_minutes = data.breakMinutes;
  if (data.note !== undefined) payload.note = data.note;
  if (data.status !== undefined) payload.status = data.status;

  if (existing) {
    const { error } = await supabase
      .from("attendance_daily")
      .update(payload)
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    // 新規作成（打刻前にステータス変更/備考を入れたいケース）
    const { error } = await supabase.from("attendance_daily").insert({
      employee_id: employee.id,
      date: today,
      status: data.status ?? "Work",
      break_minutes: data.breakMinutes ?? 0,
      note: data.note ?? null,
    });
    if (error) return { error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}

// 退勤取消
export async function cancelClockOut() {
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

  const { data: existing } = await supabase
    .from("attendance_daily")
    .select("id, clock_out")
    .eq("employee_id", employee.id)
    .eq("date", today)
    .single();

  if (!existing?.clock_out) {
    return { error: "退勤打刻がありません" };
  }

  const { error } = await supabase
    .from("attendance_daily")
    .update({ clock_out: null })
    .eq("id", existing.id);

  if (error) return { error: error.message };

  revalidatePath("/");
  return { success: true };
}
