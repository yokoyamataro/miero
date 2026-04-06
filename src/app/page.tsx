import { format, subMonths, addMonths, startOfMonth, endOfMonth } from "date-fns";
import { getEventsInRange, getEmployees, getCurrentEmployeeId, getEventCategories, getLeavesInRange, getHolidaysInRange } from "./calendar/actions";
import { getActiveProjects, getIncompletePersonalTasks } from "./dashboard-actions";
import { DashboardView } from "./dashboard-view";
import { getFiscalYear } from "@/types/database";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const params = await searchParams;
  const today = new Date();
  const rangeStart = format(subMonths(startOfMonth(today), 1), "yyyy-MM-dd");
  const rangeEnd = format(addMonths(endOfMonth(today), 1), "yyyy-MM-dd");

  // 祝日・休暇は年度全体を取得（4月〜翌3月）
  const fiscalYear = getFiscalYear(today);
  const fiscalYearStart = `${fiscalYear}-04-01`;
  const fiscalYearEnd = `${fiscalYear + 1}-03-31`;

  // URLパラメータから表示モードと日付を取得
  const initialView = (params.view as "dayAll" | "fiveDay" | "fiveDayAll" | "month") || "dayAll";
  const initialDate = params.date || format(today, "yyyy-MM-dd");

  // 並列でデータ取得
  const [events, employees, currentEmployeeId, eventCategories, activeProjects, personalTasks, leaves, holidays] =
    await Promise.all([
      getEventsInRange(rangeStart, rangeEnd),
      getEmployees(),
      getCurrentEmployeeId(),
      getEventCategories(),
      getActiveProjects(),
      getIncompletePersonalTasks(),
      getLeavesInRange(fiscalYearStart, fiscalYearEnd),
      getHolidaysInRange(fiscalYearStart, fiscalYearEnd),
    ]);

  return (
    <main className="mx-auto px-4 py-4">
      <DashboardView
        events={events}
        employees={employees}
        eventCategories={eventCategories}
        currentEmployeeId={currentEmployeeId}
        activeProjects={activeProjects}
        personalTasks={personalTasks}
        initialView={initialView}
        initialDate={initialDate}
        leaves={leaves}
        holidays={holidays}
      />
    </main>
  );
}
