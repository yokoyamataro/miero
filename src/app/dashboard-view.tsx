"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { DashboardCalendar, type DroppedProjectData } from "./dashboard-calendar";
import { DashboardProjectList } from "./dashboard-project-list";
import { EventModal } from "./calendar/event-modal";
import {
  type CalendarEventWithParticipants,
  type Employee,
  type EventCategory,
} from "@/types/database";
import { type ActiveProject, type PersonalTask } from "./dashboard-actions";

type ViewMode = "day" | "dayAll" | "fiveDay" | "fiveDayAll" | "month";

interface DashboardViewProps {
  events: CalendarEventWithParticipants[];
  employees: Employee[];
  eventCategories: EventCategory[];
  currentEmployeeId: string | null;
  activeProjects: ActiveProject[];
  personalTasks: PersonalTask[];
  initialView?: ViewMode;
  initialDate?: string;
}

export function DashboardView({
  events,
  employees,
  eventCategories,
  currentEmployeeId,
  activeProjects,
  personalTasks,
  initialView = "dayAll",
  initialDate,
}: DashboardViewProps) {
  const router = useRouter();
  const [showEventModal, setShowEventModal] = useState(false);
  const [droppedDate, setDroppedDate] = useState<Date | null>(null);
  const [droppedProjectData, setDroppedProjectData] = useState<DroppedProjectData | null>(null);
  const [droppedStartTime, setDroppedStartTime] = useState<{ hour: string; minute: string } | null>(null);
  const [droppedEndTime, setDroppedEndTime] = useState<{ hour: string; minute: string } | null>(null);
  const [droppedTargetEmployeeId, setDroppedTargetEmployeeId] = useState<string | null>(null);

  // 業務をカレンダーにドロップしたとき
  const handleDropProject = useCallback((
    date: Date,
    projectData: DroppedProjectData,
    startTime?: { hour: string; minute: string },
    endTime?: { hour: string; minute: string },
    targetEmployeeId?: string
  ) => {
    setDroppedDate(date);
    setDroppedProjectData(projectData);
    setDroppedStartTime(startTime || null);
    setDroppedEndTime(endTime || null);
    setDroppedTargetEmployeeId(targetEmployeeId || null);
    setShowEventModal(true);
  }, []);

  // イベント保存後
  const handleEventSaved = (_savedEvent: CalendarEventWithParticipants | CalendarEventWithParticipants[], _isNew: boolean) => {
    setShowEventModal(false);
    setDroppedDate(null);
    setDroppedProjectData(null);
    setDroppedStartTime(null);
    setDroppedEndTime(null);
    setDroppedTargetEmployeeId(null);
    router.refresh();
    window.location.reload();
  };

  // ドロップ時のプリセットイベントを作成
  // ドロップ先の社員を参加者として設定
  const targetEmployee = droppedTargetEmployeeId
    ? employees.find((e) => e.id === droppedTargetEmployeeId)
    : null;
  const presetParticipants = targetEmployee ? [targetEmployee] : [];

  const presetEvent: CalendarEventWithParticipants | null = droppedProjectData
    ? {
        id: "",
        title: droppedProjectData.projectName,
        description: null,
        category: "その他",
        event_category_id: eventCategories[0]?.id || null,
        start_date: format(droppedDate!, "yyyy-MM-dd"),
        start_time: droppedStartTime ? `${droppedStartTime.hour}:${droppedStartTime.minute}:00` : null,
        end_date: format(droppedDate!, "yyyy-MM-dd"),
        end_time: droppedEndTime ? `${droppedEndTime.hour}:${droppedEndTime.minute}:00` : null,
        all_day: false,
        is_completed: false,
        location: droppedProjectData.projectLocation || null,
        map_url: null,
        created_by: currentEmployeeId,
        project_id: droppedProjectData.projectId,
        task_id: null,
        // 繰り返し予定関連
        recurrence_type: "none",
        recurrence_day_of_week: null,
        recurrence_day_of_month: null,
        recurrence_month: null,
        recurrence_group_id: null,
        recurrence_end_date: null,
        created_at: "",
        updated_at: "",
        participants: presetParticipants,
        creator: null,
        project: {
          id: droppedProjectData.projectId,
          code: droppedProjectData.projectCode,
          name: droppedProjectData.projectName,
        } as any,
        task: null,
        eventCategory: eventCategories[0] || null,
      }
    : null;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* メインコンテンツ */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0">
        {/* 左側: カレンダー (3/4) */}
        <div className="lg:col-span-3 min-h-0">
          <DashboardCalendar
            initialEvents={events}
            employees={employees}
            eventCategories={eventCategories}
            initialView={initialView}
            initialDate={initialDate || format(new Date(), "yyyy-MM-dd")}
            currentEmployeeId={currentEmployeeId}
            onDropProject={handleDropProject}
          />
        </div>

        {/* 右側: 業務リスト (1/4) */}
        <div className="min-h-0">
          <DashboardProjectList
            activeProjects={activeProjects}
            personalTasks={personalTasks}
            employees={employees}
            currentEmployeeId={currentEmployeeId}
          />
        </div>
      </div>

      {/* ドロップ時のイベント作成モーダル */}
      <EventModal
        open={showEventModal}
        onOpenChange={(open) => {
          setShowEventModal(open);
          if (!open) {
            setDroppedDate(null);
            setDroppedProjectData(null);
            setDroppedStartTime(null);
            setDroppedEndTime(null);
            setDroppedTargetEmployeeId(null);
          }
        }}
        employees={employees}
        eventCategories={eventCategories}
        selectedDate={droppedDate}
        event={presetEvent}
        onSaved={handleEventSaved}
        currentEmployeeId={currentEmployeeId}
        initialStartTime={droppedStartTime}
        initialEndTime={droppedEndTime}
      />
    </div>
  );
}
