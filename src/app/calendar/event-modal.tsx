"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, getDate, getMonth } from "date-fns";
import { ja } from "date-fns/locale";
import { Briefcase, ChevronRight, ChevronLeft, LinkIcon, X, Calendar, Repeat } from "lucide-react";
import {
  type CalendarEventWithParticipants,
  type Employee,
  type EventCategory,
  type RecurrenceType,
  RECURRENCE_TYPE_LABELS,
  DAY_OF_WEEK_LABELS,
} from "@/types/database";
import { createEvent, updateEvent, createRecurringEvents, createMultipleDateEvents, getActiveProjects, type ProjectForLink } from "./actions";

interface EventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Employee[];
  eventCategories: EventCategory[];
  selectedDate: Date | null;
  event: CalendarEventWithParticipants | null;
  onSaved: (savedEvent: CalendarEventWithParticipants | CalendarEventWithParticipants[], isNew: boolean) => void;
  currentEmployeeId: string | null;
  initialStartTime?: { hour: string; minute: string } | null;
  initialEndTime?: { hour: string; minute: string } | null;
}

// 時間オプション (0-23)
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));

// 分オプション (15分単位)
const MINUTE_OPTIONS = ["00", "15", "30", "45"];

// 時刻を結合
function combineTime(hour: string, minute: string): string {
  if (!hour && !minute) return "";
  return `${hour || "00"}:${minute || "00"}`;
}

// 時刻を分割
function splitTime(time: string): { hour: string; minute: string } {
  if (!time) return { hour: "", minute: "" };
  const [hour, minute] = time.split(":");
  return { hour: hour || "", minute: minute || "" };
}

