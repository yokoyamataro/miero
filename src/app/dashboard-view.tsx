"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Info, AlertCircle, X } from "lucide-react";
import { DashboardCalendar, type DroppedProjectData } from "./dashboard-calendar";
import { EventModal } from "./calendar/event-modal";
import {
  type CalendarEventWithParticipants,
  type Employee,
  type EventCategory,
} from "@/types/database";
import { type CalendarLeaveInfo, type CalendarHolidayInfo } from "./calendar/actions";

type ViewMode = "day" | "dayAll" | "fiveDay" | "fiveDayAll" | "month";

interface DashboardViewProps {
  events: CalendarEventWithParticipants[];
  employees: Employee[];
  eventCategories: EventCategory[];
  currentEmployeeId: string | null;
  initialView?: ViewMode;
  initialDate?: string;
  leaves?: CalendarLeaveInfo[];
  holidays?: CalendarHolidayInfo[];
}

export function DashboardView({
  events,
  employees,
  eventCategories,
  currentEmployeeId,
  initialView = "dayAll",
  initialDate,
  leaves = [],
  holidays = [],
}: DashboardViewProps) {
  const router = useRouter();
  const [showEventModal, setShowEventModal] = useState(false);
  const [droppedDate, setDroppedDate] = useState<Date | null>(null);

  // 通知バナー用: 現在時刻をクライアント側で取得（SSR/CSR齟齬回避）
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [morningDismissed, setMorningDismissed] = useState(false);
  const [eveningDismissed, setEveningDismissed] = useState(false);

  useEffect(() => {
    setCurrentTime(new Date());
    const t = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  // 本日（自分が関わる）のイベント集計
  const { hasEventsToday, hasCompletedToday } = useMemo(() => {
    if (!currentEmployeeId) return { hasEventsToday: false, hasCompletedToday: false };
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const mine = events.filter((e) => {
      const start = e.start_date;
      const end = e.end_date || e.start_date;
      if (!(start <= todayStr && todayStr <= end)) return false;
      return e.created_by === currentEmployeeId || e.participants.some((p) => p.id === currentEmployeeId);
    });
    return {
      hasEventsToday: mine.length > 0,
      hasCompletedToday: mine.some((e) => e.is_completed),
    };
  }, [events, currentEmployeeId]);

  const showMorningBanner =
    !!currentTime &&
    !!currentEmployeeId &&
    currentTime.getHours() < 12 &&
    !hasEventsToday &&
    !morningDismissed;

  const showEveningBanner =
    !!currentTime &&
    !!currentEmployeeId &&
    (currentTime.getHours() > 15 || (currentTime.getHours() === 15 && currentTime.getMinutes() >= 50)) &&
    !hasCompletedToday &&
    !eveningDismissed;
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
      {showMorningBanner && (
        <div className="mb-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-blue-900">
            <Info className="h-4 w-4 text-blue-600 flex-shrink-0" />
            <span>本日の予定が入っておりません。計画的に業務を進めましょう。</span>
          </div>
          <button
            onClick={() => setMorningDismissed(true)}
            className="p-1 hover:bg-blue-100 rounded flex-shrink-0"
            aria-label="閉じる"
          >
            <X className="h-4 w-4 text-blue-600" />
          </button>
        </div>
      )}
      {showEveningBanner && (
        <div className="mb-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-amber-900">
            <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <span>業務の記録をしてください</span>
          </div>
          <button
            onClick={() => setEveningDismissed(true)}
            className="p-1 hover:bg-amber-100 rounded flex-shrink-0"
            aria-label="閉じる"
          >
            <X className="h-4 w-4 text-amber-600" />
          </button>
        </div>
      )}
      <div className="flex-1 min-h-0">
        <DashboardCalendar
          initialEvents={events}
          employees={employees}
          eventCategories={eventCategories}
          initialView={initialView}
          initialDate={initialDate || format(new Date(), "yyyy-MM-dd")}
          currentEmployeeId={currentEmployeeId}
          onDropProject={handleDropProject}
          leaves={leaves}
          holidays={holidays}
        />
      </div>

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
