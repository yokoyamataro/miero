"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  type CalendarEventInsert,
  type CalendarEventWithParticipants,
  type Employee,
  type EventCategory,
  type EventCategoryInsert,
  type Project,
  type RecurrenceType,
} from "@/types/database";
import { addDays, addWeeks, addMonths, addYears, format, getDay, setDate, setMonth, isBefore, isAfter, parseISO } from "date-fns";

// 現在のユーザーの社員IDを取得（内部用）
async function getCurrentEmployeeIdInternal(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error("Auth error:", authError);
    return null;
  }
  if (!user) {
    console.error("No user found");
    return null;
  }

  const { data: employee, error: empError } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_id", user.id)
    .single();

  if (empError) {
    console.error("Employee lookup error:", empError, "auth_id:", user.id);
  }

  return employee?.id || null;
}

// 現在のユーザーの社員IDを取得（公開用）
export async function getCurrentEmployeeId(): Promise<string | null> {
  const supabase = await createClient();
  return getCurrentEmployeeIdInternal(supabase);
}

// 期間内のイベントを取得
export async function getEventsInRange(
  startDate: string,
  endDate: string
): Promise<CalendarEventWithParticipants[]> {
  const supabase = await createClient();

  // イベントを取得（期間内に開始または終了するもの）
  const { data: events, error } = await supabase
    .from("calendar_events")
    .select("*")
    .or(`start_date.gte.${startDate},end_date.gte.${startDate}`)
    .or(`start_date.lte.${endDate},end_date.lte.${endDate}`)
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    console.error("Error fetching events:", error);
    return [];
  }

  if (!events || events.length === 0) return [];

  // 参加者を取得
  const eventIds = events.map((e) => e.id);
  const { data: participants } = await supabase
    .from("calendar_event_participants")
    .select("event_id, employee_id")
    .in("event_id", eventIds);

  // 社員情報を取得
  const { data: employees } = await supabase
    .from("employees")
    .select("*");

  const employeeMap = new Map(employees?.map((e) => [e.id, e]) || []);

  // プロジェクト情報を取得
  const projectIds = events.map((e) => e.project_id).filter(Boolean) as string[];
  const projectMap = new Map<string, Project>();
  if (projectIds.length > 0) {
    const { data: projects } = await supabase
      .from("projects")
      .select("*")
      .in("id", projectIds);
    projects?.forEach((p) => projectMap.set(p.id, p as Project));
  }

  // 区分マスタ情報を取得
  const categoryIds = events.map((e) => e.event_category_id).filter(Boolean) as string[];
  const categoryMap = new Map<string, EventCategory>();
  if (categoryIds.length > 0) {
    const { data: categories } = await supabase
      .from("event_categories")
      .select("*")
      .in("id", categoryIds);
    (categories as EventCategory[])?.forEach((c) => categoryMap.set(c.id, c));
  }

  // イベントに参加者・プロジェクト・タスク・区分情報を付与
  return events.map((event) => {
    const eventParticipants = participants
      ?.filter((p) => p.event_id === event.id)
      .map((p) => employeeMap.get(p.employee_id))
      .filter(Boolean) as Employee[];

    const creator = event.created_by ? employeeMap.get(event.created_by) : null;
    const project = event.project_id ? projectMap.get(event.project_id) : null;
    const eventCategory = event.event_category_id ? categoryMap.get(event.event_category_id) : null;

    return {
      ...event,
      participants: eventParticipants || [],
      creator: creator || null,
      project: project || null,
      task: null,
      eventCategory: eventCategory || null,
    } as CalendarEventWithParticipants;
  });
}

