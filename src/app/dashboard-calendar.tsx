"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  CalendarDays,
  CalendarRange,
  Plus,
  MapPin,
  Clock,
  Users,
  User,
  UsersRound,
  Settings,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  parseISO,
} from "date-fns";
import { ja } from "date-fns/locale";
import {
  type CalendarEventWithParticipants,
  type Employee,
  type EventCategory,
  EVENT_CATEGORY_COLORS,
  type EventCategoryLegacy,
} from "@/types/database";
import { EventModal } from "./calendar/event-modal";
import { EventDetailModal } from "./calendar/event-detail-modal";
import { type TaskWithProject } from "./dashboard-actions";

type ViewMode = "day" | "week" | "month";
type EmployeeFilter = "me" | "all" | string;

interface DashboardCalendarProps {
  initialEvents: CalendarEventWithParticipants[];
  employees: Employee[];
  eventCategories: EventCategory[];
  initialView: ViewMode;
  initialDate: string;
  currentEmployeeId: string | null;
  onDropTask: (date: Date, taskData: DroppedTaskData) => void;
}

export interface DroppedTaskData {
  taskId: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  projectLocation: string | null;
  taskTitle: string;
}

const WEEKDAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

export function DashboardCalendar({
  initialEvents,
  employees,
  eventCategories,
  initialView,
  initialDate,
  currentEmployeeId,
  onDropTask,
}: DashboardCalendarProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>(initialView);
  const [currentDate, setCurrentDate] = useState(parseISO(initialDate));
  const [events, setEvents] = useState(initialEvents);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventWithParticipants | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [employeeFilter, setEmployeeFilter] = useState<EmployeeFilter>("all");
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  // 社員リストをソート
  const sortedEmployees = useMemo(() => {
    if (!currentEmployeeId) return employees;
    return [...employees].sort((a, b) => {
      if (a.id === currentEmployeeId) return -1;
      if (b.id === currentEmployeeId) return 1;
      return 0;
    });
  }, [employees, currentEmployeeId]);

  // フィルタリングされたイベント
  const filteredEvents = useMemo(() => {
    if (employeeFilter === "all") {
      return events;
    }

    const targetEmployeeId = employeeFilter === "me" ? currentEmployeeId : employeeFilter;
    if (!targetEmployeeId) return events;

    return events.filter((event) => {
      if (event.created_by === targetEmployeeId) return true;
      if (event.participants.some((p) => p.id === targetEmployeeId)) return true;
      return false;
    });
  }, [events, employeeFilter, currentEmployeeId]);

  // 月表示のカレンダー日付を生成
  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentDate]);

  // 週表示の日付を生成
  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
  }, [currentDate]);

  // 日付ごとのイベントを取得
  const getEventsForDate = (date: Date) => {
    return filteredEvents.filter((event) => {
      const startDate = parseISO(event.start_date);
      const endDate = event.end_date ? parseISO(event.end_date) : startDate;
      return date >= startDate && date <= endDate;
    });
  };

  // 週表示用：日付×社員ごとのイベントを取得
  const getEventsForDateAndEmployee = (date: Date, employeeId: string) => {
    return filteredEvents.filter((event) => {
      const startDate = parseISO(event.start_date);
      const endDate = event.end_date ? parseISO(event.end_date) : startDate;
      const isInDateRange = date >= startDate && date <= endDate;
      if (!isInDateRange) return false;
      return event.created_by === employeeId ||
             event.participants.some((p) => p.id === employeeId);
    });
  };

  // 週表示に表示する社員リスト
  const weekViewEmployees = useMemo(() => {
    if (employeeFilter === "me") {
      return sortedEmployees.filter((emp) => emp.id === currentEmployeeId);
    } else if (employeeFilter === "all") {
      return sortedEmployees;
    } else {
      return sortedEmployees.filter((emp) => emp.id === employeeFilter);
    }
  }, [sortedEmployees, employeeFilter, currentEmployeeId]);

  // ナビゲーション
  const navigatePrev = () => {
    switch (viewMode) {
      case "month":
        setCurrentDate(subMonths(currentDate, 1));
        break;
      case "week":
        setCurrentDate(subWeeks(currentDate, 1));
        break;
      case "day":
        setCurrentDate(subDays(currentDate, 1));
        break;
    }
  };

  const navigateNext = () => {
    switch (viewMode) {
      case "month":
        setCurrentDate(addMonths(currentDate, 1));
        break;
      case "week":
        setCurrentDate(addWeeks(currentDate, 1));
        break;
      case "day":
        setCurrentDate(addDays(currentDate, 1));
        break;
    }
  };

  const navigateToday = () => {
    setCurrentDate(new Date());
  };

  // 日付クリックでイベント作成
  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setSelectedEvent(null);
    setShowEventModal(true);
  };

  // イベントクリックで詳細表示
  const handleEventClick = (event: CalendarEventWithParticipants, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEvent(event);
    setShowDetailModal(true);
  };

  // イベント編集
  const handleEditEvent = (event: CalendarEventWithParticipants) => {
    setShowDetailModal(false);
    setSelectedEvent(event);
    setSelectedDate(parseISO(event.start_date));
    setShowEventModal(true);
  };

  // イベント更新後
  const handleEventUpdated = () => {
    router.refresh();
    setShowEventModal(false);
    setShowDetailModal(false);
    window.location.reload();
  };

  // ドロップハンドラー
  const handleDrop = useCallback(
    (date: Date, e: React.DragEvent) => {
      e.preventDefault();
      setDragOverDate(null);

      try {
        const data = e.dataTransfer.getData("text/plain");
        if (data) {
          const taskData = JSON.parse(data) as DroppedTaskData;
          onDropTask(date, taskData);
        }
      } catch (err) {
        console.error("Drop error:", err);
      }
    },
    [onDropTask]
  );

  const handleDragOver = useCallback((date: Date, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverDate(format(date, "yyyy-MM-dd"));
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverDate(null);
  }, []);

  // タイトル
  const getTitle = () => {
    switch (viewMode) {
      case "month":
        return format(currentDate, "yyyy年M月", { locale: ja });
      case "week":
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const weekEnd = addDays(weekStart, 6);
        return `${format(weekStart, "M月d日", { locale: ja })} - ${format(weekEnd, "M月d日", { locale: ja })}`;
      case "day":
        return format(currentDate, "yyyy年M月d日(E)", { locale: ja });
    }
  };

  // イベントの区分色を取得
  const getCategoryColor = (event: CalendarEventWithParticipants) => {
    if (event.eventCategory) {
      return event.eventCategory.color;
    }
    if (event.category && EVENT_CATEGORY_COLORS[event.category as EventCategoryLegacy]) {
      return EVENT_CATEGORY_COLORS[event.category as EventCategoryLegacy];
    }
    return "bg-gray-500";
  };

  // 濃い色から薄い背景色を取得（bg-xxx-500 → bg-xxx-100）
  const getLightBgColor = (categoryColor: string) => {
    // bg-xxx-500 や bg-xxx-400 を bg-xxx-100 に変換
    const match = categoryColor.match(/^bg-(\w+)-\d+$/);
    if (match) {
      return `bg-${match[1]}-100`;
    }
    return "bg-gray-100";
  };

  const getCategoryName = (event: CalendarEventWithParticipants) => {
    if (event.eventCategory) {
      return event.eventCategory.name;
    }
    if (event.category) {
      return event.category;
    }
    return "";
  };

  // イベントレンダリング
  const renderEvent = (event: CalendarEventWithParticipants, compact = false) => {
    const categoryColor = getCategoryColor(event);
    const lightBgColor = getLightBgColor(categoryColor);
    const categoryName = getCategoryName(event);
    const timeStr = event.start_time ? event.start_time.slice(0, 5) : "";

    if (compact) {
      return (
        <div
          key={event.id}
          className={`text-xs truncate cursor-pointer hover:opacity-80 flex items-center gap-1 px-1 py-0.5 rounded ${lightBgColor}`}
          onClick={(e) => handleEventClick(event, e)}
          title={event.title}
        >
          {categoryName && (
            <span className={`${categoryColor} text-white px-1 rounded text-[10px] flex-shrink-0`}>{categoryName}</span>
          )}
          <span className="text-black truncate">{timeStr && `${timeStr} `}{event.title}</span>
        </div>
      );
    }

    return (
      <div
        key={event.id}
        className={`border rounded cursor-pointer hover:opacity-80 mb-1 overflow-hidden ${lightBgColor}`}
        onClick={(e) => handleEventClick(event, e)}
      >
        {categoryName && (
          <div className={`${categoryColor} text-white text-xs font-medium px-2 py-0.5`}>{categoryName}</div>
        )}
        <div className="p-2">
          <div className="font-medium text-black">{event.title}</div>
          {event.start_time && (
            <div className="text-sm flex items-center gap-1 mt-1 text-black">
              <Clock className="h-3 w-3" />
              {event.start_time.slice(0, 5)}
              {event.end_time && ` - ${event.end_time.slice(0, 5)}`}
            </div>
          )}
          {event.location && (
            <div className="text-sm flex items-center gap-1 mt-1 text-black">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{event.location}</span>
            </div>
          )}
          {event.participants.length > 0 && (
            <div className="text-sm flex items-center gap-1 mt-1 text-black">
              <Users className="h-3 w-3" />
              {event.participants.map((p) => p.name).join(", ")}
            </div>
          )}
        </div>
      </div>
    );
  };

  // 月表示
  const renderMonthView = () => (
    <div className="grid grid-cols-7 gap-px bg-border">
      {WEEKDAY_LABELS.map((day, idx) => (
        <div
          key={day}
          className={`p-2 text-center text-sm font-medium bg-muted ${
            idx === 5 ? "text-blue-500" : idx === 6 ? "text-red-500" : ""
          }`}
        >
          {day}
        </div>
      ))}

      {monthDays.map((date, idx) => {
        const dayEvents = getEventsForDate(date);
        const isCurrentMonth = isSameMonth(date, currentDate);
        const dayOfWeek = date.getDay();
        const dateStr = format(date, "yyyy-MM-dd");
        const isDragOver = dragOverDate === dateStr;

        return (
          <div
            key={idx}
            className={`min-h-[80px] p-1 bg-background cursor-pointer hover:bg-muted/50 ${
              !isCurrentMonth ? "opacity-40" : ""
            } ${isDragOver ? "bg-blue-100 ring-2 ring-blue-400" : ""}`}
            onClick={() => handleDateClick(date)}
            onDrop={(e) => handleDrop(date, e)}
            onDragOver={(e) => handleDragOver(date, e)}
            onDragLeave={handleDragLeave}
          >
            <div
              className={`text-sm mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                isToday(date)
                  ? "bg-primary text-primary-foreground"
                  : dayOfWeek === 0
                  ? "text-red-500"
                  : dayOfWeek === 6
                  ? "text-blue-500"
                  : ""
              }`}
            >
              {format(date, "d")}
            </div>
            <div className="space-y-0.5">
              {dayEvents.slice(0, 2).map((event) => renderEvent(event, true))}
              {dayEvents.length > 2 && (
                <div className="text-xs text-muted-foreground">
                  +{dayEvents.length - 2}件
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // 週表示
  const renderWeekView = () => (
    <div className="overflow-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="p-2 bg-muted border text-left min-w-[80px] sticky left-0 z-10">
              社員
            </th>
            {weekDays.map((date, idx) => (
              <th
                key={idx}
                className={`p-2 text-center bg-muted border min-w-[120px] ${
                  idx === 5 ? "text-blue-500" : idx === 6 ? "text-red-500" : ""
                }`}
              >
                <div className="text-sm font-medium">{WEEKDAY_LABELS[idx]}</div>
                <div
                  className={`text-lg ${
                    isToday(date)
                      ? "w-8 h-8 mx-auto flex items-center justify-center rounded-full bg-primary text-primary-foreground"
                      : ""
                  }`}
                >
                  {format(date, "d")}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weekViewEmployees.map((employee) => (
            <tr key={employee.id}>
              <td className="p-2 bg-muted/50 border font-medium sticky left-0 z-10 whitespace-nowrap">
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{employee.name}</span>
                  {employee.id === currentEmployeeId && (
                    <span className="text-xs text-muted-foreground">(自分)</span>
                  )}
                </div>
              </td>
              {weekDays.map((date, idx) => {
                const dayEvents = getEventsForDateAndEmployee(date, employee.id);
                const dateStr = format(date, "yyyy-MM-dd");
                const isDragOver = dragOverDate === dateStr;
                return (
                  <td
                    key={idx}
                    className={`p-2 bg-background border align-top cursor-pointer hover:bg-muted/50 ${
                      isDragOver ? "bg-blue-100 ring-2 ring-blue-400" : ""
                    }`}
                    onClick={() => handleDateClick(date)}
                    onDrop={(e) => handleDrop(date, e)}
                    onDragOver={(e) => handleDragOver(date, e)}
                    onDragLeave={handleDragLeave}
                  >
                    <div className="space-y-1 min-h-[60px]">
                      {dayEvents.map((event) => renderEvent(event))}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
          {weekViewEmployees.length === 0 && (
            <tr>
              <td colSpan={8} className="p-4 text-center text-muted-foreground">
                表示する社員がいません
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  // 日表示
  const renderDayView = () => {
    const dayEvents = getEventsForDate(currentDate);
    const dateStr = format(currentDate, "yyyy-MM-dd");
    const isDragOver = dragOverDate === dateStr;

    return (
      <div className="border rounded-lg overflow-hidden">
        <div
          className={`p-4 bg-muted cursor-pointer hover:bg-muted/80 ${
            isDragOver ? "bg-blue-100 ring-2 ring-blue-400" : ""
          }`}
          onClick={() => handleDateClick(currentDate)}
          onDrop={(e) => handleDrop(currentDate, e)}
          onDragOver={(e) => handleDragOver(currentDate, e)}
          onDragLeave={handleDragLeave}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="text-lg font-medium">
              {format(currentDate, "M月d日(E)", { locale: ja })}
            </div>
            <Button size="sm" onClick={() => handleDateClick(currentDate)}>
              <Plus className="h-4 w-4 mr-1" />
              予定を追加
            </Button>
          </div>

          {dayEvents.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              予定はありません
            </p>
          ) : (
            <div className="space-y-2">
              {dayEvents.map((event) => renderEvent(event))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="h-full flex flex-col">
      {/* ナビゲーション */}
      <div className="flex items-center justify-between flex-wrap gap-2 p-4 border-b">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={navigatePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={navigateToday}>
            今日
          </Button>
          <Button variant="outline" size="sm" onClick={navigateNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold ml-2">{getTitle()}</h2>
        </div>

        <div className="flex gap-2 flex-wrap">
          {/* 社員フィルター */}
          <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <span className="flex items-center gap-2">
                  <UsersRound className="h-4 w-4" />
                  全員
                </span>
              </SelectItem>
              {currentEmployeeId && (
                <SelectItem value="me">
                  <span className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    自分
                  </span>
                </SelectItem>
              )}
              {sortedEmployees.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  <span className="flex items-center gap-2">
                    <User className="h-4 w-4 opacity-50" />
                    {emp.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 表示切替 */}
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === "day" ? "default" : "ghost"}
              size="sm"
              className="rounded-r-none"
              onClick={() => setViewMode("day")}
            >
              <CalendarRange className="h-4 w-4 mr-1" />
              日
            </Button>
            <Button
              variant={viewMode === "week" ? "default" : "ghost"}
              size="sm"
              className="rounded-none border-x"
              onClick={() => setViewMode("week")}
            >
              <CalendarDays className="h-4 w-4 mr-1" />
              週
            </Button>
            <Button
              variant={viewMode === "month" ? "default" : "ghost"}
              size="sm"
              className="rounded-l-none"
              onClick={() => setViewMode("month")}
            >
              <Calendar className="h-4 w-4 mr-1" />
              月
            </Button>
          </div>

          {/* 新規作成ボタン */}
          <Button size="sm" onClick={() => handleDateClick(new Date())}>
            <Plus className="h-4 w-4 mr-1" />
            追加
          </Button>

          {/* 設定リンク */}
          <Link href="/calendar/settings">
            <Button variant="outline" size="icon" className="h-8 w-8">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* カレンダー本体 */}
      <CardContent className="p-0 flex-1 overflow-auto">
        {viewMode === "month" && renderMonthView()}
        {viewMode === "week" && renderWeekView()}
        {viewMode === "day" && renderDayView()}
      </CardContent>

      {/* イベント作成・編集モーダル */}
      <EventModal
        open={showEventModal}
        onOpenChange={setShowEventModal}
        employees={employees}
        eventCategories={eventCategories}
        selectedDate={selectedDate}
        event={selectedEvent}
        onSaved={handleEventUpdated}
        currentEmployeeId={currentEmployeeId}
      />

      {/* イベント詳細モーダル */}
      <EventDetailModal
        open={showDetailModal}
        onOpenChange={setShowDetailModal}
        event={selectedEvent}
        onEdit={handleEditEvent}
        onDeleted={handleEventUpdated}
      />
    </Card>
  );
}
