"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type {
  WorkCalendarSet,
  WorkCalendarHoliday,
  WorkCalendarMonthlyHours,
  WorkCalendarSetWithDetails,
  Employee,
} from "@/types/database";

// ============================================
// カレンダーセット一覧取得
// ============================================
export async function getWorkCalendarSets(): Promise<WorkCalendarSet[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("work_calendar_sets")
    .select("*")
    .order("is_default", { ascending: false })
    .order("name");

  if (error) {
    console.error("Error fetching work calendar sets:", error);
    return [];
  }

  return (data as WorkCalendarSet[]) || [];
}

// ============================================
// カレンダーセット詳細取得（休日・勤務時間含む）
// ============================================
export async function getWorkCalendarSetWithDetails(
  setId: string,
  fiscalYear: number
): Promise<WorkCalendarSetWithDetails | null> {
  const supabase = await createClient();

  // カレンダーセット取得
  const { data: set, error: setError } = await supabase
    .from("work_calendar_sets")
    .select("*")
    .eq("id", setId)
    .single();

  if (setError || !set) {
    console.error("Error fetching work calendar set:", setError);
    return null;
  }

  // 休日取得
  const { data: holidays, error: holidaysError } = await supabase
    .from("work_calendar_holidays")
    .select("*")
    .eq("calendar_set_id", setId)
    .eq("fiscal_year", fiscalYear)
    .order("holiday_date");

  if (holidaysError) {
    console.error("Error fetching holidays:", holidaysError);
  }

  // 月別勤務時間取得
  const { data: monthlyHours, error: hoursError } = await supabase
    .from("work_calendar_monthly_hours")
    .select("*")
    .eq("calendar_set_id", setId)
    .eq("fiscal_year", fiscalYear)
    .order("month");

  if (hoursError) {
    console.error("Error fetching monthly hours:", hoursError);
  }

  return {
    ...(set as WorkCalendarSet),
    holidays: (holidays as WorkCalendarHoliday[]) || [],
    monthlyHours: (monthlyHours as WorkCalendarMonthlyHours[]) || [],
  };
}

// ============================================
// カレンダーセット作成
// ============================================
export async function createWorkCalendarSet(data: {
  name: string;
  description?: string | null;
  is_default?: boolean;
}): Promise<{ set?: WorkCalendarSet; error?: string }> {
  const supabase = await createClient();

  // デフォルトに設定する場合、他のデフォルトを解除
  if (data.is_default) {
    await supabase
      .from("work_calendar_sets")
      .update({ is_default: false })
      .eq("is_default", true);
  }

  const { data: set, error } = await supabase
    .from("work_calendar_sets")
    .insert({
      name: data.name,
      description: data.description || null,
      is_default: data.is_default || false,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating work calendar set:", error);
    return { error: "カレンダーセットの作成に失敗しました" };
  }

  revalidatePath("/settings/work-calendars");
  return { set: set as WorkCalendarSet };
}

// ============================================
// カレンダーセット更新
// ============================================
export async function updateWorkCalendarSet(
  id: string,
  data: {
    name?: string;
    description?: string | null;
    is_default?: boolean;
  }
): Promise<{ error?: string }> {
  const supabase = await createClient();

  // デフォルトに設定する場合、他のデフォルトを解除
  if (data.is_default) {
    await supabase
      .from("work_calendar_sets")
      .update({ is_default: false })
      .neq("id", id);
  }

  const { error } = await supabase
    .from("work_calendar_sets")
    .update(data)
    .eq("id", id);

  if (error) {
    console.error("Error updating work calendar set:", error);
    return { error: "カレンダーセットの更新に失敗しました" };
  }

  revalidatePath("/settings/work-calendars");
  return {};
}

// ============================================
// カレンダーセット削除
// ============================================
export async function deleteWorkCalendarSet(
  id: string
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("work_calendar_sets")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting work calendar set:", error);
    return { error: "カレンダーセットの削除に失敗しました" };
  }

  revalidatePath("/settings/work-calendars");
  return {};
}

// ============================================
// 休日追加
// ============================================
export async function addHoliday(data: {
  calendar_set_id: string;
  fiscal_year: number;
  holiday_date: string;
  holiday_name?: string | null;
}): Promise<{ holiday?: WorkCalendarHoliday; error?: string }> {
  const supabase = await createClient();

  const { data: holiday, error } = await supabase
    .from("work_calendar_holidays")
    .insert(data)
    .select()
    .single();

  if (error) {
    console.error("Error adding holiday:", error);
    if (error.code === "23505") {
      return { error: "この日付は既に休日として登録されています" };
    }
    return { error: "休日の追加に失敗しました" };
  }

  revalidatePath("/settings/work-calendars");
  return { holiday: holiday as WorkCalendarHoliday };
}

