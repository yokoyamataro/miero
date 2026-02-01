"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
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
  EVENT_CATEGORY_COLORS,
  type EventCategory,
} from "@/types/database";
import { EventModal } from "./event-modal";
import { EventDetailModal } from "./event-detail-modal";

type ViewMode = "day" | "week" | "month";
type EmployeeFilter = "me" | "all" | string; // "me" = 自分のみ, "all" = 全員, string = 特定の社員ID

interface CalendarViewProps {
  initialEvents: CalendarEventWithParticipants[];
  employees: Employee[];
  initialView: ViewMode;
  initialDate: string;
  currentEmployeeId: string | null;
}

// 月曜始まり
const WEEKDAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

export function CalendarView({
  initialEvents,
  employees,
  initialView,
  initialDate,
  currentEmployeeId,
}: CalendarViewProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>(initialView);
  const [currentDate, setCurrentDate] = useState(parseISO(initialDate));
  const [events, setEvents] = useState(initialEvents);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventWithParticipants | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [employeeFilter, setEmployeeFilter] = useState<EmployeeFilter>("all");

  // フィルタリングされたイベント
  const filteredEvents = useMemo(() => {
    if (employeeFilter === "all") {
      return events;
    }

    const targetEmployeeId = employeeFilter === "me" ? currentEmployeeId : employeeFilter;
    if (!targetEmployeeId) return events;

    return events.filter((event) => {
      // 作成者が対象社員
      if (event.created_by === targetEmployeeId) return true;
      // 参加者に対象社員が含まれる
      if (event.participants.some((p) => p.id === targetEmployeeId)) return true;
      return false;
    });
  }, [events, employeeFilter, currentEmployeeId]);

  // 月表示のカレンダー日付を生成（月曜始まり）
  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentDate]);

  // 週表示の日付を生成（月曜始まり）
  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
  }, [currentDate]);

  // 日付ごとのイベントを取得（フィルタリング済み）
  const getEventsForDate = (date: Date) => {
    return filteredEvents.filter((event) => {
      const startDate = parseISO(event.start_date);
      const endDate = event.end_date ? parseISO(event.end_date) : startDate;
      return date >= startDate && date <= endDate;
    });
  };

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
    // SSRからのデータを再取得するためにページをリロード
    window.location.reload();
  };

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

  // イベントレンダリング
  const renderEvent = (event: CalendarEventWithParticipants, compact = false) => {
    const categoryColor = EVENT_CATEGORY_COLORS[event.category];
    const timeStr = event.start_time ? event.start_time.slice(0, 5) : "";

    if (compact) {
      return (
        <div
          key={event.id}
          className={`text-xs truncate px-1 py-0.5 rounded ${categoryColor} text-white cursor-pointer hover:opacity-80`}
          onClick={(e) => handleEventClick(event, e)}
          title={event.title}
        >
          {timeStr && <span className="mr-1">{timeStr}</span>}
          {event.title}
        </div>
      );
    }

    return (
      <div
        key={event.id}
        className={`p-2 rounded ${categoryColor} text-white cursor-pointer hover:opacity-80 mb-1`}
        onClick={(e) => handleEventClick(event, e)}
      >
        <div className="font-medium">{event.title}</div>
        {event.start_time && (
          <div className="text-sm flex items-center gap-1 mt-1">
            <Clock className="h-3 w-3" />
            {event.start_time.slice(0, 5)}
            {event.end_time && ` - ${event.end_time.slice(0, 5)}`}
          </div>
        )}
        {event.location && (
          <div className="text-sm flex items-center gap-1 mt-1">
            <MapPin className="h-3 w-3" />
            <span className="truncate">{event.location}</span>
          </div>
        )}
        {event.participants.length > 0 && (
          <div className="text-sm flex items-center gap-1 mt-1">
            <Users className="h-3 w-3" />
            {event.participants.map((p) => p.name).join(", ")}
          </div>
        )}
      </div>
    );
  };

  // 月表示
  const renderMonthView = () => (
    <div className="grid grid-cols-7 gap-px bg-border">
      {/* 曜日ヘッダー（月曜始まり） */}
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

      {/* 日付セル */}
      {monthDays.map((date, idx) => {
        const dayEvents = getEventsForDate(date);
        const isCurrentMonth = isSameMonth(date, currentDate);
        const dayOfWeek = date.getDay();

        return (
          <div
            key={idx}
            className={`min-h-[100px] p-1 bg-background cursor-pointer hover:bg-muted/50 ${
              !isCurrentMonth ? "opacity-40" : ""
            }`}
            onClick={() => handleDateClick(date)}
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
              {dayEvents.slice(0, 3).map((event) => renderEvent(event, true))}
              {dayEvents.length > 3 && (
                <div className="text-xs text-muted-foreground">
                  +{dayEvents.length - 3}件
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
    <div className="grid grid-cols-7 gap-px bg-border">
      {/* 曜日ヘッダー（月曜始まり） */}
      {weekDays.map((date, idx) => (
        <div
          key={idx}
          className={`p-2 text-center bg-muted ${
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
        </div>
      ))}

      {/* イベントセル */}
      {weekDays.map((date, idx) => {
        const dayEvents = getEventsForDate(date);

        return (
          <div
            key={idx}
            className="min-h-[300px] p-2 bg-background cursor-pointer hover:bg-muted/50"
            onClick={() => handleDateClick(date)}
          >
            <div className="space-y-1">
              {dayEvents.map((event) => renderEvent(event))}
            </div>
          </div>
        );
      })}
    </div>
  );

  // 日表示
  const renderDayView = () => {
    const dayEvents = getEventsForDate(currentDate);
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <div className="border rounded-lg overflow-hidden">
        <div
          className="p-4 bg-muted cursor-pointer hover:bg-muted/80"
          onClick={() => handleDateClick(currentDate)}
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
    <div className="space-y-4">
      {/* ナビゲーション */}
      <div className="flex items-center justify-between flex-wrap gap-2">
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
          <h2 className="text-xl font-semibold ml-2">{getTitle()}</h2>
        </div>

        <div className="flex gap-2 flex-wrap">
          {/* 社員フィルター */}
          <div className="flex items-center gap-1">
            <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <UsersRound className="h-4 w-4" />
                    全員の予定
                  </div>
                </SelectItem>
                {currentEmployeeId && (
                  <SelectItem value="me">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      自分の予定
                    </div>
                  </SelectItem>
                )}
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 opacity-50" />
                      {emp.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
          <Button onClick={() => handleDateClick(new Date())}>
            <Plus className="h-4 w-4 mr-1" />
            予定を追加
          </Button>
        </div>
      </div>

      {/* カレンダー本体 */}
      <Card>
        <CardContent className="p-0 overflow-hidden">
          {viewMode === "month" && renderMonthView()}
          {viewMode === "week" && renderWeekView()}
          {viewMode === "day" && renderDayView()}
        </CardContent>
      </Card>

      {/* 凡例 */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-muted-foreground">区分:</span>
            {(Object.keys(EVENT_CATEGORY_COLORS) as EventCategory[]).map((cat) => (
              <div key={cat} className="flex items-center gap-1">
                <div className={`w-3 h-3 rounded ${EVENT_CATEGORY_COLORS[cat]}`} />
                <span>{cat}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* イベント作成・編集モーダル */}
      <EventModal
        open={showEventModal}
        onOpenChange={setShowEventModal}
        employees={employees}
        selectedDate={selectedDate}
        event={selectedEvent}
        onSaved={handleEventUpdated}
      />

      {/* イベント詳細モーダル */}
      <EventDetailModal
        open={showDetailModal}
        onOpenChange={setShowDetailModal}
        event={selectedEvent}
        onEdit={handleEditEvent}
        onDeleted={handleEventUpdated}
      />
    </div>
  );
}
