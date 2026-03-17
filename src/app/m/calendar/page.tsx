import { createClient } from "@/lib/supabase/server";
import { getEventsInRange, getEventCategories, getCurrentEmployeeId } from "@/app/calendar/actions";
import { MobileCalendarView } from "./mobile-calendar-view";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";

interface Props {
  searchParams: Promise<{ month?: string }>;
}

export default async function MobileCalendarPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();

  // 表示月を決定
  const monthParam = params.month;
  const currentDate = monthParam ? new Date(monthParam + "-01") : new Date();
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  // 前後の月も含めてイベントを取得（スワイプ用）
  const rangeStart = format(startOfMonth(subMonths(monthStart, 1)), "yyyy-MM-dd");
  const rangeEnd = format(endOfMonth(addMonths(monthEnd, 1)), "yyyy-MM-dd");

  const [events, categories, currentEmployeeId, { data: employees }] = await Promise.all([
    getEventsInRange(rangeStart, rangeEnd),
    getEventCategories(),
    getCurrentEmployeeId(),
    supabase.from("employees").select("id, name").order("name"),
  ]);

  return (
    <div className="flex flex-col h-full">
      <MobileCalendarView
        events={events}
        categories={categories}
        employees={employees || []}
        currentEmployeeId={currentEmployeeId}
        initialMonth={format(monthStart, "yyyy-MM")}
      />
    </div>
  );
}