// ============================================
// 休日一括追加
// ============================================
export async function addHolidaysBulk(
  holidays: {
    calendar_set_id: string;
    fiscal_year: number;
    holiday_date: string;
    holiday_name?: string | null;
  }[]
): Promise<{ count: number; error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("work_calendar_holidays")
    .upsert(holidays, { onConflict: "calendar_set_id,holiday_date" })
    .select();

  if (error) {
    console.error("Error adding holidays:", error);
    return { count: 0, error: "休日の追加に失敗しました" };
  }

  revalidatePath("/settings/work-calendars");
  return { count: data?.length || 0 };
}

// ============================================
// 休日一括同期（追加・削除）
// ============================================
export async function syncHolidays(
  calendarSetId: string,
  fiscalYear: number,
  selectedDates: string[],
  existingHolidays: { id: string; holiday_date: string; holiday_name: string | null }[]
): Promise<{ error?: string }> {
  const supabase = await createClient();

  // 削除すべき休日を特定
  const selectedSet = new Set(selectedDates);
  const holidaysToDelete = existingHolidays.filter(
    (h) => !selectedSet.has(h.holiday_date)
  );

  // 追加すべき休日を特定
  const existingDates = new Set(existingHolidays.map((h) => h.holiday_date));
  const holidaysToAdd = selectedDates
    .filter((date) => !existingDates.has(date))
    .map((date) => ({
      calendar_set_id: calendarSetId,
      fiscal_year: fiscalYear,
      holiday_date: date,
      holiday_name: null,
    }));

  // 削除実行
  if (holidaysToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("work_calendar_holidays")
      .delete()
      .in(
        "id",
        holidaysToDelete.map((h) => h.id)
      );

    if (deleteError) {
      console.error("Error deleting holidays:", deleteError);
      return { error: "休日の削除に失敗しました" };
    }
  }

  // 追加実行
  if (holidaysToAdd.length > 0) {
    const { error: insertError } = await supabase
      .from("work_calendar_holidays")
      .insert(holidaysToAdd);

    if (insertError) {
      console.error("Error adding holidays:", insertError);
      return { error: "休日の追加に失敗しました" };
    }
  }

  revalidatePath("/settings/work-calendars");
  return {};
}

// ============================================
// 休日削除
// ============================================
export async function deleteHoliday(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("work_calendar_holidays")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting holiday:", error);
    return { error: "休日の削除に失敗しました" };
  }

  revalidatePath("/settings/work-calendars");
  return {};
}

// ============================================
// 月別勤務時間設定
// ============================================
export async function setMonthlyHours(data: {
  calendar_set_id: string;
  fiscal_year: number;
  month: number;
  work_start_time: string;
  work_end_time: string;
  break_minutes: number;
}): Promise<{ hours?: WorkCalendarMonthlyHours; error?: string }> {
  const supabase = await createClient();

  const { data: hours, error } = await supabase
    .from("work_calendar_monthly_hours")
    .upsert(data, { onConflict: "calendar_set_id,fiscal_year,month" })
    .select()
    .single();

  if (error) {
    console.error("Error setting monthly hours:", error);
    return { error: "勤務時間の設定に失敗しました" };
  }

  revalidatePath("/settings/work-calendars");
  return { hours: hours as WorkCalendarMonthlyHours };
}

// ============================================
// 月別勤務時間一括設定（年度全体）
// ============================================
export async function setMonthlyHoursBulk(
  calendarSetId: string,
  fiscalYear: number,
  settings: {
    month: number;
    work_start_time: string;
    work_end_time: string;
    break_minutes: number;
  }[]
): Promise<{ count: number; error?: string }> {
  const supabase = await createClient();

  const data = settings.map((s) => ({
    calendar_set_id: calendarSetId,
    fiscal_year: fiscalYear,
    ...s,
  }));

  const { data: result, error } = await supabase
    .from("work_calendar_monthly_hours")
    .upsert(data, { onConflict: "calendar_set_id,fiscal_year,month" })
    .select();

  if (error) {
    console.error("Error setting monthly hours:", error);
    return { count: 0, error: "勤務時間の設定に失敗しました" };
  }

  revalidatePath("/settings/work-calendars");
  return { count: result?.length || 0 };
}

