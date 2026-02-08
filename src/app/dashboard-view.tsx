"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { AttendanceClock } from "@/components/attendance-clock";
import { DashboardCalendar, type DroppedTaskData } from "./dashboard-calendar";
import { DashboardTaskList } from "./dashboard-task-list";
import { EventModal } from "./calendar/event-modal";
import {
  type CalendarEventWithParticipants,
  type Employee,
  type EventCategory,
} from "@/types/database";
import { type TaskWithProject } from "./dashboard-actions";

// AttendanceClock用の型定義
type Attendance = {
  id: string;
  clock_in: string | null;
  clock_out: string | null;
  date: string;
} | null;

interface DashboardViewProps {
  events: CalendarEventWithParticipants[];
  employees: Employee[];
  eventCategories: EventCategory[];
  currentEmployeeId: string | null;
  tasks: TaskWithProject[];
  attendance: Attendance | null;
}

export function DashboardView({
  events,
  employees,
  eventCategories,
  currentEmployeeId,
  tasks,
  attendance,
}: DashboardViewProps) {
  const router = useRouter();
  const [showEventModal, setShowEventModal] = useState(false);
  const [droppedDate, setDroppedDate] = useState<Date | null>(null);
  const [droppedTaskData, setDroppedTaskData] = useState<DroppedTaskData | null>(null);
  const [draggingTask, setDraggingTask] = useState<TaskWithProject | null>(null);

  // タスクをカレンダーにドロップしたとき
  const handleDropTask = useCallback((date: Date, taskData: DroppedTaskData) => {
    setDroppedDate(date);
    setDroppedTaskData(taskData);
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
        start_time: null,
        end_date: format(droppedDate!, "yyyy-MM-dd"),
        end_time: null,
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
      {/* 打刻UI */}
      <div className="flex-shrink-0">
        <AttendanceClock
          initialAttendance={attendance}
          employeeId={currentEmployeeId}
        />
      </div>

      {/* メインコンテンツ */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 p-4 min-h-0">
        {/* 左側: カレンダー (3/4) */}
        <div className="lg:col-span-3 min-h-0">
          <DashboardCalendar
            initialEvents={events}
            employees={employees}
            eventCategories={eventCategories}
            initialView="week"
            initialDate={format(new Date(), "yyyy-MM-dd")}
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
          }
        }}
        employees={employees}
        eventCategories={eventCategories}
        selectedDate={droppedDate}
        event={presetEvent}
        onSaved={handleEventSaved}
        currentEmployeeId={currentEmployeeId}
      />
    </div>
  );
}