// イベントを作成
export async function createEvent(
  data: CalendarEventInsert,
  participantIds: string[]
): Promise<{ success?: boolean; error?: string; eventId?: string; event?: CalendarEventWithParticipants }> {
  const supabase = await createClient();

  const employeeId = await getCurrentEmployeeIdInternal(supabase);
  if (!employeeId) {
    return { error: "ログインが必要です" };
  }

  // イベントを作成
  const { data: event, error } = await supabase
    .from("calendar_events")
    .insert({
      ...data,
      created_by: employeeId,
    } as never)
    .select("*")
    .single();

  if (error) {
    console.error("Error creating event:", error);
    return { error: `イベントの作成に失敗しました: ${error.message}` };
  }

  // 参加者を追加
  if (participantIds.length > 0) {
    const participantInserts = participantIds.map((empId) => ({
      event_id: event.id,
      employee_id: empId,
    }));

    const { error: participantError } = await supabase
      .from("calendar_event_participants")
      .insert(participantInserts as never);

    if (participantError) {
      console.error("Error adding participants:", participantError);
    }
  }

  // 参加者情報を取得
  const { data: employees } = await supabase
    .from("employees")
    .select("*")
    .in("id", participantIds.length > 0 ? participantIds : [employeeId]);

  const employeeMap = new Map(employees?.map((e) => [e.id, e]) || []);
  const participants = participantIds
    .map((id) => employeeMap.get(id))
    .filter(Boolean) as Employee[];

  const creator = employeeMap.get(employeeId) || null;

  // 区分情報を取得
  let eventCategory: EventCategory | null = null;
  if (event.event_category_id) {
    const { data: category } = await supabase
      .from("event_categories")
      .select("*")
      .eq("id", event.event_category_id)
      .single();
    eventCategory = category as EventCategory | null;
  }

  const fullEvent: CalendarEventWithParticipants = {
    ...event,
    participants,
    creator,
    project: null,
    task: null,
    eventCategory,
  };

  revalidatePath("/calendar");
  revalidatePath("/");
  return { success: true, eventId: event.id, event: fullEvent };
}

// 繰り返し予定を作成
export async function createRecurringEvents(
  data: CalendarEventInsert,
  participantIds: string[],
  recurrenceType: RecurrenceType,
  recurrenceDayOfWeek: number,
  recurrenceDayOfMonth: number,
  recurrenceMonth: number,
  recurrenceEndDate: string | null
): Promise<{ success?: boolean; error?: string; count?: number }> {
  const supabase = await createClient();

  const employeeId = await getCurrentEmployeeIdInternal(supabase);
  if (!employeeId) {
    return { error: "ログインが必要です" };
  }

  // 繰り返しグループIDを生成
  const recurrenceGroupId = crypto.randomUUID();

  // 開始日をパース
  const startDate = parseISO(data.start_date);
  const endDateLimit = recurrenceEndDate
    ? parseISO(recurrenceEndDate)
    : addYears(startDate, 2); // デフォルトで2年先まで

  // 繰り返し日付を計算
  const dates: Date[] = [];
  let currentDate = startDate;

  while (isBefore(currentDate, endDateLimit) || format(currentDate, "yyyy-MM-dd") === format(endDateLimit, "yyyy-MM-dd")) {
    if (recurrenceType === "weekly") {
      // 毎週の場合: 指定曜日
      if (getDay(currentDate) === recurrenceDayOfWeek) {
        dates.push(currentDate);
        currentDate = addWeeks(currentDate, 1);
      } else {
        currentDate = addDays(currentDate, 1);
      }
    } else if (recurrenceType === "monthly") {
      // 毎月の場合: 指定日
      const targetDate = setDate(currentDate, Math.min(recurrenceDayOfMonth, new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()));
      if (isBefore(targetDate, startDate)) {
        currentDate = addMonths(currentDate, 1);
        continue;
      }
      if (isAfter(targetDate, endDateLimit)) break;
      dates.push(targetDate);
      currentDate = addMonths(currentDate, 1);
    } else if (recurrenceType === "yearly") {
      // 毎年の場合: 指定月日
      const targetDate = setMonth(setDate(currentDate, Math.min(recurrenceDayOfMonth, new Date(currentDate.getFullYear(), recurrenceMonth, 0).getDate())), recurrenceMonth - 1);
      if (isBefore(targetDate, startDate)) {
        currentDate = addYears(currentDate, 1);
        continue;
      }
      if (isAfter(targetDate, endDateLimit)) break;
      dates.push(targetDate);
      currentDate = addYears(currentDate, 1);
    } else {
      break;
    }

    // 無限ループ防止: 最大100件
    if (dates.length >= 100) break;
  }

  if (dates.length === 0) {
    return { error: "作成する予定がありません" };
  }

  // 各日付に対してイベントを作成
  let createdCount = 0;
  for (const date of dates) {
    const dateStr = format(date, "yyyy-MM-dd");
    const eventData = {
      ...data,
      start_date: dateStr,
      end_date: dateStr,
      recurrence_type: recurrenceType,
      recurrence_day_of_week: recurrenceType === "weekly" ? recurrenceDayOfWeek : null,
      recurrence_day_of_month: recurrenceType === "monthly" || recurrenceType === "yearly" ? recurrenceDayOfMonth : null,
      recurrence_month: recurrenceType === "yearly" ? recurrenceMonth : null,
      recurrence_group_id: recurrenceGroupId,
      recurrence_end_date: recurrenceEndDate,
      created_by: employeeId,
    };

    const { data: event, error } = await supabase
      .from("calendar_events")
      .insert(eventData as never)
      .select("id")
      .single();

    if (error) {
      console.error("Error creating recurring event:", error);
      continue;
    }

    // 参加者を追加
    if (participantIds.length > 0 && event) {
      const participantInserts = participantIds.map((empId) => ({
        event_id: event.id,
        employee_id: empId,
      }));
      await supabase
        .from("calendar_event_participants")
        .insert(participantInserts as never);
    }

    createdCount++;
  }

  revalidatePath("/calendar");
  revalidatePath("/");
  return { success: true, count: createdCount };
}

