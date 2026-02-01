"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  type CalendarEventInsert,
  type CalendarEvent,
  type CalendarEventWithParticipants,
  type Employee,
  type EventCategory,
  type Project,
  type Task,
} from "@/types/database";

// 現在のユーザーの社員IDを取得（内部用）
async function getCurrentEmployeeIdInternal(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_id", user.id)
    .single();

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

  // タスク情報を取得
  const taskIds = events.map((e) => e.task_id).filter(Boolean) as string[];
  const taskMap = new Map<string, Task>();
  if (taskIds.length > 0) {
    const { data: tasks } = await supabase
      .from("tasks" as never)
      .select("*")
      .in("id", taskIds);
    (tasks as Task[])?.forEach((t) => taskMap.set(t.id, t));
  }

  // イベントに参加者・プロジェクト・タスク情報を付与
  return events.map((event) => {
    const eventParticipants = participants
      ?.filter((p) => p.event_id === event.id)
      .map((p) => employeeMap.get(p.employee_id))
      .filter(Boolean) as Employee[];

    const creator = event.created_by ? employeeMap.get(event.created_by) : null;
    const project = event.project_id ? projectMap.get(event.project_id) : null;
    const task = event.task_id ? taskMap.get(event.task_id) : null;

    return {
      ...event,
      participants: eventParticipants || [],
      creator: creator || null,
      project: project || null,
      task: task || null,
    } as CalendarEventWithParticipants;
  });
}

// イベントを作成
export async function createEvent(
  data: CalendarEventInsert,
  participantIds: string[]
): Promise<{ success?: boolean; error?: string; eventId?: string }> {
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
    .select("id")
    .single();

  if (error) {
    console.error("Error creating event:", error);
    return { error: "イベントの作成に失敗しました" };
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

  revalidatePath("/calendar");
  return { success: true, eventId: event.id };
}

// イベントを更新
export async function updateEvent(
  eventId: string,
  data: Partial<CalendarEventInsert>,
  participantIds: string[]
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  const employeeId = await getCurrentEmployeeIdInternal(supabase);
  if (!employeeId) {
    return { error: "ログインが必要です" };
  }

  // イベントを更新
  const { error } = await supabase
    .from("calendar_events")
    .update(data as never)
    .eq("id", eventId);

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

  revalidatePath("/calendar");
  return { success: true };
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
  return { success: true };
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

// 進行中の業務とタスクを取得
export type ProjectWithTasks = Project & {
  tasks: Task[];
};

export async function getActiveProjectsWithTasks(): Promise<ProjectWithTasks[]> {
  const supabase = await createClient();

  // 進行中の業務を取得
  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("*")
    .in("status", ["受注", "着手", "進行中"])
    .order("code", { ascending: false });

  if (projectsError) {
    console.error("Error fetching projects:", projectsError);
    return [];
  }

  if (!projects || projects.length === 0) {
    return [];
  }

  // 各業務のタスクを取得（未完了のもの）
  const projectIds = projects.map((p) => p.id);
  const { data: tasks, error: tasksError } = await supabase
    .from("tasks" as never)
    .select("*")
    .in("project_id", projectIds)
    .in("status", ["未着手", "進行中"])
    .is("parent_id", null)
    .order("sort_order", { ascending: true });

  // プロジェクトにタスクを紐付け
  const tasksByProjectId = ((tasks as Task[]) || []).reduce((acc, task) => {
    if (!acc[task.project_id]) acc[task.project_id] = [];
    acc[task.project_id].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  return (projects as Project[]).map((project) => ({
    ...project,
    tasks: tasksByProjectId[project.id] || [],
  }));
}
