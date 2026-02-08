import { format, subMonths, addMonths, startOfMonth, endOfMonth } from "date-fns";
import { getEventsInRange, getEmployees, getCurrentEmployeeId, getEventCategories } from "./calendar/actions";
import { getIncompleteTasks } from "./dashboard-actions";
import { DashboardView } from "./dashboard-view";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const params = await searchParams;
  const today = new Date();
  const rangeStart = format(subMonths(startOfMonth(today), 1), "yyyy-MM-dd");
  const rangeEnd = format(addMonths(endOfMonth(today), 1), "yyyy-MM-dd");

  // URLパラメータから表示モードと日付を取得
  const initialView = (params.view as "day" | "week" | "month") || "day";
  const initialDate = params.date || format(today, "yyyy-MM-dd");

  // 並列でデータ取得
  const [events, employees, currentEmployeeId, eventCategories, tasks] =
    await Promise.all([
      getEventsInRange(rangeStart, rangeEnd),
      getEmployees(),
      getCurrentEmployeeId(),
      getEventCategories(),
      getIncompleteTasks(),
    ]);

  return (
    <main className="mx-auto px-4 py-4">
      <DashboardView
        events={events}
        employees={employees}
        eventCategories={eventCategories}
        currentEmployeeId={currentEmployeeId}
        tasks={tasks}
        initialView={initialView}
        initialDate={initialDate}
      />
    </main>
  );
}