// 複数日に同じ予定を作成
export async function createMultipleDateEvents(
  data: CalendarEventInsert,
  participantIds: string[],
  dates: string[]
): Promise<{ success?: boolean; error?: string; count?: number; events?: CalendarEventWithParticipants[] }> {
  const supabase = await createClient();

  const employeeId = await getCurrentEmployeeIdInternal(supabase);
  if (!employeeId) {
    return { error: "ログインが必要です" };
  }

  if (dates.length === 0) {
    return { error: "日付を選択してください" };
  }

  const createdEventIds: string[] = [];
  for (const dateStr of dates) {
    const eventData = {
      ...data,
      start_date: dateStr,
      end_date: dateStr,
      created_by: employeeId,
    };

    const { data: event, error } = await supabase
      .from("calendar_events")
      .insert(eventData as never)
      .select("id")
      .single();

    if (error) {
      console.error("Error creating event for date:", dateStr, error);
      continue;
    }

    createdEventIds.push(event.id);

    // 参加者を追加
    if (participantIds.length > 0 && event) {
      const participantInserts = participantIds.map((empId) => ({
        event_id: event.id,
        employee_id: empId,
      }));
      const { error: participantError } = await supabase
        .from("calendar_event_participants")
        .insert(participantInserts as never);
      if (participantError) {
        console.error("Error adding participants:", participantError);
      }
    }
  }

  // 作成したイベントを参加者情報付きで取得
  let createdEvents: CalendarEventWithParticipants[] = [];
  if (createdEventIds.length > 0) {
    const { data: events } = await supabase
      .from("calendar_events")
      .select(`
        *,
        participants:calendar_event_participants(
          employee:employees(id, name, email, avatar_url)
        ),
        creator:employees!calendar_events_created_by_fkey(id, name, email, avatar_url),
        project:projects(id, code, name),
        task:tasks(id, title),
        eventCategory:event_categories(id, name, color, sort_order)
      `)
      .in("id", createdEventIds);

    if (events) {
      createdEvents = events.map((e) => ({
        ...e,
        participants: e.participants?.map((p: { employee: Employee }) => p.employee).filter(Boolean) || [],
      })) as CalendarEventWithParticipants[];
    }
  }

  revalidatePath("/calendar");
  revalidatePath("/");
  return { success: true, count: createdEventIds.length, events: createdEvents };
}

