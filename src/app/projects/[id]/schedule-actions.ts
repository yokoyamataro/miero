"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { CalendarEventWithParticipants } from "@/types/database";

// プロジェクトに紐づくイベントを取得
export async function getProjectEvents(projectId: string): Promise<CalendarEventWithParticipants[]> {
  const supabase = await createClient();

  const { data: events, error } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("project_id", projectId)
    .order("start_date", { ascending: true });

  if (error) {
    console.error("Error fetching project events:", error);
    return [];
  }

  if (!events || events.length === 0) {
    return [];
  }

  // 参加者情報を取得
  const eventIds = events.map((e) => e.id);
  const { data: participants } = await supabase
    .from("calendar_event_participants")
    .select("event_id, employee_id")
    .in("event_id", eventIds);

  const { data: employees } = await supabase
    .from("employees")
    .select("*");

  const employeeMap = new Map((employees || []).map((e) => [e.id, e]));

  // イベントごとの参加者をマッピング
  type EmployeeType = NonNullable<typeof employees>[number];
  const participantsByEventId = (participants || []).reduce((acc, p) => {
    if (!acc[p.event_id]) acc[p.event_id] = [];
    const emp = employeeMap.get(p.employee_id);
    if (emp) acc[p.event_id].push(emp);
    return acc;
  }, {} as Record<string, EmployeeType[]>);

  return events.map((event) => ({
    ...event,
    participants: participantsByEventId[event.id] || [],
    creator: null,
    project: null,
    task: null,
    eventCategory: null,
  })) as CalendarEventWithParticipants[];
}

// プロジェクト用のイベントを作成
export async function createProjectEvent(data: {
  projectId: string;
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  allDay: boolean;
  participantIds: string[];
}): Promise<{ error?: string; event?: CalendarEventWithParticipants }> {
  const supabase = await createClient();

  // ログインユーザーを取得
  const { data: { user } } = await supabase.auth.getUser();
  let createdBy: string | null = null;

  if (user?.email) {
    const { data: employee } = await supabase
      .from("employees")
      .select("id")
      .eq("email", user.email)
      .single();
    createdBy = employee?.id || null;
  }

  // イベントを作成
  const { data: event, error } = await supabase
    .from("calendar_events")
    .insert({
      title: data.title,
      start_date: data.date,
      end_date: data.date,
      start_time: data.startTime,
      end_time: data.endTime,
      all_day: data.allDay,
      project_id: data.projectId,
      created_by: createdBy,
      category: "その他", // 後方互換性のため
      is_completed: false,
      recurrence_type: "none",
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating event:", error);
    return { error: "スケジュールの作成に失敗しました" };
  }

  // 参加者を登録
  if (data.participantIds.length > 0) {
    const participantInserts = data.participantIds.map((employeeId) => ({
      event_id: event.id,
      employee_id: employeeId,
    }));

    await supabase
      .from("calendar_event_participants")
      .insert(participantInserts);
  }

  revalidatePath(`/projects/${data.projectId}`);
  revalidatePath("/"); // カレンダーも更新

  return {
    event: {
      ...event,
      participants: [],
      creator: null,
      project: null,
      task: null,
      eventCategory: null,
    } as CalendarEventWithParticipants,
  };
}

// イベントを更新
export async function updateProjectEvent(
  eventId: string,
  updates: {
    is_completed?: boolean;
    all_day?: boolean;
    start_time?: string | null;
    end_time?: string | null;
  }
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("calendar_events")
    .update(updates)
    .eq("id", eventId);

  if (error) {
    console.error("Error updating event:", error);
    return { error: "スケジュールの更新に失敗しました" };
  }

  revalidatePath("/projects");
  revalidatePath("/"); // カレンダーも更新

  return {};
}
