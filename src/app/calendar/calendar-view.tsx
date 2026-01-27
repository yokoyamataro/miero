"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar, Flag, CalendarDays } from "lucide-react";
import {
  PROJECT_CATEGORY_LABELS,
  PROJECT_STATUS_COLORS,
  type ProjectCategory,
  type ProjectStatus,
  type ProjectDetails,
} from "@/types/database";

type ViewMode = "month" | "week";

interface ProjectWithContact {
  id: string;
  code: string;
  category: ProjectCategory;
  name: string;
  status: ProjectStatus;
  start_date: string | null;
  end_date: string | null;
  details: ProjectDetails;
  contactName: string;
}

interface CalendarViewProps {
  year: number;
  month: number;
  projects: ProjectWithContact[];
  viewMode: ViewMode;
  weekStart: string;
}

// カテゴリ別の色
const CATEGORY_COLORS: Record<ProjectCategory, string> = {
  A_Survey: "bg-blue-500",
  B_Boundary: "bg-green-500",
  C_Registration: "bg-purple-500",
  D_Inheritance: "bg-orange-500",
  E_Corporate: "bg-pink-500",
  F_Drone: "bg-cyan-500",
  N_Farmland: "bg-amber-600",
};

// details内の日付フィールドを抽出
function extractMilestones(
  details: ProjectDetails,
  category: ProjectCategory
): { date: string; label: string }[] {
  const milestones: { date: string; label: string }[] = [];

  if (!details) return milestones;

  if (category === "C_Registration") {
    const d = details as { completion_date?: string; settlement_date?: string };
    if (d.completion_date) milestones.push({ date: d.completion_date, label: "完了検査" });
    if (d.settlement_date) milestones.push({ date: d.settlement_date, label: "決済" });
  }

  if (category === "D_Inheritance") {
    const d = details as { will_date?: string };
    if (d.will_date) milestones.push({ date: d.will_date, label: "遺言" });
  }

  if (category === "E_Corporate") {
    const d = details as { next_election_date?: string };
    if (d.next_election_date) milestones.push({ date: d.next_election_date, label: "改選" });
  }

  if (category === "N_Farmland") {
    const d = details as { application_date?: string; permission_date?: string };
    if (d.application_date) milestones.push({ date: d.application_date, label: "申請" });
    if (d.permission_date) milestones.push({ date: d.permission_date, label: "許可" });
  }

  return milestones;
}

// 曜日ラベル
const WEEKDAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

