import { CalendarView } from "./calendar-view";
import { getEventsInRange, getEmployees, getCurrentEmployeeId, getEventCategories } from "./actions";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  format,
  subMonths,
  addMonths,
  parseISO,
} from "date-fns";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const params = await searchParams;
  const view = (params.view as "day" | "week" | "month") || "month";
  const dateParam = params.date || format(new Date(), "yyyy-MM-dd");
  const currentDate = parseISO(dateParam);

  // 表示範囲を計算（前後の月も含める）
  const rangeStart = format(subMonths(startOfMonth(currentDate), 1), "yyyy-MM-dd");
  const rangeEnd = format(addMonths(endOfMonth(currentDate), 1), "yyyy-MM-dd");

  // イベントと社員と現在のユーザーと区分マスタを取得
  const [events, employees, currentEmployeeId, eventCategories] = await Promise.all([
    getEventsInRange(rangeStart, rangeEnd),
    getEmployees(),
    getCurrentEmployeeId(),
    getEventCategories(),
  ]);

  return (
    <main className="mx-auto px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">カレンダー</h1>
        <p className="text-muted-foreground">スケジュール管理</p>
      </header>

      <CalendarView
        initialEvents={events}
        employees={employees}
        eventCategories={eventCategories}
        initialView={view}
        initialDate={dateParam}
        currentEmployeeId={currentEmployeeId}
      />
    </main>
  );
}
