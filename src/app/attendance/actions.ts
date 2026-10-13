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

// =============================================
// 自分のタイムカード（月次履歴 + サマリー）
// =============================================

export interface AttendanceRow {
  id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  break_minutes: number;
  status: AttendanceStatus;
  note: string | null;
}

export interface MonthlySummary {
  workDays: number;
  holidayWorkDays: number;
  paidLeaveDays: number;
  absenceDays: number;
  totalWorkMinutes: number;
  totalBreakMinutes: number;
}

function emptySummary(): MonthlySummary {
  return {
    workDays: 0,
    holidayWorkDays: 0,
    paidLeaveDays: 0,
    absenceDays: 0,
    totalWorkMinutes: 0,
    totalBreakMinutes: 0,
  };
}

export async function getMyMonthlyAttendance(
  year: number,
  month: number
): Promise<{ rows: AttendanceRow[]; summary: MonthlySummary }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { rows: [], summary: emptySummary() };

  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();

  const employeeId = (employee as { id: string } | null)?.id;
  if (!employeeId) return { rows: [], summary: emptySummary() };

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("attendance_daily")
    .select("id, date, clock_in, clock_out, break_minutes, status, note")
    .eq("employee_id", employeeId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });

  if (error) {
    console.error("Error fetching monthly attendance:", error);
    return { rows: [], summary: emptySummary() };
  }

  const rows = (data || []) as AttendanceRow[];

  const summary: MonthlySummary = emptySummary();
  for (const r of rows) {
    switch (r.status) {
      case "Work":
        if (r.clock_in && r.clock_out) summary.workDays += 1;
        break;
      case "HolidayWork":
        if (r.clock_in && r.clock_out) summary.holidayWorkDays += 1;
        break;
      case "PaidLeave":
        summary.paidLeaveDays += 1;
        break;
      case "Absence":
        summary.absenceDays += 1;
        break;
    }

    if (r.clock_in && r.clock_out) {
      const inMs = new Date(r.clock_in).getTime();
      const outMs = new Date(r.clock_out).getTime();
      const totalMin = Math.max(0, Math.floor((outMs - inMs) / 60000));
      const breakMin = r.break_minutes ?? 0;
      summary.totalWorkMinutes += Math.max(0, totalMin - breakMin);
      summary.totalBreakMinutes += breakMin;
    }
  }

  return { rows, summary };
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