export function CalendarView({ year, month, projects, viewMode, weekStart }: CalendarViewProps) {
  const router = useRouter();
  const today = new Date();

  // 週表示用の日付配列
  const weekStartDate = new Date(weekStart);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStartDate);
    d.setDate(d.getDate() + i);
    return d;
  });

  // 月の日数
  const daysInMonth = new Date(year, month, 0).getDate();

  // 前月・次月へのナビゲーション
  const prevMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };

  // 前週・次週へのナビゲーション
  const prevWeekDate = new Date(weekStartDate);
  prevWeekDate.setDate(prevWeekDate.getDate() - 7);
  const nextWeekDate = new Date(weekStartDate);
  nextWeekDate.setDate(nextWeekDate.getDate() + 7);

  const formatWeekParam = (d: Date) => d.toISOString().split("T")[0];

  // 今週の開始日を取得
  const getTodayWeekStart = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  // 表示範囲
  const rangeStart = viewMode === "week" ? weekStartDate : new Date(year, month - 1, 1);
  const rangeEnd = viewMode === "week" ? weekDays[6] : new Date(year, month, 0);
  const totalDays = viewMode === "week" ? 7 : daysInMonth;

  // バーの位置計算
  const getBarStyle = (startDate: string | null, endDate: string | null) => {
    let start = startDate ? new Date(startDate) : rangeStart;
    let end = endDate ? new Date(endDate) : rangeEnd;

    // 範囲にクリップ
    if (start < rangeStart) start = new Date(rangeStart);
    if (end > rangeEnd) end = new Date(rangeEnd);

    if (viewMode === "week") {
      // 週表示: 日付の差分で計算
      const startDiff = Math.max(0, Math.floor((start.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)));
      const endDiff = Math.min(6, Math.floor((end.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)));
      const left = (startDiff / 7) * 100;
      const width = ((endDiff - startDiff + 1) / 7) * 100;
      return { left: `${left}%`, width: `${width}%` };
    } else {
      // 月表示
      const startDay = start.getDate();
      const endDay = end.getDate();
      const left = ((startDay - 1) / daysInMonth) * 100;
      const width = ((endDay - startDay + 1) / daysInMonth) * 100;
      return { left: `${left}%`, width: `${width}%` };
    }
  };

  // マイルストーンの位置計算
  const getMilestonePosition = (dateStr: string) => {
    const date = new Date(dateStr);

    if (viewMode === "week") {
      const diff = Math.floor((date.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24));
      if (diff < 0 || diff > 6) return null;
      return ((diff + 0.5) / 7) * 100;
    } else {
      if (date.getFullYear() !== year || date.getMonth() + 1 !== month) return null;
      const day = date.getDate();
      return ((day - 0.5) / daysInMonth) * 100;
    }
  };

  // ヘッダーの日付ラベル
  const getHeaderLabels = () => {
    if (viewMode === "week") {
      return weekDays.map((d, i) => ({
        label: `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAY_LABELS[i]})`,
        position: ((i + 0.5) / 7) * 100,
      }));
    } else {
      return [1, 5, 10, 15, 20, 25, daysInMonth].map((day) => ({
        label: String(day),
        position: ((day - 0.5) / daysInMonth) * 100,
      }));
    }
  };

  // タイトル
  const getTitle = () => {
    if (viewMode === "week") {
      const endDate = weekDays[6];
      return `${weekStartDate.getFullYear()}年${weekStartDate.getMonth() + 1}月${weekStartDate.getDate()}日 〜 ${endDate.getMonth() + 1}月${endDate.getDate()}日`;
    }
    return `${year}年${month}月`;
  };

  return (
    <div className="space-y-4">
      {/* ナビゲーション */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-semibold">
          {getTitle()}
        </h2>
        <div className="flex gap-2 flex-wrap">
          {/* 表示切替 */}
          <div className="flex border rounded-md">
            <Link href={`/calendar?year=${year}&month=${month}&view=month`}>
              <Button
                variant={viewMode === "month" ? "default" : "ghost"}
                size="sm"
                className="rounded-r-none"
              >
                <Calendar className="h-4 w-4 mr-1" />
                月
              </Button>
            </Link>
            <Link href={`/calendar?view=week&week=${weekStart}`}>
              <Button
                variant={viewMode === "week" ? "default" : "ghost"}
                size="sm"
                className="rounded-l-none"
              >
                <CalendarDays className="h-4 w-4 mr-1" />
                週
              </Button>
            </Link>
          </div>

          {/* ナビゲーションボタン */}
          {viewMode === "month" ? (
            <>
              <Link href={`/calendar?year=${prevMonth.year}&month=${prevMonth.month}&view=month`}>
                <Button variant="outline" size="sm">
                  <ChevronLeft className="h-4 w-4" />
                  前月
                </Button>
              </Link>
              <Link href={`/calendar?year=${today.getFullYear()}&month=${today.getMonth() + 1}&view=month`}>
                <Button variant="outline" size="sm">
                  今月
                </Button>
              </Link>
              <Link href={`/calendar?year=${nextMonth.year}&month=${nextMonth.month}&view=month`}>
                <Button variant="outline" size="sm">
                  次月
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Link href={`/calendar?view=week&week=${formatWeekParam(prevWeekDate)}`}>
                <Button variant="outline" size="sm">
                  <ChevronLeft className="h-4 w-4" />
                  前週
                </Button>
              </Link>
              <Link href={`/calendar?view=week&week=${formatWeekParam(getTodayWeekStart())}`}>
                <Button variant="outline" size="sm">
                  今週
                </Button>
              </Link>
              <Link href={`/calendar?view=week&week=${formatWeekParam(nextWeekDate)}`}>
                <Button variant="outline" size="sm">
                  次週
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* カレンダー本体 */}
      <Card>
        <CardContent className="pt-6">
          {/* 日付ヘッダー */}
          <div className="flex border-b pb-2 mb-4">
            <div className="w-48 flex-shrink-0 text-sm font-medium text-muted-foreground">
              業務
            </div>
            <div className="flex-1 relative h-5">
              <div className="flex justify-between text-xs text-muted-foreground">
                {getHeaderLabels().map((item, idx) => (
                  <span
                    key={idx}
                    style={{ position: "absolute", left: `${item.position}%`, transform: "translateX(-50%)" }}
                  >
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* プロジェクト行 */}
          {projects.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {viewMode === "week" ? "この週" : "この月"}に該当する業務はありません
            </p>
          ) : (
            <div className="space-y-3">
              {projects.map((project) => {
                const barStyle = getBarStyle(project.start_date, project.end_date);
                const milestones = extractMilestones(project.details, project.category);
                const categoryColor = CATEGORY_COLORS[project.category];

                return (
                  <div key={project.id} className="flex items-center group">
                    {/* プロジェクト情報 */}
                    <div className="w-48 flex-shrink-0 pr-2">
                      <Link
                        href={`/projects/${project.id}`}
                        className="block hover:bg-muted rounded p-1 -m-1"
                      >
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className={`text-xs text-white ${categoryColor}`}
                          >
                            {project.code}
                          </Badge>
                        </div>
                        <div className="text-sm font-medium truncate mt-1">
                          {project.name}
                        </div>
                        {project.contactName && (
                          <div className="text-xs text-muted-foreground truncate">
                            {project.contactName}
                          </div>
                        )}
                      </Link>
                    </div>

                    {/* タイムラインバー */}
                    <div className="flex-1 relative h-8 bg-muted/30 rounded">
                      {/* 期間バー */}
                      {(project.start_date || project.end_date) && (
                        <div
                          className={`absolute top-1 bottom-1 rounded ${categoryColor} opacity-80 group-hover:opacity-100 transition-opacity`}
                          style={barStyle}
                        />
                      )}

                      {/* マイルストーン */}
                      {milestones.map((milestone, idx) => {
                        const pos = getMilestonePosition(milestone.date);
                        if (pos === null) return null;
                        return (
                          <div
                            key={idx}
                            className="absolute top-0 bottom-0 flex items-center"
                            style={{ left: `${pos}%`, transform: "translateX(-50%)" }}
                            title={`${milestone.label}: ${milestone.date}`}
                          >
                            <Flag className="h-4 w-4 text-red-500" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 凡例 */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-muted-foreground">カテゴリ:</span>
            {(Object.keys(CATEGORY_COLORS) as ProjectCategory[]).map((cat) => (
              <div key={cat} className="flex items-center gap-1">
                <div className={`w-3 h-3 rounded ${CATEGORY_COLORS[cat]}`} />
                <span>{PROJECT_CATEGORY_LABELS[cat]}</span>
              </div>
            ))}
            <div className="flex items-center gap-1 ml-4">
              <Flag className="h-4 w-4 text-red-500" />
              <span>期限・マイルストーン</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