export function EventModal({
  open,
  onOpenChange,
  employees,
  eventCategories,
  selectedDate,
  event,
  onSaved,
  currentEmployeeId,
  initialStartTime,
  initialEndTime,
}: EventModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 社員リストをソート（ログインユーザーを先頭に）
  const sortedEmployees = useMemo(() => {
    if (!currentEmployeeId) return employees;
    return [...employees].sort((a, b) => {
      if (a.id === currentEmployeeId) return -1;
      if (b.id === currentEmployeeId) return 1;
      return 0; // 他は登録順のまま
    });
  }, [employees, currentEmployeeId]);

  // フォーム状態
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [startHour, setStartHour] = useState("");
  const [startMinute, setStartMinute] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endHour, setEndHour] = useState("");
  const [endMinute, setEndMinute] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState("");
  const [mapUrl, setMapUrl] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>([]);

  // 業務選択用
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [projects, setProjects] = useState<ProjectForLink[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // 業務リンク
  const [linkedProjectId, setLinkedProjectId] = useState<string | null>(null);
  const [linkedProjectCode, setLinkedProjectCode] = useState<string | null>(null);

  // 繰り返し設定
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>("none");
  const [recurrenceDayOfWeek, setRecurrenceDayOfWeek] = useState<number>(0); // 0=日曜〜6=土曜
  const [recurrenceDayOfMonth, setRecurrenceDayOfMonth] = useState<number>(1); // 1-31
  const [recurrenceMonth, setRecurrenceMonth] = useState<number>(1); // 1-12
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<string>("");

  // 複数日選択
  const [useMultipleDates, setUseMultipleDates] = useState(false);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [multiCalendarBaseMonth, setMultiCalendarBaseMonth] = useState(new Date());

  // 編集時のデータ読み込み
  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDescription(event.description || "");
      setCategoryId(event.event_category_id || eventCategories[0]?.id || "");
      setStartDate(event.start_date);
      const startTimeParts = splitTime(event.start_time?.slice(0, 5) || "");
      setStartHour(startTimeParts.hour);
      setStartMinute(startTimeParts.minute);
      setEndDate(event.end_date || "");
      const endTimeParts = splitTime(event.end_time?.slice(0, 5) || "");
      setEndHour(endTimeParts.hour);
      setEndMinute(endTimeParts.minute);
      setAllDay(event.all_day);
      setLocation(event.location || "");
      setMapUrl(event.map_url || "");
      setParticipantIds(event.participants.map((p) => p.id));
      setShowProjectSelector(false);
      setLinkedProjectId(event.project_id);
      setLinkedProjectCode(event.project?.code || null);
    } else if (selectedDate) {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      setTitle("");
      setDescription("");
      setCategoryId(eventCategories[0]?.id || "");
      setStartDate(dateStr);
      // 初期時刻が指定されている場合はそれを使用
      setStartHour(initialStartTime?.hour || "");
      setStartMinute(initialStartTime?.minute || "");
      setEndDate(dateStr); // デフォルトで終了日＝開始日
      setEndHour(initialEndTime?.hour || "");
      setEndMinute(initialEndTime?.minute || "");
      setAllDay(false);
      setLocation("");
      setMapUrl("");
      // デフォルトで自分を参加者に設定
      setParticipantIds(currentEmployeeId ? [currentEmployeeId] : []);
      setShowProjectSelector(false);
      setLinkedProjectId(null);
      setLinkedProjectCode(null);
      // 繰り返し設定をリセット
      setRecurrenceType("none");
      setRecurrenceDayOfWeek(getDay(selectedDate));
      setRecurrenceDayOfMonth(getDate(selectedDate));
      setRecurrenceMonth(getMonth(selectedDate) + 1);
      setRecurrenceEndDate("");
      // 複数日選択をリセット
      setUseMultipleDates(false);
      setSelectedDates([]);
      setMultiCalendarBaseMonth(new Date());
    }
  }, [event, selectedDate, open, eventCategories, currentEmployeeId, initialStartTime, initialEndTime]);

  // 業務を読み込む
  const loadProjects = async () => {
    if (projects.length > 0) {
      setShowProjectSelector(!showProjectSelector);
      return;
    }

    setLoadingProjects(true);
    try {
      const data = await getActiveProjects();
      setProjects(data);
      setShowProjectSelector(true);
    } catch (err) {
      console.error("Error loading projects:", err);
    } finally {
      setLoadingProjects(false);
    }
  };

  // 業務を選択
  const selectProject = (project: ProjectForLink) => {
    if (project.location) {
      setLocation(project.location);
    }
    setLinkedProjectId(project.id);
    setLinkedProjectCode(project.code);
    setShowProjectSelector(false);
  };

  // 業務リンクを解除
  const clearProjectLink = () => {
    setLinkedProjectId(null);
    setLinkedProjectCode(null);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !startDate) {
      setError("タイトルと開始日は必須です");
      return;
    }

    // 複数日選択の場合、日付が選択されているか確認
    if (useMultipleDates && selectedDates.length === 0) {
      setError("日付を選択してください");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const startTime = combineTime(startHour, startMinute);
      const endTime = combineTime(endHour, endMinute);

      const eventData = {
        title: title.trim(),
        description: description.trim() || null,
        category: "その他" as const, // 後方互換性のためデフォルト値を設定
        event_category_id: categoryId || null,
        start_date: startDate,
        start_time: startTime || null,
        end_date: endDate || null,
        end_time: endTime || null,
        all_day: allDay,
        location: location.trim() || null,
        map_url: mapUrl.trim() || null,
        project_id: linkedProjectId,
        task_id: null,
      };

      if (event && event.id) {
        // 既存イベントの更新
        const result = await updateEvent(event.id, eventData, participantIds);
        if (result.error) {
          setError(result.error);
          return;
        }
        if (result.event) {
          onSaved(result.event, false);
        }
      } else if (useMultipleDates) {
        // 複数日選択の場合
        const result = await createMultipleDateEvents(eventData, participantIds, selectedDates);
        if (result.error) {
          setError(result.error);
          return;
        }
        // 作成されたイベントを通知
        if (result.events && result.events.length > 0) {
          onSaved(result.events, true);
        }
      } else if (recurrenceType !== "none") {
        // 繰り返し予定の作成
        const result = await createRecurringEvents(
          eventData,
          participantIds,
          recurrenceType,
          recurrenceDayOfWeek,
          recurrenceDayOfMonth,
          recurrenceMonth,
          recurrenceEndDate || null
        );
        if (result.error) {
          setError(result.error);
          return;
        }
        // 繰り返し作成の場合はダミーのイベントで完了通知
        onSaved({
          ...eventData,
          id: "",
          recurrence_type: recurrenceType,
          recurrence_day_of_week: recurrenceDayOfWeek,
          recurrence_day_of_month: recurrenceDayOfMonth,
          recurrence_month: recurrenceMonth,
          recurrence_group_id: null,
          recurrence_end_date: recurrenceEndDate || null,
          created_by: null,
          created_at: "",
          updated_at: "",
          participants: [],
          creator: null,
          project: null,
          task: null,
          eventCategory: null,
        }, true);
      } else {
        // 通常の新規イベントの作成
        const result = await createEvent(eventData, participantIds);
        if (result.error) {
          setError(result.error);
          return;
        }
        if (result.event) {
          onSaved(result.event, true);
        }
      }
    } catch (err) {
      setError("保存に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const toggleParticipant = (employeeId: string) => {
    setParticipantIds((prev) =>
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event ? "予定を編集" : "予定を追加"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* タイトル */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="title">タイトル *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={loadProjects}
                disabled={loadingProjects}
              >
                <Briefcase className="h-4 w-4 mr-1" />
                {loadingProjects ? "読込中..." : "業務から選択"}
              </Button>
            </div>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="予定のタイトル"
            />

            {/* リンク中の業務表示 */}
            {linkedProjectId && (
              <div className="flex items-center gap-2 text-sm bg-blue-50 text-blue-700 px-3 py-2 rounded-md">
                <LinkIcon className="h-4 w-4" />
                <span>業務 {linkedProjectCode} にリンク中</span>
                <button
                  type="button"
                  onClick={clearProjectLink}
                  className="ml-auto p-0.5 hover:bg-blue-100 rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* 業務選択パネル */}
            {showProjectSelector && (
              <div className="border rounded-md p-2 max-h-48 overflow-y-auto bg-muted/30">
                {projects.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    進行中の業務がありません
                  </p>
                ) : (
                  <div className="space-y-1">
                    {projects.map((project) => (
                      <div
                        key={project.id}
                        className="flex items-center gap-1 p-1 rounded hover:bg-muted cursor-pointer text-sm"
                        onClick={() => selectProject(project)}
                      >
                        <span className="font-mono text-xs text-muted-foreground">
                          {project.code}
                        </span>
                        <span className="truncate flex-1">{project.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 区分 */}
          <div className="space-y-2">
            <Label htmlFor="category">区分</Label>
            {eventCategories.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {eventCategories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryId(cat.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm transition-colors ${
                      categoryId === cat.id
                        ? "border-primary bg-primary/10"
                        : "border-input hover:bg-muted"
                    }`}
                  >
                    <div className={`w-3 h-3 rounded ${cat.color}`} />
                    {cat.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                区分が設定されていません。設定画面で追加してください。
              </p>
            )}
          </div>

          {/* 繰り返し設定（新規作成時のみ） */}
          {!event && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Repeat className="h-4 w-4" />
                繰り返し
              </Label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(RECURRENCE_TYPE_LABELS) as RecurrenceType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setRecurrenceType(type);
                      // 複数日選択と排他
                      if (type !== "none") {
                        setUseMultipleDates(false);
                        setSelectedDates([]);
                      }
                    }}
                    disabled={useMultipleDates}
                    className={`px-3 py-1.5 rounded-md border text-sm transition-colors ${
                      recurrenceType === type && !useMultipleDates
                        ? "border-primary bg-primary/10"
                        : "border-input hover:bg-muted"
                    } ${useMultipleDates ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {RECURRENCE_TYPE_LABELS[type]}
                  </button>
                ))}
              </div>

              {/* 繰り返し詳細設定 */}
              {recurrenceType === "weekly" && !useMultipleDates && (
                <div className="flex items-center gap-2 text-sm bg-muted/50 p-2 rounded-md">
                  <span>毎週</span>
                  <select
                    className="h-8 px-2 rounded-md border border-input bg-background text-sm"
                    value={recurrenceDayOfWeek}
                    onChange={(e) => setRecurrenceDayOfWeek(parseInt(e.target.value))}
                  >
                    {DAY_OF_WEEK_LABELS.map((label, idx) => (
                      <option key={idx} value={idx}>
                        {label}曜日
                      </option>
                    ))}
                  </select>
                  <span className="ml-2">終了日:</span>
                  <Input
                    type="date"
                    className="w-40 h-8"
                    value={recurrenceEndDate}
                    onChange={(e) => setRecurrenceEndDate(e.target.value)}
                    placeholder="終了日（省略可）"
                  />
                </div>
              )}

              {recurrenceType === "monthly" && !useMultipleDates && (
                <div className="flex items-center gap-2 text-sm bg-muted/50 p-2 rounded-md">
                  <span>毎月</span>
                  <select
                    className="h-8 px-2 rounded-md border border-input bg-background text-sm"
                    value={recurrenceDayOfMonth}
                    onChange={(e) => setRecurrenceDayOfMonth(parseInt(e.target.value))}
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>
                        {day}日
                      </option>
                    ))}
                  </select>
                  <span className="ml-2">終了日:</span>
                  <Input
                    type="date"
                    className="w-40 h-8"
                    value={recurrenceEndDate}
                    onChange={(e) => setRecurrenceEndDate(e.target.value)}
                    placeholder="終了日（省略可）"
                  />
                </div>
              )}

              {recurrenceType === "yearly" && !useMultipleDates && (
                <div className="flex items-center gap-2 text-sm bg-muted/50 p-2 rounded-md">
                  <span>毎年</span>
                  <select
                    className="h-8 px-2 rounded-md border border-input bg-background text-sm"
                    value={recurrenceMonth}
                    onChange={(e) => setRecurrenceMonth(parseInt(e.target.value))}
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                      <option key={month} value={month}>
                        {month}月
                      </option>
                    ))}
                  </select>
                  <select
                    className="h-8 px-2 rounded-md border border-input bg-background text-sm"
                    value={recurrenceDayOfMonth}
                    onChange={(e) => setRecurrenceDayOfMonth(parseInt(e.target.value))}
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>
                        {day}日
                      </option>
                    ))}
                  </select>
                  <span className="ml-2">終了日:</span>
                  <Input
                    type="date"
                    className="w-40 h-8"
                    value={recurrenceEndDate}
                    onChange={(e) => setRecurrenceEndDate(e.target.value)}
                    placeholder="終了日（省略可）"
                  />
                </div>
              )}
            </div>
          )}

          {/* 複数日選択（新規作成時のみ） */}
          {!event && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="useMultipleDates"
                  checked={useMultipleDates}
                  onCheckedChange={(checked) => {
                    console.log("useMultipleDates checkbox changed:", checked);
                    setUseMultipleDates(!!checked);
                    if (checked) {
                      // 繰り返しと排他
                      setRecurrenceType("none");
                      // 現在の開始日を選択済みに
                      if (startDate) {
                        console.log("Initial startDate for selectedDates:", startDate);
                        setSelectedDates([startDate]);
                      }
                    } else {
                      setSelectedDates([]);
                    }
                  }}
                  disabled={recurrenceType !== "none"}
                />
                <Label htmlFor="useMultipleDates" className={`cursor-pointer flex items-center gap-1 ${recurrenceType !== "none" ? "opacity-50" : ""}`}>
                  <Calendar className="h-4 w-4" />
                  複数の日付を選択
                </Label>
              </div>

              {/* 3ヶ月ミニカレンダー */}
              {useMultipleDates && (
                <div className="border rounded-md p-3 bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setMultiCalendarBaseMonth((prev) => addMonths(prev, -3))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium">
                      {format(multiCalendarBaseMonth, "yyyy年M月", { locale: ja })} 〜
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setMultiCalendarBaseMonth((prev) => addMonths(prev, 3))}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[0, 1, 2].map((offset) => {
                      const monthDate = addMonths(multiCalendarBaseMonth, offset);
                      const monthStart = startOfMonth(monthDate);
                      const monthEnd = endOfMonth(monthDate);
                      const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
                      // 月の最初の日の曜日を取得（0=日曜）
                      const startDayOfWeek = getDay(monthStart);

                      return (
                        <div key={offset} className="text-center">
                          <div className="text-xs font-medium mb-1">
                            {format(monthDate, "M月", { locale: ja })}
                          </div>
                          <div className="grid grid-cols-7 gap-0.5 text-xs">
                            {/* 曜日ヘッダー */}
                            {DAY_OF_WEEK_LABELS.map((label) => (
                              <div key={label} className="text-muted-foreground text-center">
                                {label}
                              </div>
                            ))}
                            {/* 空白セル（月の最初の日まで） */}
                            {Array.from({ length: startDayOfWeek }).map((_, i) => (
                              <div key={`empty-${i}`} />
                            ))}
                            {/* 日付セル */}
                            {days.map((day) => {
                              const dateStr = format(day, "yyyy-MM-dd");
                              const isSelected = selectedDates.includes(dateStr);
                              return (
                                <button
                                  key={dateStr}
                                  type="button"
                                  onClick={() => {
                                    console.log("Date clicked:", dateStr, "isSelected:", isSelected);
                                    setSelectedDates((prev) => {
                                      const newDates = isSelected
                                        ? prev.filter((d) => d !== dateStr)
                                        : [...prev, dateStr].sort();
                                      console.log("New selectedDates:", JSON.stringify(newDates));
                                      return newDates;
                                    });
                                  }}
                                  className={`w-6 h-6 rounded text-center text-xs ${
                                    isSelected
                                      ? "bg-primary text-primary-foreground"
                                      : "hover:bg-muted"
                                  }`}
                                >
                                  {getDate(day)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 選択した日付表示 */}
                  {selectedDates.length > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      選択中: {selectedDates.length}日
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedDates.slice(0, 10).map((dateStr) => (
                          <span
                            key={dateStr}
                            className="inline-flex items-center bg-primary/10 text-primary px-1.5 py-0.5 rounded"
                          >
                            {format(new Date(dateStr), "M/d")}
                            <button
                              type="button"
                              onClick={() => setSelectedDates((prev) => prev.filter((d) => d !== dateStr))}
                              className="ml-1 hover:text-red-500"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                        {selectedDates.length > 10 && (
                          <span className="text-muted-foreground">
                            他 {selectedDates.length - 10}日
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 終日チェック */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="allDay"
              checked={allDay}
              onCheckedChange={(checked) => setAllDay(!!checked)}
            />
            <Label htmlFor="allDay" className="cursor-pointer">
              終日
            </Label>
          </div>

          {/* 日時 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">開始日 *</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  // 開始日を変更したら終了日も同じに
                  if (!endDate || endDate < e.target.value) {
                    setEndDate(e.target.value);
                  }
                }}
              />
            </div>
            {!allDay && (
              <div className="space-y-2">
                <Label>開始時刻</Label>
                <div className="flex items-center gap-1">
                  <select
                    className="w-20 h-10 px-2 rounded-md border border-input bg-background text-sm"
                    value={startHour}
                    onChange={(e) => {
                      const newHour = e.target.value;
                      setStartHour(newHour);
                      // 時を選択したら自動的に00分を設定
                      if (newHour && !startMinute) {
                        setStartMinute("00");
                        // 終了時刻を30分後に自動設定
                        const startMinutes = parseInt(newHour) * 60;
                        const endMinutes = startMinutes + 30;
                        const newEndHour = String(Math.floor(endMinutes / 60) % 24).padStart(2, "0");
                        const newEndMinute = endMinutes % 60 === 0 ? "00" : "30";
                        setEndHour(newEndHour);
                        setEndMinute(newEndMinute);
                      }
                    }}
                  >
                    <option value="">--</option>
                    {HOUR_OPTIONS.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <span className="text-muted-foreground">:</span>
                  <select
                    className="w-20 h-10 px-2 rounded-md border border-input bg-background text-sm"
                    value={startMinute}
                    onChange={(e) => {
                      const newMinute = e.target.value;
                      setStartMinute(newMinute);
                      // 分を変更したら終了時刻も30分後に更新
                      if (startHour && newMinute) {
                        const startMinutes = parseInt(startHour) * 60 + parseInt(newMinute);
                        const endMinutes = startMinutes + 30;
                        const newEndHour = String(Math.floor(endMinutes / 60) % 24).padStart(2, "0");
                        const newEndMinute = endMinutes % 60 === 0 ? "00" : "30";
                        setEndHour(newEndHour);
                        setEndMinute(newEndMinute);
                      }
                    }}
                  >
                    <option value="">--</option>
                    {MINUTE_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="endDate">終了日</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            {!allDay && (
              <div className="space-y-2">
                <Label>終了時刻</Label>
                <div className="flex items-center gap-1">
                  <select
                    className="w-20 h-10 px-2 rounded-md border border-input bg-background text-sm"
                    value={endHour}
                    onChange={(e) => setEndHour(e.target.value)}
                  >
                    <option value="">--</option>
                    {HOUR_OPTIONS.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <span className="text-muted-foreground">:</span>
                  <select
                    className="w-20 h-10 px-2 rounded-md border border-input bg-background text-sm"
                    value={endMinute}
                    onChange={(e) => setEndMinute(e.target.value)}
                  >
                    <option value="">--</option>
                    {MINUTE_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* 参加者 */}
          <div className="space-y-2">
            <Label>参加者</Label>
            <div className="border rounded-md p-3 max-h-32 overflow-y-auto space-y-2">
              {sortedEmployees.map((emp) => (
                <div key={emp.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`participant-${emp.id}`}
                    checked={participantIds.includes(emp.id)}
                    onCheckedChange={() => toggleParticipant(emp.id)}
                  />
                  <Label
                    htmlFor={`participant-${emp.id}`}
                    className="cursor-pointer font-normal"
                  >
                    {emp.name}
                    {emp.id === currentEmployeeId && (
                      <span className="text-xs text-muted-foreground ml-1">(自分)</span>
                    )}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* 場所 */}
          <div className="space-y-2">
            <Label htmlFor="location">場所</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="場所"
            />
          </div>

          {/* GoogleMapリンク */}
          <div className="space-y-2">
            <Label htmlFor="mapUrl">Google Map リンク</Label>
            <Input
              id="mapUrl"
              type="url"
              value={mapUrl}
              onChange={(e) => setMapUrl(e.target.value)}
              placeholder="https://maps.google.com/..."
            />
          </div>

          {/* 詳細 */}
          <div className="space-y-2">
            <Label htmlFor="description">詳細</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="詳細メモ"
              rows={3}
            />
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
