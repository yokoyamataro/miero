import { format, subMonths, addMonths, startOfMonth, endOfMonth } from "date-fns";
import { getTodayAttendance } from "@/app/attendance/actions";
import { getEventsInRange, getEmployees, getCurrentEmployeeId, getEventCategories } from "./calendar/actions";
import { getIncompleteTasks } from "./dashboard-actions";
import { DashboardView } from "./dashboard-view";

export default async function Home() {
  const today = new Date();
  const rangeStart = format(subMonths(startOfMonth(today), 1), "yyyy-MM-dd");
  const rangeEnd = format(addMonths(endOfMonth(today), 1), "yyyy-MM-dd");

  // 並列でデータ取得
  const [attendanceData, events, employees, currentEmployeeId, eventCategories, tasks] =
    await Promise.all([
      getTodayAttendance(),
      getEventsInRange(rangeStart, rangeEnd),
      getEmployees(),
      getCurrentEmployeeId(),
      getEventCategories(),
      getIncompleteTasks(), // 全タスク取得（クライアント側でフィルタ）
    ]);

  return (
    <main className="container mx-auto">
      <DashboardView
        events={events}
        employees={employees}
        eventCategories={eventCategories}
        currentEmployeeId={currentEmployeeId}
        tasks={tasks}
        attendance={attendanceData?.attendance || null}
      />
    </main>
  );
}