// イベントを更新
export async function updateEvent(
  eventId: string,
  data: Partial<CalendarEventInsert>,
  participantIds: string[]
): Promise<{ success?: boolean; error?: string; event?: CalendarEventWithParticipants }> {
  const supabase = await createClient();

  const employeeId = await getCurrentEmployeeIdInternal(supabase);
  if (!employeeId) {
    return { error: "ログインが必要です" };
  }

  // イベントを更新
  const { data: updatedEvent, error } = await supabase
    .from("calendar_events")
    .update(data as never)
    .eq("id", eventId)
    .select("*")
    .single();

  if (error) {
    console.error("Error updating event:", error);
    return { error: "イベントの更新に失敗しました" };
  }

  // 参加者を更新（一度削除して再登録）
  await supabase
    .from("calendar_event_participants")
    .delete()
    .eq("event_id", eventId);

  if (participantIds.length > 0) {
    const participantInserts = participantIds.map((empId) => ({
      event_id: eventId,
      employee_id: empId,
    }));

    await supabase
      .from("calendar_event_participants")
      .insert(participantInserts as never);
  }

  // 参加者情報を取得
  const allEmployeeIds = [...participantIds, updatedEvent.created_by].filter(Boolean);
  const { data: employees } = await supabase
    .from("employees")
    .select("*")
    .in("id", allEmployeeIds);

  const employeeMap = new Map(employees?.map((e) => [e.id, e]) || []);
  const participants = participantIds
    .map((id) => employeeMap.get(id))
    .filter(Boolean) as Employee[];

  const creator = updatedEvent.created_by ? employeeMap.get(updatedEvent.created_by) : null;

  // 区分情報を取得
  let eventCategory: EventCategory | null = null;
  if (updatedEvent.event_category_id) {
    const { data: category } = await supabase
      .from("event_categories")
      .select("*")
      .eq("id", updatedEvent.event_category_id)
      .single();
    eventCategory = category as EventCategory | null;
  }

  const fullEvent: CalendarEventWithParticipants = {
    ...updatedEvent,
    participants,
    creator: creator || null,
    project: null,
    task: null,
    eventCategory,
  };

  revalidatePath("/calendar");
  return { success: true, event: fullEvent };
}

// イベントを削除
export async function deleteEvent(
  eventId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  const employeeId = await getCurrentEmployeeIdInternal(supabase);
  if (!employeeId) {
    return { error: "ログインが必要です" };
  }

  const { error } = await supabase
    .from("calendar_events")
    .delete()
    .eq("id", eventId);

  if (error) {
    console.error("Error deleting event:", error);
    return { error: "イベントの削除に失敗しました" };
  }

  revalidatePath("/calendar");
  revalidatePath("/");
  return { success: true };
}

// 繰り返し予定を一括削除（すべて）
export async function deleteRecurringEventsAll(
  recurrenceGroupId: string
): Promise<{ success?: boolean; error?: string; count?: number }> {
  const supabase = await createClient();

  const employeeId = await getCurrentEmployeeIdInternal(supabase);
  if (!employeeId) {
    return { error: "ログインが必要です" };
  }

  // 削除対象の件数を取得
  const { data: eventsToDelete } = await supabase
    .from("calendar_events")
    .select("id")
    .eq("recurrence_group_id", recurrenceGroupId);

  const count = eventsToDelete?.length || 0;

  const { error } = await supabase
    .from("calendar_events")
    .delete()
    .eq("recurrence_group_id", recurrenceGroupId);

  if (error) {
    console.error("Error deleting recurring events:", error);
    return { error: "繰り返し予定の削除に失敗しました" };
  }

  revalidatePath("/calendar");
  revalidatePath("/");
  return { success: true, count };
}

// 繰り返し予定を一括削除（指定日以降）
export async function deleteRecurringEventsFromDate(
  recurrenceGroupId: string,
  fromDate: string
): Promise<{ success?: boolean; error?: string; count?: number }> {
  const supabase = await createClient();

  const employeeId = await getCurrentEmployeeIdInternal(supabase);
  if (!employeeId) {
    return { error: "ログインが必要です" };
  }

  // 削除対象の件数を取得
  const { data: eventsToDelete } = await supabase
    .from("calendar_events")
    .select("id")
    .eq("recurrence_group_id", recurrenceGroupId)
    .gte("start_date", fromDate);

  const count = eventsToDelete?.length || 0;

  const { error } = await supabase
    .from("calendar_events")
    .delete()
    .eq("recurrence_group_id", recurrenceGroupId)
    .gte("start_date", fromDate);

  if (error) {
    console.error("Error deleting recurring events from date:", error);
    return { error: "繰り返し予定の削除に失敗しました" };
  }

  revalidatePath("/calendar");
  revalidatePath("/");
  return { success: true, count };
}

// 社員一覧を取得
export async function getEmployees(): Promise<Employee[]> {
  const supabase = await createClient();

  const { data: employees } = await supabase
    .from("employees")
    .select("*")
    .order("name");

  return (employees as Employee[]) || [];
}