// ============================================
// 社員一覧取得（カレンダーセット割り当て用）
// ============================================
export async function getEmployeesWithCalendarSet(): Promise<
  (Employee & { workCalendarSet?: WorkCalendarSet | null })[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("employees")
    .select(`
      *,
      work_calendar_sets:work_calendar_set_id (*)
    `)
    .order("name");

  if (error) {
    console.error("Error fetching employees:", error);
    return [];
  }

  return (data || []).map((emp: Record<string, unknown>) => ({
    ...emp,
    workCalendarSet: emp.work_calendar_sets as WorkCalendarSet | null,
  })) as (Employee & { workCalendarSet?: WorkCalendarSet | null })[];
}

// ============================================
// 社員にカレンダーセットを割り当て
// ============================================
export async function assignCalendarSetToEmployee(
  employeeId: string,
  calendarSetId: string | null
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("employees")
    .update({ work_calendar_set_id: calendarSetId })
    .eq("id", employeeId);

  if (error) {
    console.error("Error assigning calendar set:", error);
    return { error: "カレンダーセットの割り当てに失敗しました" };
  }

  revalidatePath("/settings/work-calendars");
  return {};
}

// ============================================
// 日本の祝日を取得（外部APIまたは固定データ）
// ============================================
export async function getJapaneseHolidays(
  fiscalYear: number
): Promise<{ date: string; name: string }[]> {
  // 年度の期間（4/1 ～ 翌3/31）
  const startYear = fiscalYear;
  const endYear = fiscalYear + 1;

  // 固定の祝日データ（2025年度の例）
  // 実際には外部APIを使用することも可能
  const holidays: { date: string; name: string }[] = [];

  // 年度内の月を処理（4月～翌3月）
  const monthsToProcess = [
    { year: startYear, month: 4 },
    { year: startYear, month: 5 },
    { year: startYear, month: 6 },
    { year: startYear, month: 7 },
    { year: startYear, month: 8 },
    { year: startYear, month: 9 },
    { year: startYear, month: 10 },
    { year: startYear, month: 11 },
    { year: startYear, month: 12 },
    { year: endYear, month: 1 },
    { year: endYear, month: 2 },
    { year: endYear, month: 3 },
  ];

  // 固定祝日
  const fixedHolidays: Record<string, string> = {
    "01-01": "元日",
    "02-11": "建国記念の日",
    "02-23": "天皇誕生日",
    "04-29": "昭和の日",
    "05-03": "憲法記念日",
    "05-04": "みどりの日",
    "05-05": "こどもの日",
    "08-11": "山の日",
    "11-03": "文化の日",
    "11-23": "勤労感謝の日",
  };

  for (const { year, month } of monthsToProcess) {
    const monthStr = String(month).padStart(2, "0");

    // 固定祝日をチェック
    for (const [mmdd, name] of Object.entries(fixedHolidays)) {
      if (mmdd.startsWith(monthStr)) {
        holidays.push({
          date: `${year}-${mmdd}`,
          name,
        });
      }
    }

    // 移動祝日（成人の日：1月第2月曜、海の日：7月第3月曜、敬老の日：9月第3月曜、スポーツの日：10月第2月曜）
    if (month === 1) {
      holidays.push({
        date: getNthMondayOfMonth(year, 1, 2),
        name: "成人の日",
      });
    }
    if (month === 7) {
      holidays.push({
        date: getNthMondayOfMonth(year, 7, 3),
        name: "海の日",
      });
    }
    if (month === 9) {
      holidays.push({
        date: getNthMondayOfMonth(year, 9, 3),
        name: "敬老の日",
      });
      // 秋分の日（約9/23）
      holidays.push({
        date: `${year}-09-23`,
        name: "秋分の日",
      });
    }
    if (month === 10) {
      holidays.push({
        date: getNthMondayOfMonth(year, 10, 2),
        name: "スポーツの日",
      });
    }
    if (month === 3) {
      // 春分の日（約3/21）
      holidays.push({
        date: `${year}-03-21`,
        name: "春分の日",
      });
    }
  }

  return holidays.sort((a, b) => a.date.localeCompare(b.date));
}

// N番目の月曜日を取得
function getNthMondayOfMonth(year: number, month: number, n: number): string {
  const firstDay = new Date(year, month - 1, 1);
  const dayOfWeek = firstDay.getDay();
  const firstMonday = dayOfWeek <= 1 ? 1 + (1 - dayOfWeek) : 1 + (8 - dayOfWeek);
  const nthMonday = firstMonday + (n - 1) * 7;
  return `${year}-${String(month).padStart(2, "0")}-${String(nthMonday).padStart(2, "0")}`;
}
