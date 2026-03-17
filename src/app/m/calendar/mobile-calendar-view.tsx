"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDay } from "date-fns";
import { ja } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
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

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function MobileCalendarView({
  events,
  categories,
  employees,
  currentEmployeeId,
  initialMonth,
}: MobileCalendarViewProps) {
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date(initialMonth + "-01"));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showEventSheet, setShowEventSheet] = useState(false);

  // 月の日付を生成
  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // 月初の曜日分の空セルを追加
    const startDayOfWeek = getDay(monthStart);
    const paddingDays = Array(startDayOfWeek).fill(null);

    return [...paddingDays, ...allDays];
  }, [currentMonth]);

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

  // 選択日のイベント
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    return eventsByDate.get(dateKey) || [];
  }, [selectedDate, eventsByDate]);

  const goToPrevMonth = () => {
    const newMonth = subMonths(currentMonth, 1);
    setCurrentMonth(newMonth);
    router.push(`/m/calendar?month=${format(newMonth, "yyyy-MM")}`);
  };

  const goToNextMonth = () => {
    const newMonth = addMonths(currentMonth, 1);
    setCurrentMonth(newMonth);
    router.push(`/m/calendar?month=${format(newMonth, "yyyy-MM")}`);
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setShowEventSheet(true);
  };

  const today = new Date();

  return (
    <>
      {/* ヘッダー */}
      <header className="sticky top-0 bg-background border-b z-10 px-4 py-3">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={goToPrevMonth}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold">
            {format(currentMonth, "yyyy年M月", { locale: ja })}
          </h1>
          <Button variant="ghost" size="icon" onClick={goToNextMonth}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* カレンダーグリッド */}
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
          {days.map((day, index) => {
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
                  !isSameMonth(day, currentMonth) ? "opacity-40" : ""
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
                      const category = categories.find((c) => c.id === event.event_category_id);
                      const color = category?.color || "bg-gray-400";
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
    </>
  );
}