// 単一イベントを取得
export async function getEvent(eventId: string): Promise<CalendarEventWithParticipants | null> {
  const supabase = await createClient();

  const { data: event, error } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (error || !event) return null;

  // 参加者を取得
  const { data: participants } = await supabase
    .from("calendar_event_participants")
    .select("employee_id")
    .eq("event_id", eventId);

  // 社員情報を取得
  const { data: employees } = await supabase.from("employees").select("*");
  const employeeMap = new Map(employees?.map((e) => [e.id, e]) || []);

  const eventParticipants = participants
    ?.map((p) => employeeMap.get(p.employee_id))
    .filter(Boolean) as Employee[];

  const creator = event.created_by ? employeeMap.get(event.created_by) : null;

  return {
    ...event,
    participants: eventParticipants || [],
    creator: creator || null,
  } as CalendarEventWithParticipants;
}

// 進行中の業務を取得（カレンダーリンク用）
export type ProjectForLink = {
  id: string;
  code: string;
  name: string;
  location: string | null;
};

export async function getActiveProjects(): Promise<ProjectForLink[]> {
  const supabase = await createClient();

  // 進行中の業務を取得
  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id, code, name, location")
    .in("status", ["受注", "着手", "進行中"])
    .order("code", { ascending: false });

  if (projectsError) {
    console.error("Error fetching projects:", projectsError);
    return [];
  }

  return (projects as ProjectForLink[]) || [];
}

// ============================================
// Event Category Actions (イベント区分)
// ============================================

// イベント区分一覧を取得
export async function getEventCategories(): Promise<EventCategory[]> {
  const supabase = await createClient();

  const { data: categories, error } = await supabase
    .from("event_categories")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Error fetching event categories:", error);
    return [];
  }

  return (categories as EventCategory[]) || [];
}

// イベント区分を作成
export async function createEventCategory(
  data: EventCategoryInsert
): Promise<{ success?: boolean; error?: string; id?: string }> {
  const supabase = await createClient();

  // 最大のsort_orderを取得
  const { data: maxOrder } = await supabase
    .from("event_categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const newSortOrder = (maxOrder?.sort_order ?? -1) + 1;

  const { data: category, error } = await supabase
    .from("event_categories")
    .insert({
      ...data,
      sort_order: newSortOrder,
    } as never)
    .select("id")
    .single();

  if (error) {
    console.error("Error creating event category:", error);
    if (error.code === "23505") {
      return { error: "同じ名前の区分が既に存在します" };
    }
    return { error: "区分の作成に失敗しました" };
  }

  revalidatePath("/calendar");
  return { success: true, id: category.id };
}

// イベント区分を更新
export async function updateEventCategory(
  categoryId: string,
  data: Partial<EventCategoryInsert>
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("event_categories")
    .update(data as never)
    .eq("id", categoryId);

  if (error) {
    console.error("Error updating event category:", error);
    if (error.code === "23505") {
      return { error: "同じ名前の区分が既に存在します" };
    }
    return { error: "区分の更新に失敗しました" };
  }

  revalidatePath("/calendar");
  return { success: true };
}

// イベント区分を削除
export async function deleteEventCategory(
  categoryId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  // この区分を使用しているイベントがあるか確認
  const { data: eventsUsingCategory } = await supabase
    .from("calendar_events")
    .select("id")
    .eq("event_category_id", categoryId)
    .limit(1);

  if (eventsUsingCategory && eventsUsingCategory.length > 0) {
    return { error: "この区分を使用しているイベントがあるため削除できません" };
  }

  const { error } = await supabase
    .from("event_categories")
    .delete()
    .eq("id", categoryId);

  if (error) {
    console.error("Error deleting event category:", error);
    return { error: "区分の削除に失敗しました" };
  }

  revalidatePath("/calendar");
  return { success: true };
}

// イベント区分の並び順を更新
export async function reorderEventCategories(
  categoryOrders: { id: string; sort_order: number }[]
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  for (const category of categoryOrders) {
    const { error } = await supabase
      .from("event_categories")
      .update({ sort_order: category.sort_order } as never)
      .eq("id", category.id);

    if (error) {
      console.error("Error updating category order:", error);
      return { error: "並び順の更新に失敗しました" };
    }
  }

  revalidatePath("/calendar");
  return { success: true };
}
