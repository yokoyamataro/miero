"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  addDays,
  subDays,
  getDay,
  parseISO,
} from "date-fns";
import { ja } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar, CalendarDays, CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type CalendarEventWithParticipants, type EventCategory } from "@/types/database";
import { MobileEventSheet } from "./mobile-event-sheet";

interface Employee {
  id: string;
  name: string;
}

interface MobileCalendarViewProps {
  events: CalendarEventWithParticipants[];
  categories: EventCategory[];
  employees: Employee[];
  currentEmployeeId: string | null;
  initialMonth: string;
}

type ViewMode = "month" | "fiveDay" | "day";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

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

export function MobileCalendarView({
  events,
  categories,
  employees,
  currentEmployeeId,
  initialMonth,
}: MobileCalendarViewProps) {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date(initialMonth + "-01"));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showEventSheet, setShowEventSheet] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(currentEmployeeId);

  // 月の日付を生成
  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // 月初の曜日分の空セルを追加
    const startDayOfWeek = getDay(monthStart);
    const paddingDays = Array(startDayOfWeek).fill(null);

    return [...paddingDays, ...allDays];
  }, [currentDate]);

  // 5日表示用の日付
  const fiveDays = useMemo(() => {
    return eachDayOfInterval({ start: currentDate, end: addDays(currentDate, 4) });
  }, [currentDate]);

  // 日付ごとのイベントをマップ
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEventWithParticipants[]>();
    events.forEach((event) => {
      const dateKey = event.start_date;
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(event);
    });
    return map;
  }, [events]);

  // 特定社員のイベントを取得
  const getEventsForDateAndEmployee = (date: Date, employeeId: string | null) => {
    const dateKey = format(date, "yyyy-MM-dd");
    const dayEvents = eventsByDate.get(dateKey) || [];
    if (!employeeId) return dayEvents;
    return dayEvents.filter((event) => {
      return event.created_by === employeeId ||
             event.participants.some((p) => p.id === employeeId);
    });
  };

  // 選択日のイベント
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    return eventsByDate.get(dateKey) || [];
  }, [selectedDate, eventsByDate]);

  // ナビゲーション
  const navigatePrev = () => {
    switch (viewMode) {
      case "month":
        const prevMonth = subMonths(currentDate, 1);
        setCurrentDate(prevMonth);
        router.push(`/m/calendar?month=${format(prevMonth, "yyyy-MM")}`);
        break;
      case "fiveDay":
        setCurrentDate(subDays(currentDate, 5));
        break;
      case "day":
        setCurrentDate(subDays(currentDate, 1));
        break;
    }
  };

  const navigateNext = () => {
    switch (viewMode) {
      case "month":
        const nextMonth = addMonths(currentDate, 1);
        setCurrentDate(nextMonth);
        router.push(`/m/calendar?month=${format(nextMonth, "yyyy-MM")}`);
        break;
      case "fiveDay":
        setCurrentDate(addDays(currentDate, 5));
        break;
      case "day":
        setCurrentDate(addDays(currentDate, 1));
        break;
    }
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setShowEventSheet(true);
  };

  const today = new Date();

  // カテゴリー色を取得
  const getCategoryColor = (event: CalendarEventWithParticipants) => {
    if (event.eventCategory) {
      return event.eventCategory.color;
    }
    const category = categories.find((c) => c.id === event.event_category_id);
    return category?.color || "bg-gray-400";
  };

  const getLightBgColor = (categoryColor: string) => {
    return LIGHT_BG_MAP[categoryColor] || "bg-gray-100";
  };

  // イベント位置計算（1日・5日表示用）
  const getEventPosition = (event: CalendarEventWithParticipants) => {
    if (!event.start_time) return null;
    const [startHour, startMin] = event.start_time.split(":").map(Number);
    const startMinutes = startHour * 60 + startMin;

    const baseMinutes = 8 * 60;
    const firstSlotHeight = 40; // ~8:00枠の高さ
    let top: number;

    if (startMinutes < baseMinutes) {
      top = 0;
    } else if (startMinutes >= 18 * 60) {
      top = firstSlotHeight + 10 * 40;
    } else {
      top = firstSlotHeight + ((startMinutes - baseMinutes) / 60) * 40;
    }

    let height = 40;
    if (event.end_time) {
      const [endHour, endMin] = event.end_time.split(":").map(Number);
      const endMinutes = endHour * 60 + endMin;
      height = Math.max(20, ((endMinutes - startMinutes) / 60) * 40);
    }

    return { top, height };
  };

  // タイトル
  const getTitle = () => {
    switch (viewMode) {
      case "month":
        return format(currentDate, "yyyy年M月", { locale: ja });
      case "fiveDay":
        const fiveDayEnd = addDays(currentDate, 4);
        return `${format(currentDate, "M/d", { locale: ja })} - ${format(fiveDayEnd, "M/d", { locale: ja })}`;
      case "day":
        return format(currentDate, "M月d日(E)", { locale: ja });
    }
  };

  // 月表示
  const renderMonthView = () => (
    <div className="flex-1 px-2 py-2">
      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((day, i) => (
          <div
            key={day}
            className={`text-center text-xs font-medium py-1 ${
              i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-muted-foreground"
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* 日付グリッド */}
      <div className="grid grid-cols-7 gap-px bg-border">
        {monthDays.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} className="bg-background aspect-square" />;
          }

          const dateKey = format(day, "yyyy-MM-dd");
          const dayEvents = eventsByDate.get(dateKey) || [];
          const isToday = isSameDay(day, today);
          const dayOfWeek = getDay(day);
          const isSunday = dayOfWeek === 0;
          const isSaturday = dayOfWeek === 6;

          return (
            <button
              key={dateKey}
              onClick={() => handleDateClick(day)}
              className={`bg-background aspect-square p-1 flex flex-col items-center relative ${
                !isSameMonth(day, currentDate) ? "opacity-40" : ""
              }`}
            >
              <span
                className={`text-sm w-7 h-7 flex items-center justify-center rounded-full ${
                  isToday
                    ? "bg-primary text-primary-foreground font-bold"
                    : isSunday
                    ? "text-red-500"
                    : isSaturday
                    ? "text-blue-500"
                    : ""
                }`}
              >
                {format(day, "d")}
              </span>
              {/* イベントドット */}
              {dayEvents.length > 0 && (
                <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                  {dayEvents.slice(0, 3).map((event, i) => {
                    const color = getCategoryColor(event);
                    return (
                      <span
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full ${color}`}
                      />
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <span className="text-[10px] text-muted-foreground">+{dayEvents.length - 3}</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  // 5日表示
  const renderFiveDayView = () => {
    const hourLabels = [
      { label: "~8:00", hour: -1 },
      ...Array.from({ length: 10 }, (_, i) => ({ label: `${i + 8}:00`, hour: i + 8 })),
      { label: "18:00~", hour: 18 },
    ];

    const getAllDayEvents = (date: Date) => {
      const dateKey = format(date, "yyyy-MM-dd");
      const dayEvents = eventsByDate.get(dateKey) || [];
      return dayEvents.filter((e) => !e.start_time || e.all_day);
    };

    const getTimedEvents = (date: Date) => {
      const dateKey = format(date, "yyyy-MM-dd");
      const dayEvents = eventsByDate.get(dateKey) || [];
      return dayEvents.filter((e) => e.start_time && !e.all_day);
    };

    return (
      <div className="flex-1 overflow-auto">
        {/* ヘッダー */}
        <div className="grid sticky top-0 bg-background z-10 border-b" style={{ gridTemplateColumns: '40px repeat(5, 1fr)' }}>
          <div className="p-1 bg-muted border-r text-center text-[10px] font-medium">時間</div>
          {fiveDays.map((date, idx) => {
            const dayOfWeek = getDay(date);
            const isToday = isSameDay(date, today);
            return (
              <div
                key={idx}
                className={`p-1 bg-muted border-r text-center ${
                  dayOfWeek === 0 ? "text-red-500" : dayOfWeek === 6 ? "text-blue-500" : ""
                }`}
              >
                <div className="text-[10px] font-medium">{format(date, "M/d")}</div>
                <div className={`text-xs ${isToday ? "bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center mx-auto" : ""}`}>
                  {format(date, "E", { locale: ja })}
                </div>
              </div>
            );
          })}
        </div>

        {/* 終日イベント */}
        <div className="grid border-b bg-gray-50" style={{ gridTemplateColumns: '40px repeat(5, 1fr)' }}>
          <div className="p-0.5 border-r text-[9px] text-muted-foreground text-center">終日</div>
          {fiveDays.map((date, idx) => {
            const allDayEvents = getAllDayEvents(date);
            return (
              <div
                key={idx}
                className="p-0.5 border-r min-h-[24px] overflow-hidden"
                onClick={() => handleDateClick(date)}
              >
                {allDayEvents.slice(0, 2).map((event, i) => {
                  const color = getCategoryColor(event);
                  return (
                    <div key={i} className={`text-[9px] truncate px-0.5 rounded ${color} text-white`}>
                      {event.title}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* 時間軸 */}
        <div className="grid" style={{ gridTemplateColumns: '40px repeat(5, 1fr)' }}>
          <div className="border-r">
            {hourLabels.map((slot, idx) => (
              <div key={idx} className={`h-10 border-b text-[9px] text-muted-foreground text-right pr-1 pt-0.5 ${slot.hour === 12 ? "bg-gray-100" : ""}`}>
                {slot.label}
              </div>
            ))}
          </div>

          {fiveDays.map((date, dayIdx) => {
            const timedEvents = getTimedEvents(date);
            return (
              <div
                key={dayIdx}
                className="border-r relative"
                onClick={() => handleDateClick(date)}
              >
                {hourLabels.map((slot, idx) => (
                  <div key={idx} className={`h-10 border-b ${slot.hour === 12 ? "bg-gray-100" : ""}`} />
                ))}

                {timedEvents.map((event) => {
                  const pos = getEventPosition(event);
                  if (!pos) return null;
                  const categoryColor = getCategoryColor(event);
                  const lightBgColor = getLightBgColor(categoryColor);
                  return (
                    <div
                      key={event.id}
                      className={`absolute left-0 right-0 mx-0.5 rounded px-0.5 overflow-hidden border text-[9px] ${lightBgColor}`}
                      style={{ top: pos.top, height: pos.height }}
                    >
                      <div className="truncate text-black font-medium">
                        {event.start_time?.slice(0, 5)}
                      </div>
                      <div className="truncate text-black">
                        {event.title}
                      </div>
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

  // 1日表示（メンバー選択付き）
  const renderDayView = () => {
    const hourLabels = [
      { label: "~8:00", hour: -1 },
      ...Array.from({ length: 10 }, (_, i) => ({ label: `${i + 8}:00`, hour: i + 8 })),
      { label: "18:00~", hour: 18 },
    ];

    const getAllDayEvents = () => {
      return getEventsForDateAndEmployee(currentDate, selectedEmployeeId).filter((e) => !e.start_time || e.all_day);
    };

    const getTimedEvents = () => {
      return getEventsForDateAndEmployee(currentDate, selectedEmployeeId).filter((e) => e.start_time && !e.all_day);
    };

    const allDayEvents = getAllDayEvents();
    const timedEvents = getTimedEvents();
    const dayOfWeek = getDay(currentDate);
    const isToday = isSameDay(currentDate, today);

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* メンバー選択 */}
        <div className="px-2 py-2 border-b bg-muted/50 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {employees.map((emp) => (
              <button
                key={emp.id}
                onClick={() => setSelectedEmployeeId(emp.id)}
                className={`px-3 py-1.5 text-xs rounded-full whitespace-nowrap transition-colors ${
                  selectedEmployeeId === emp.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-background border hover:bg-muted"
                }`}
              >
                {emp.name}
                {emp.id === currentEmployeeId && " (自分)"}
              </button>
            ))}
          </div>
        </div>

        {/* 日付ヘッダー */}
        <div className={`p-2 text-center border-b ${
          dayOfWeek === 0 ? "text-red-500" : dayOfWeek === 6 ? "text-blue-500" : ""
        }`}>
          <div className={`text-lg font-bold ${isToday ? "bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center mx-auto" : ""}`}>
            {format(currentDate, "d")}
          </div>
          <div className="text-xs text-muted-foreground">
            {format(currentDate, "E", { locale: ja })}
          </div>
        </div>

        {/* 終日イベント */}
        {allDayEvents.length > 0 && (
          <div className="p-2 border-b bg-gray-50">
            <div className="text-[10px] text-muted-foreground mb-1">終日</div>
            <div className="space-y-1">
              {allDayEvents.map((event) => {
                const color = getCategoryColor(event);
                return (
                  <div key={event.id} className={`text-xs px-2 py-1 rounded ${color} text-white`}>
                    {event.title}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 時間軸 */}
        <div className="flex-1 overflow-auto">
          <div className="relative">
            {/* 時間ラベル */}
            {hourLabels.map((slot, idx) => (
              <div key={idx} className={`h-12 border-b flex ${slot.hour === 12 ? "bg-gray-100" : ""}`}>
                <div className="w-12 text-[10px] text-muted-foreground text-right pr-2 pt-0.5 flex-shrink-0">
                  {slot.label}
                </div>
                <div className="flex-1 border-l" />
              </div>
            ))}

            {/* イベント */}
            <div className="absolute top-0 left-12 right-0">
              {timedEvents.map((event) => {
                const pos = getEventPosition(event);
                if (!pos) return null;
                const categoryColor = getCategoryColor(event);
                const lightBgColor = getLightBgColor(categoryColor);
                const categoryName = event.eventCategory?.name || categories.find((c) => c.id === event.event_category_id)?.name;
                return (
                  <div
                    key={event.id}
                    className={`absolute left-1 right-1 rounded px-2 py-1 overflow-hidden border ${lightBgColor}`}
                    style={{ top: pos.top, height: pos.height }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDate(currentDate);
                      setShowEventSheet(true);
                    }}
                  >
                    <div className="text-xs font-medium truncate text-black">
                      {event.start_time?.slice(0, 5)} {event.title}
                    </div>
                    {categoryName && pos.height >= 36 && (
                      <span className={`${categoryColor} text-white px-1 rounded text-[10px]`}>{categoryName}</span>
                    )}
                    {event.location && pos.height >= 48 && (
                      <div className="text-[10px] text-black truncate">{event.location}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* ヘッダー */}
      <header className="sticky top-0 bg-background border-b z-10 px-2 py-2">
        <div className="flex items-center justify-between mb-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={navigatePrev}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-base font-bold">
            {getTitle()}
          </h1>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={navigateNext}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* 表示切替 */}
        <div className="flex justify-center gap-1">
          <Button
            variant={viewMode === "day" ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs px-3"
            onClick={() => setViewMode("day")}
          >
            <CalendarRange className="h-3 w-3 mr-1" />
            1日
          </Button>
          <Button
            variant={viewMode === "fiveDay" ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs px-3"
            onClick={() => setViewMode("fiveDay")}
          >
            <CalendarDays className="h-3 w-3 mr-1" />
            5日
          </Button>
          <Button
            variant={viewMode === "month" ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs px-3"
            onClick={() => setViewMode("month")}
          >
            <Calendar className="h-3 w-3 mr-1" />
            月
          </Button>
        </div>
      </header>

      {/* カレンダー本体 */}
      {viewMode === "month" && renderMonthView()}
      {viewMode === "fiveDay" && renderFiveDayView()}
      {viewMode === "day" && renderDayView()}

      {/* 日付選択時のイベント一覧シート */}
      <MobileEventSheet
        open={showEventSheet}
        onOpenChange={setShowEventSheet}
        date={selectedDate}
        events={selectedDateEvents}
        categories={categories}
        employees={employees}
        currentEmployeeId={currentEmployeeId}
      />
    </div>
  );
}
