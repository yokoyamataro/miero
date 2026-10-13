import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_STATUS_COLORS,
  type AttendanceStatus,
} from "@/types/database";
import { getMyMonthlyAttendance } from "./actions";

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function parseMonthParam(input: string | undefined): {
  year: number;
  month: number;
} {
  if (input && /^\d{4}-\d{1,2}$/.test(input)) {
    const [y, m] = input.split("-").map(Number);
    if (y >= 2000 && y <= 2100 && m >= 1 && m <= 12) return { year: y, month: m };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function formatMonthParam(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${String(m).padStart(2, "0")}m`;
}

function formatTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { year, month } = parseMonthParam(searchParams.month);
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);

  const { rows, summary } = await getMyMonthlyAttendance(year, month);

  // 月の全日付リストを生成（打刻レコードがない日もグレー表示用）
  const daysInMonth = new Date(year, month, 0).getDate();
  const allDates: {
    dateStr: string;
    dayOfWeek: number;
    row: typeof rows[number] | null;
  }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month - 1, d);
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const row = rows.find((r) => r.date === dateStr) ?? null;
    allDates.push({
      dateStr,
      dayOfWeek: dateObj.getDay(),
      row,
    });
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-6">
        <div className="flex items-center gap-2">
          <Clock className="h-6 w-6" />
          <h1 className="text-2xl font-bold">自分のタイムカード</h1>
        </div>
      </div>

      {/* 月切替 */}
      <div className="flex items-center justify-center gap-2 mb-6">
        <Link href={`/attendance?month=${formatMonthParam(prev.year, prev.month)}`}>
          <Button variant="outline" size="sm">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="text-xl font-bold w-40 text-center">
          {year}年{month}月
        </div>
        <Link href={`/attendance?month=${formatMonthParam(next.year, next.month)}`}>
          <Button variant="outline" size="sm">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        <SummaryCard label="勤務日数" value={`${summary.workDays}日`} />
        <SummaryCard
          label="休日出勤"
          value={`${summary.holidayWorkDays}日`}
        />
        <SummaryCard label="有給休暇" value={`${summary.paidLeaveDays}日`} />
        <SummaryCard label="欠勤" value={`${summary.absenceDays}日`} />
        <SummaryCard
          label="実働合計"
          value={formatMinutes(summary.totalWorkMinutes)}
        />
        <SummaryCard
          label="休憩合計"
          value={formatMinutes(summary.totalBreakMinutes)}
        />
      </div>

      {/* 日別一覧 */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="border-b px-3 py-2 text-left font-semibold whitespace-nowrap">
                  日付
                </th>
                <th className="border-b px-3 py-2 text-center font-semibold">
                  出勤
                </th>
                <th className="border-b px-3 py-2 text-center font-semibold">
                  退勤
                </th>
                <th className="border-b px-3 py-2 text-center font-semibold">
                  休憩
                </th>
                <th className="border-b px-3 py-2 text-center font-semibold">
                  実働
                </th>
                <th className="border-b px-3 py-2 text-center font-semibold">
                  ステータス
                </th>
                <th className="border-b px-3 py-2 text-left font-semibold">
                  備考
                </th>
              </tr>
            </thead>
            <tbody>
              {allDates.map(({ dateStr, dayOfWeek, row }) => {
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                const dateDisplay = Number(dateStr.slice(-2));
                const dayLabel = DAY_LABELS[dayOfWeek];

                let workedMinutes = 0;
                if (row?.clock_in && row?.clock_out) {
                  const diff =
                    (new Date(row.clock_out).getTime() -
                      new Date(row.clock_in).getTime()) /
                    60000;
                  workedMinutes = Math.max(
                    0,
                    Math.floor(diff) - (row.break_minutes ?? 0)
                  );
                }

                const dbStatus = (row?.status as AttendanceStatus | null) ?? "Work";
                const isSpecial = dbStatus !== "Work";

                return (
                  <tr
                    key={dateStr}
                    className={`${
                      isWeekend ? "bg-muted/20" : ""
                    } hover:bg-muted/30`}
                  >
                    <td className="border-b px-3 py-2 whitespace-nowrap font-medium tabular-nums">
                      {dateDisplay}日
                      <span
                        className={`ml-1 text-xs ${
                          dayOfWeek === 0
                            ? "text-red-500"
                            : dayOfWeek === 6
                              ? "text-blue-500"
                              : "text-muted-foreground"
                        }`}
                      >
                        ({dayLabel})
                      </span>
                    </td>
                    <td className="border-b px-3 py-2 text-center tabular-nums">
                      {formatTime(row?.clock_in ?? null)}
                    </td>
                    <td className="border-b px-3 py-2 text-center tabular-nums">
                      {formatTime(row?.clock_out ?? null)}
                    </td>
                    <td className="border-b px-3 py-2 text-center tabular-nums">
                      {row?.break_minutes ? `${row.break_minutes}分` : "-"}
                    </td>
                    <td className="border-b px-3 py-2 text-center tabular-nums font-medium">
                      {workedMinutes > 0 ? formatMinutes(workedMinutes) : "-"}
                    </td>
                    <td className="border-b px-3 py-2 text-center">
                      {row ? (
                        isSpecial ? (
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${ATTENDANCE_STATUS_COLORS[dbStatus]}`}
                          >
                            {ATTENDANCE_STATUS_LABELS[dbStatus]}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            通常勤務
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          -
                        </span>
                      )}
                    </td>
                    <td className="border-b px-3 py-2 text-xs text-muted-foreground max-w-xs truncate">
                      {row?.note || ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground mb-1">{label}</div>
        <div className="text-lg font-bold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
