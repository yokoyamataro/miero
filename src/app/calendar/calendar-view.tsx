"use client";

import { useState, useMemo } from "react";
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
import { EventModal } from "./event-modal";
import { EventDetailModal } from "./event-detail-modal";

type ViewMode = "day" | "threeDay" | "week" | "month";
type EmployeeFilter = "me" | "all" | string; // "me" = 自分のみ, "all" = 全員, string = 特定の社員ID

interface CalendarViewProps {
  initialEvents: CalendarEventWithParticipants[];
  employees: Employee[];
  eventCategories: EventCategory[];
  initialView: ViewMode;
  initialDate: string;
  currentEmployeeId: string | null;
}

// 月曜始まり
const WEEKDAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

export function CalendarView({
  initialEvents,
  employees,
  eventCategories,
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

  // 社員リストをソート（ログインユーザーを先頭に）
  const sortedEmployees = useMemo(() => {
    if (!currentEmployeeId) return employees;
    return [...employees].sort((a, b) => {
      if (a.id === currentEmployeeId) return -1;
      if (b.id === currentEmployeeId) return 1;
      return 0; // 他は登録順のまま
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

  // 3日表示の日付を生成
  const threeDays = useMemo(() => {
    return eachDayOfInterval({ start: currentDate, end: addDays(currentDate, 2) });
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
      case "threeDay":
        setCurrentDate(subDays(currentDate, 3));
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
      case "threeDay":
        setCurrentDate(addDays(currentDate, 3));
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
      case "threeDay":
        const threeDayEnd = addDays(currentDate, 2);
        return `${format(currentDate, "M月d日", { locale: ja })} - ${format(threeDayEnd, "M月d日", { locale: ja })}`;
      case "day":
        return format(currentDate, "yyyy年M月d日(E)", { locale: ja });
    }
  };

  // イベントの区分色を取得
  const getCategoryColor = (event: CalendarEventWithParticipants) => {
    // 新しい区分マスタを使用
    if (event.eventCategory) {
      return event.eventCategory.color;
    }
    // 旧カテゴリーから色を取得（後方互換）
    if (event.category && EVENT_CATEGORY_COLORS[event.category as EventCategoryLegacy]) {
      return EVENT_CATEGORY_COLORS[event.category as EventCategoryLegacy];
    }
    return "bg-gray-500";
  };

  // イベントの区分名を取得
  const getCategoryName = (event: CalendarEventWithParticipants) => {
    if (event.eventCategory) {
      return event.eventCategory.name;
    }
    // 旧カテゴリー名（後方互換）
    if (event.category) {
      return event.category;
    }
    return "";
  };

  // イベントレンダリング
  const renderEvent = (event: CalendarEventWithParticipants, compact = false) => {
    const categoryColor = getCategoryColor(event);
    const categoryName = getCategoryName(event);
    const timeStr = event.start_time ? event.start_time.slice(0, 5) : "";

    if (compact) {
      return (
        <div
          key={event.id}
          className="text-xs truncate cursor-pointer hover:opacity-80 flex items-center gap-1"
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
        className="border rounded cursor-pointer hover:bg-muted/50 mb-1 overflow-hidden"
        onClick={(e) => handleEventClick(event, e)}
      >
        {categoryName && (
          <div className={`${categoryColor} text-white text-xs font-medium px-2 py-0.5`}>{categoryName}</div>
        )}
        <div className="p-2 bg-white">
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

  // 週表示用：日付×社員ごとのイベントを取得
  const getEventsForDateAndEmployee = (date: Date, employeeId: string) => {
    return filteredEvents.filter((event) => {
      const startDate = parseISO(event.start_date);
      const endDate = event.end_date ? parseISO(event.end_date) : startDate;
      const isInDateRange = date >= startDate && date <= endDate;
      if (!isInDateRange) return false;

      // 作成者が対象社員、または参加者に含まれる
      return event.created_by === employeeId ||
             event.participants.some((p) => p.id === employeeId);
    });
  };

  // 週表示に表示する社員リスト（フィルター適用）
  const weekViewEmployees = useMemo(() => {
    if (employeeFilter === "me") {
      // 自分のみ
      return sortedEmployees.filter((emp) => emp.id === currentEmployeeId);
    } else if (employeeFilter === "all") {
      // 全員（自分が先頭）
      return sortedEmployees;
    } else {
      // 特定の社員
      return sortedEmployees.filter((emp) => emp.id === employeeFilter);
    }
  }, [sortedEmployees, employeeFilter, currentEmployeeId]);

  // 週表示
  const renderWeekView = () => (
    <div className="overflow-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {/* 社員名列のヘッダー */}
            <th className="p-2 bg-muted border text-left min-w-[100px] sticky left-0 z-10">
              社員
            </th>
            {/* 曜日ヘッダー（月曜始まり） */}
            {weekDays.map((date, idx) => (
              <th
                key={idx}
                className={`p-2 text-center bg-muted border min-w-[140px] ${
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
              {/* 社員名 */}
              <td className="p-2 bg-muted/50 border font-medium sticky left-0 z-10 whitespace-nowrap">
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{employee.name}</span>
                  {employee.id === currentEmployeeId && (
                    <span className="text-xs text-muted-foreground">(自分)</span>
                  )}
                </div>
              </td>
              {/* 各日のイベント */}
              {weekDays.map((date, idx) => {
                const dayEvents = getEventsForDateAndEmployee(date, employee.id);
                return (
                  <td
                    key={idx}
                    className="p-2 bg-background border align-top cursor-pointer hover:bg-muted/50 min-h-[100px]"
                    onClick={() => handleDateClick(date)}
                  >
                    <div className="space-y-1 min-h-[80px]">
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

  // 薄い背景色マッピング
  const LIGHT_BG_MAP: Record<string, string> = {
    "bg-blue-500": "bg-blue-100",
    "bg-blue-300": "bg-blue-100",
    "bg-indigo-500": "bg-indigo-100",
    "bg-sky-500": "bg-sky-100",
    "bg-green-500": "bg-green-100",
    "bg-green-300": "bg-green-100",
    "bg-teal-500": "bg-teal-100",
    "bg-emerald-500": "bg-emerald-100",
    "bg-yellow-500": "bg-yellow-100",
    "bg-orange-500": "bg-orange-100",
    "bg-red-500": "bg-red-100",
    "bg-pink-500": "bg-pink-100",
    "bg-purple-500": "bg-purple-100",
    "bg-violet-500": "bg-violet-100",
    "bg-fuchsia-500": "bg-fuchsia-100",
    "bg-cyan-500": "bg-cyan-100",
    "bg-rose-500": "bg-rose-100",
    "bg-amber-500": "bg-amber-100",
    "bg-gray-500": "bg-gray-100",
    "bg-gray-400": "bg-gray-100",
    "bg-slate-500": "bg-slate-100",
    "bg-slate-400": "bg-slate-100",
  };
  const getLightBgColor = (categoryColor: string) => {
    return LIGHT_BG_MAP[categoryColor] || "bg-gray-100";
  };

  // 3日表示用：自分のイベントのみ取得
  const getMyEventsForDate = (date: Date) => {
    if (!currentEmployeeId) return getEventsForDate(date);
    return filteredEvents.filter((event) => {
      const startDate = parseISO(event.start_date);
      const endDate = event.end_date ? parseISO(event.end_date) : startDate;
      const isInDateRange = date >= startDate && date <= endDate;
      if (!isInDateRange) return false;
      return event.created_by === currentEmployeeId ||
             event.participants.some((p) => p.id === currentEmployeeId);
    });
  };

  // 3日表示（時間軸付き）
  const renderThreeDayView = () => {
    // 時間枠ラベル: ～8:00, 8:00～9:00, ..., 17:00～18:00, 18:00～
    const hourLabels = [
      { label: "～8:00", hour: -1 },
      ...Array.from({ length: 10 }, (_, i) => ({ label: `${i + 8}:00`, hour: i + 8 })),
      { label: "18:00～", hour: 18 },
    ];

    // イベントを時間枠に配置するヘルパー
    const getEventPosition = (event: CalendarEventWithParticipants) => {
      if (!event.start_time) return null;
      const [startHour, startMin] = event.start_time.split(":").map(Number);
      const startMinutes = startHour * 60 + startMin;

      const baseMinutes = 8 * 60;
      const firstSlotHeight = 48;
      let top: number;

      if (startMinutes < baseMinutes) {
        top = 0;
      } else if (startMinutes >= 18 * 60) {
        top = firstSlotHeight + 10 * 48;
      } else {
        top = firstSlotHeight + ((startMinutes - baseMinutes) / 60) * 48;
      }

      let height = 48;
      if (event.end_time) {
        const [endHour, endMin] = event.end_time.split(":").map(Number);
        const endMinutes = endHour * 60 + endMin;
        height = Math.max(24, ((endMinutes - startMinutes) / 60) * 48);
      }

      return { top, height };
    };

    const getAllDayEvents = (date: Date) => {
      return getMyEventsForDate(date).filter((e) => !e.start_time || e.all_day);
    };

    const getTimedEvents = (date: Date) => {
      return getMyEventsForDate(date).filter((e) => e.start_time && !e.all_day);
    };

    return (
      <div className="overflow-auto">
        {/* ヘッダー */}
        <div className="grid grid-cols-[60px_1fr_1fr_1fr] border-b">
          <div className="p-2 bg-muted border-r text-center text-xs font-medium">時間</div>
          {threeDays.map((date, idx) => {
            const dayOfWeek = date.getDay();
            return (
              <div
                key={idx}
                className={`p-2 bg-muted border-r text-center ${
                  dayOfWeek === 0 ? "text-red-500" : dayOfWeek === 6 ? "text-blue-500" : ""
                }`}
              >
                <div className="text-sm font-medium">{format(date, "M/d(E)", { locale: ja })}</div>
                {isToday(date) && (
                  <span className="inline-block w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs leading-6">
                    今
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* 終日イベント行 */}
        <div className="grid grid-cols-[60px_1fr_1fr_1fr] border-b bg-gray-50">
          <div className="p-1 border-r text-xs text-muted-foreground text-center">終日</div>
          {threeDays.map((date, idx) => {
            const allDayEvents = getAllDayEvents(date);
            return (
              <div
                key={idx}
                className="p-1 border-r min-h-[32px] cursor-pointer hover:bg-muted/50"
                onClick={() => handleDateClick(date)}
              >
                {allDayEvents.map((event) => renderEvent(event, true))}
              </div>
            );
          })}
        </div>

        {/* 時間軸 */}
        <div className="grid grid-cols-[60px_1fr_1fr_1fr]">
          <div className="border-r">
            {hourLabels.map((slot, idx) => (
              <div key={idx} className="h-12 border-b text-xs text-muted-foreground text-right pr-2 pt-0.5">
                {slot.label}
              </div>
            ))}
          </div>

          {threeDays.map((date, dayIdx) => {
            const timedEvents = getTimedEvents(date);
            return (
              <div
                key={dayIdx}
                className="border-r relative cursor-pointer"
                onClick={() => handleDateClick(date)}
              >
                {hourLabels.map((_, idx) => (
                  <div key={idx} className="h-12 border-b hover:bg-muted/30" />
                ))}

                {timedEvents.map((event) => {
                  const pos = getEventPosition(event);
                  if (!pos) return null;
                  const categoryColor = getCategoryColor(event);
                  const lightBgColor = getLightBgColor(categoryColor);
                  const categoryName = getCategoryName(event);
                  return (
                    <div
                      key={event.id}
                      className={`absolute left-0.5 right-0.5 rounded px-1 py-0.5 overflow-hidden cursor-pointer hover:opacity-80 border ${lightBgColor}`}
                      style={{ top: pos.top, height: pos.height }}
                      onClick={(e) => handleEventClick(event, e)}
                    >
                      <div className="text-xs font-medium truncate text-black">
                        {event.start_time?.slice(0, 5)} {event.title}
                      </div>
                      {categoryName && pos.height >= 36 && (
                        <span className={`${categoryColor} text-white px-1 rounded text-[10px]`}>{categoryName}</span>
                      )}
                      {event.location && pos.height >= 48 && (
                        <div className="text-[10px] text-black truncate flex items-center gap-0.5">
                          <MapPin className="h-2.5 w-2.5" />
                          {event.location}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
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
                  <span className="flex items-center gap-2">
                    <UsersRound className="h-4 w-4" />
                    全員の予定
                  </span>
                </SelectItem>
                {currentEmployeeId && (
                  <SelectItem value="me">
                    <span className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      自分の予定
                    </span>
                  </SelectItem>
                )}
                {sortedEmployees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    <span className="flex items-center gap-2">
                      <User className="h-4 w-4 opacity-50" />
                      {emp.name}
                      {emp.id === currentEmployeeId && (
                        <span className="text-xs text-muted-foreground">(自分)</span>
                      )}
                    </span>
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
              variant={viewMode === "threeDay" ? "default" : "ghost"}
              size="sm"
              className="rounded-none border-x"
              onClick={() => setViewMode("threeDay")}
            >
              3日
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

          {/* 設定ボタン */}
          <Link href="/calendar/settings">
            <Button variant="outline" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* カレンダー本体 */}
      <Card>
        <CardContent className="p-0 overflow-hidden">
          {viewMode === "month" && renderMonthView()}
          {viewMode === "week" && renderWeekView()}
          {viewMode === "threeDay" && renderThreeDayView()}
          {viewMode === "day" && renderDayView()}
        </CardContent>
      </Card>

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
    </div>
  );
}
