"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { DashboardCalendar, type DroppedTaskData } from "./dashboard-calendar";
import { DashboardTaskList } from "./dashboard-task-list";
import { EventModal } from "./calendar/event-modal";
import {
  type CalendarEventWithParticipants,
  type Employee,
  type EventCategory,
} from "@/types/database";
import { type TaskWithProject } from "./dashboard-actions";

type ViewMode = "dayAll" | "fiveDay" | "weekAll" | "month";

interface DashboardViewProps {
  events: CalendarEventWithParticipants[];
  employees: Employee[];
  eventCategories: EventCategory[];
  currentEmployeeId: string | null;
  tasks: TaskWithProject[];
  initialView?: ViewMode;
  initialDate?: string;
}

export function DashboardView({
  events,
  employees,
  eventCategories,
  currentEmployeeId,
  tasks,
  initialView = "dayAll",
  initialDate,
}: DashboardViewProps) {
  const router = useRouter();
  const [showEventModal, setShowEventModal] = useState(false);
  const [droppedDate, setDroppedDate] = useState<Date | null>(null);
  const [droppedTaskData, setDroppedTaskData] = useState<DroppedTaskData | null>(null);
  const [droppedStartTime, setDroppedStartTime] = useState<{ hour: string; minute: string } | null>(null);
  const [droppedEndTime, setDroppedEndTime] = useState<{ hour: string; minute: string } | null>(null);
  const [draggingTask, setDraggingTask] = useState<TaskWithProject | null>(null);

  // タスクをカレンダーにドロップしたとき
  const handleDropTask = useCallback((
    date: Date,
    taskData: DroppedTaskData,
    startTime?: { hour: string; minute: string },
    endTime?: { hour: string; minute: string }
  ) => {
    setDroppedDate(date);
    setDroppedTaskData(taskData);
    setDroppedStartTime(startTime || null);
    setDroppedEndTime(endTime || null);
    setShowEventModal(true);
  }, []);

  // ドラッグ開始
  const handleDragStart = useCallback((task: TaskWithProject) => {
    setDraggingTask(task);
  }, []);

  // イベント保存後
  const handleEventSaved = () => {
    setShowEventModal(false);
    setDroppedDate(null);
    setDroppedTaskData(null);
    setDroppedStartTime(null);
    setDroppedEndTime(null);
    router.refresh();
    window.location.reload();
  };

  // ドロップ時のプリセットイベントを作成
  const presetEvent: CalendarEventWithParticipants | null = droppedTaskData
    ? {
        id: "",
        title: `${droppedTaskData.projectName.slice(0, 10)}>${droppedTaskData.taskTitle}`,
        description: null,
        category: "その他",
        event_category_id: eventCategories[0]?.id || null,
        start_date: format(droppedDate!, "yyyy-MM-dd"),
        start_time: droppedStartTime ? `${droppedStartTime.hour}:${droppedStartTime.minute}:00` : null,
        end_date: format(droppedDate!, "yyyy-MM-dd"),
        end_time: droppedEndTime ? `${droppedEndTime.hour}:${droppedEndTime.minute}:00` : null,
        all_day: false,
        location: null,
        map_url: null,
        created_by: currentEmployeeId,
        project_id: droppedTaskData.projectId,
        task_id: droppedTaskData.taskId,
        created_at: "",
        updated_at: "",
        participants: [],
        creator: null,
        project: {
          id: droppedTaskData.projectId,
          code: droppedTaskData.projectCode,
          name: droppedTaskData.projectName,
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
            onDropTask={handleDropTask}
          />
        </div>

        {/* 右側: タスクリスト (1/4) */}
        <div className="min-h-0">
          <DashboardTaskList
            tasks={tasks}
            employees={employees}
            currentEmployeeId={currentEmployeeId}
            onDragStart={handleDragStart}
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
            setDroppedTaskData(null);
            setDroppedStartTime(null);
            setDroppedEndTime(null);
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
