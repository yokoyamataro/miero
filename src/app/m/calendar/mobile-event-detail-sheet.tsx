"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import {
  Clock,
  MapPin,
  Users,
  Pencil,
  CheckCircle,
  Circle,
  Loader2,
  Trash2,
  ExternalLink,
  Briefcase,
  FileText,
  Repeat,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  type CalendarEventWithParticipants,
  type EventCategory,
  RECURRENCE_TYPE_LABELS,
  DAY_OF_WEEK_LABELS,
} from "@/types/database";
import { MobileEventFormSheet } from "./mobile-event-form-sheet";
import { updateEvent, deleteEvent, type ProjectForLink } from "@/app/calendar/actions";
import { MobileProjectSearch } from "./mobile-project-search";

interface Employee {
  id: string;
  name: string;
}

interface MobileEventDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEventWithParticipants | null;
  categories: EventCategory[];
  employees: Employee[];
  currentEmployeeId: string | null;
  onUpdated?: (event: CalendarEventWithParticipants) => void;
  onDeleted?: (eventId: string) => void;
}

// 時間オプション (0-23)
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
// 分オプション (15分単位)
const MINUTE_OPTIONS = ["00", "15", "30", "45"];

export function MobileEventDetailSheet({
  open,
  onOpenChange,
  event,
  categories,
  employees,
  currentEmployeeId,
  onUpdated,
  onDeleted,
}: MobileEventDetailSheetProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 完了フォーム用の状態
  const [showCompletionForm, setShowCompletionForm] = useState(false);
  const [completionStartHour, setCompletionStartHour] = useState("");
  const [completionStartMinute, setCompletionStartMinute] = useState("");
  const [completionEndHour, setCompletionEndHour] = useState("");
  const [completionEndMinute, setCompletionEndMinute] = useState("");
  const [savingCompletion, setSavingCompletion] = useState(false);

  // ローカルでイベントの完了状態を管理（null=変更なし）
  const [localCompletedState, setLocalCompletedState] = useState<boolean | null>(null);
  const [undoingCompletion, setUndoingCompletion] = useState(false);

  // 業務リンク確認用の状態
  const [showNoProjectWarning, setShowNoProjectWarning] = useState(false);
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null);
  const [pendingProjectCode, setPendingProjectCode] = useState<string | null>(null);
  const [pendingProjectName, setPendingProjectName] = useState<string | null>(null);

  if (!event) return null;

  const category = categories.find((c) => c.id === event.event_category_id);
  const color = category?.color || "bg-gray-400";
  const employeeMap = new Map(employees.map((e) => [e.id, e.name]));
  const participantNames = event.participants
    ?.map((p) => employeeMap.get(p.id) || p.name)
    .join("、");
  // ローカル状態が設定されていればそれを優先、なければサーバーの値を使用
  const isCompleted = localCompletedState !== null ? localCompletedState : event.is_completed;
  // 業務リンクがあるかどうか（保留中の業務IDも考慮）
  const hasProjectLink = !!event.project_id || !!pendingProjectId;

  // 繰り返し情報の表示
  const getRecurrenceInfo = () => {
    if (!event.recurrence_type || event.recurrence_type === "none") return null;

    const type = RECURRENCE_TYPE_LABELS[event.recurrence_type];
    if (event.recurrence_type === "weekly" && event.recurrence_day_of_week !== null) {
      return `${type}${DAY_OF_WEEK_LABELS[event.recurrence_day_of_week]}曜日`;
    }
    if (event.recurrence_type === "monthly" && event.recurrence_day_of_month !== null) {
      return `${type}${event.recurrence_day_of_month}日`;
    }
    if (event.recurrence_type === "yearly" && event.recurrence_month !== null && event.recurrence_day_of_month !== null) {
      return `${type}${event.recurrence_month}月${event.recurrence_day_of_month}日`;
    }
    return type;
  };

  const formatDateRange = () => {
    const startDate = parseISO(event.start_date);
    const endDate = event.end_date ? parseISO(event.end_date) : null;

    if (event.all_day) {
      if (endDate && event.end_date !== event.start_date) {
        return `${format(startDate, "M月d日(E)", { locale: ja })} - ${format(endDate, "M月d日(E)", { locale: ja })}（終日）`;
      }
      return `${format(startDate, "M月d日(E)", { locale: ja })}（終日）`;
    }

    const startTimeStr = event.start_time ? event.start_time.slice(0, 5) : "";
    const endTimeStr = event.end_time ? event.end_time.slice(0, 5) : "";

    if (endDate && event.end_date !== event.start_date) {
      return `${format(startDate, "M月d日(E)", { locale: ja })} ${startTimeStr} - ${format(endDate, "M月d日(E)", { locale: ja })} ${endTimeStr}`;
    }

    if (startTimeStr && endTimeStr) {
      return `${format(startDate, "M月d日(E)", { locale: ja })} ${startTimeStr} - ${endTimeStr}`;
    }

    if (startTimeStr) {
      return `${format(startDate, "M月d日(E)", { locale: ja })} ${startTimeStr}`;
    }

    return format(startDate, "M月d日(E)", { locale: ja });
  };

  const handleEditClick = () => {
    setShowForm(true);
  };

  const handleFormClose = (isOpen: boolean) => {
    setShowForm(isOpen);
    if (!isOpen) {
      // 編集後はリフレッシュ
      router.refresh();
    }
  };

  // 完了ボタンを押したとき
  const handleCompletionClick = () => {
    // 業務リンクがない場合は警告を表示
    if (!hasProjectLink) {
      setShowNoProjectWarning(true);
      return;
    }
    showCompletionTimeForm();
  };

  // 業務リンクなしで続行
  const handleContinueWithoutProject = () => {
    setShowNoProjectWarning(false);
    showCompletionTimeForm();
  };

  // 完了時刻入力フォームを表示
  const showCompletionTimeForm = () => {
    if (event.all_day) {
      const now = new Date();
      const hour = String(now.getHours()).padStart(2, "0");
      const minute = now.getMinutes() < 30 ? "00" : "30";
      setCompletionStartHour(hour);
      setCompletionStartMinute(minute);
      const endHourNum = (now.getHours() + 1) % 24;
      setCompletionEndHour(String(endHourNum).padStart(2, "0"));
      setCompletionEndMinute(minute);
    } else {
      const startTimeParts = event.start_time?.slice(0, 5).split(":") || [];
      const endTimeParts = event.end_time?.slice(0, 5).split(":") || [];
      setCompletionStartHour(startTimeParts[0] || "");
      setCompletionStartMinute(startTimeParts[1] || "00");
      setCompletionEndHour(endTimeParts[0] || "");
      setCompletionEndMinute(endTimeParts[1] || "00");
    }
    setShowNoProjectWarning(false);
    setShowCompletionForm(true);
  };

  // 業務選択時のハンドラー
  const handleProjectSelect = (project: ProjectForLink) => {
    setPendingProjectId(project.id);
    setPendingProjectCode(project.code);
    setPendingProjectName(project.name);
  };

  // 業務リンク解除
  const handleProjectClear = () => {
    setPendingProjectId(null);
    setPendingProjectCode(null);
    setPendingProjectName(null);
  };

  // 完了をキャンセル
  const handleCancelCompletion = () => {
    setShowCompletionForm(false);
    setCompletionStartHour("");
    setCompletionStartMinute("");
    setCompletionEndHour("");
    setCompletionEndMinute("");
  };

  // 完了を保存
  const handleSaveCompletion = async () => {
    if (!completionStartHour || !completionEndHour) {
      alert("開始時刻と終了時刻を入力してください");
      return;
    }

    setSavingCompletion(true);
    const startTime = `${completionStartHour}:${completionStartMinute || "00"}:00`;
    const endTime = `${completionEndHour}:${completionEndMinute || "00"}:00`;

    const updateData: Record<string, unknown> = {
      is_completed: true,
      all_day: event.all_day ? false : event.all_day,
      start_time: startTime,
      end_time: endTime,
    };

    // 保留中の業務リンクがあれば追加
    if (pendingProjectId) {
      updateData.project_id = pendingProjectId;
    }

    const result = await updateEvent(
      event.id,
      updateData,
      event.participants.map((p) => p.id)
    );

    setSavingCompletion(false);

    if (result.error) {
      alert(result.error);
      return;
    }

    setLocalCompletedState(true);
    handleCancelCompletion();
    if (result.event && onUpdated) {
      onUpdated(result.event);
    }
  };

  // 完了を取り消す
  const handleUndoCompletion = async () => {
    setUndoingCompletion(true);

    const result = await updateEvent(
      event.id,
      {
        is_completed: false,
      },
      event.participants.map((p) => p.id)
    );

    setUndoingCompletion(false);

    if (result.error) {
      alert(result.error);
      return;
    }

    setLocalCompletedState(false);
    if (result.event && onUpdated) {
      onUpdated(result.event);
    }
  };

  // 削除
  const handleDelete = async () => {
    if (!confirm("この予定を削除しますか？")) return;

    setDeleting(true);
    const result = await deleteEvent(event.id);
    setDeleting(false);

    if (result.error) {
      alert(result.error);
      return;
    }

    if (onDeleted) {
      onDeleted(event.id);
    }
    onOpenChange(false);
    router.refresh();
  };

  const isRecurring = event.recurrence_group_id && event.recurrence_type && event.recurrence_type !== "none";
  const recurrenceInfo = getRecurrenceInfo();

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-auto max-h-[85vh] rounded-t-xl overflow-y-auto">
          <SheetHeader className="pb-4 border-b">
            <div className="flex items-start gap-3">
              <span className={`w-4 h-4 rounded-full mt-1 flex-shrink-0 ${color}`} />
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-left text-lg flex items-center gap-2">
                  {isCompleted && (
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                  )}
                  {event.title}
                </SheetTitle>
                {category && (
                  <Badge variant="secondary" className="mt-1">
                    {category.name}
                  </Badge>
                )}
              </div>
            </div>
          </SheetHeader>

          <div className="py-4 space-y-4">
            {/* 日時 */}
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>{formatDateRange()}</div>
            </div>

            {/* 繰り返し情報 */}
            {isRecurring && recurrenceInfo && (
              <div className="flex items-start gap-3">
                <Repeat className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>{recurrenceInfo}</div>
              </div>
            )}

            {/* 参加者 */}
            {participantNames && (
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>{participantNames}</div>
              </div>
            )}

            {/* 業務リンク */}
            {event.project && (
              <div className="flex items-start gap-3">
                <Briefcase className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <Link
                    href={`/projects/${event.project.id}`}
                    className="text-blue-600 hover:underline flex items-center gap-1"
                    onClick={() => onOpenChange(false)}
                  >
                    【{event.project.code}】{event.project.name}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            )}

            {/* 詳細 */}
            {event.description && (
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="whitespace-pre-wrap">{event.description}</div>
              </div>
            )}

            {/* 業務リンク入力（未完了かつ業務リンクがない場合のみ表示） */}
            {!isCompleted && !event.project && !showCompletionForm && !showNoProjectWarning && (
              <div className="border-t pt-4">
                <MobileProjectSearch
                  linkedProjectId={pendingProjectId}
                  linkedProjectCode={pendingProjectCode}
                  linkedProjectName={pendingProjectName}
                  onSelect={handleProjectSelect}
                  onClear={handleProjectClear}
                />
              </div>
            )}

            {/* 業務リンクなし警告 */}
            {showNoProjectWarning && (
              <div className="border rounded-md p-3 bg-amber-50 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">
                      業務リンクが設定されていません
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      このまま完了にしますか？
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowNoProjectWarning(false)}
                    className="flex-1"
                  >
                    キャンセル
                  </Button>
                  <Button
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700 flex-1"
                    onClick={handleContinueWithoutProject}
                  >
                    このまま続行
                  </Button>
                </div>
              </div>
            )}

            {/* 完了チェック */}
            {isCompleted ? (
              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">完了済み</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-orange-700 border-orange-300 hover:bg-orange-50"
                  onClick={handleUndoCompletion}
                  disabled={undoingCompletion}
                >
                  {undoingCompletion ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Circle className="h-4 w-4 mr-1" />
                  )}
                  未完了に戻す
                </Button>
              </div>
            ) : showCompletionForm ? (
              <div className="border rounded-md p-3 bg-green-50 space-y-3">
                <p className="text-sm font-medium text-green-800">
                  実際の作業時間を入力してください
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">開始時刻</Label>
                    <div className="flex items-center gap-1">
                      <select
                        className="w-14 h-8 px-1 rounded-md border border-input bg-background text-sm"
                        value={completionStartHour}
                        onChange={(e) => setCompletionStartHour(e.target.value)}
                      >
                        <option value="">--</option>
                        {HOUR_OPTIONS.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                      <span>:</span>
                      <select
                        className="w-14 h-8 px-1 rounded-md border border-input bg-background text-sm"
                        value={completionStartMinute}
                        onChange={(e) => setCompletionStartMinute(e.target.value)}
                      >
                        {MINUTE_OPTIONS.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">終了時刻</Label>
                    <div className="flex items-center gap-1">
                      <select
                        className="w-14 h-8 px-1 rounded-md border border-input bg-background text-sm"
                        value={completionEndHour}
                        onChange={(e) => setCompletionEndHour(e.target.value)}
                      >
                        <option value="">--</option>
                        {HOUR_OPTIONS.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                      <span>:</span>
                      <select
                        className="w-14 h-8 px-1 rounded-md border border-input bg-background text-sm"
                        value={completionEndMinute}
                        onChange={(e) => setCompletionEndMinute(e.target.value)}
                      >
                        {MINUTE_OPTIONS.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelCompletion}
                    disabled={savingCompletion}
                    className="flex-1"
                  >
                    キャンセル
                  </Button>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 flex-1"
                    onClick={handleSaveCompletion}
                    disabled={savingCompletion}
                  >
                    {savingCompletion && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    完了を保存
                  </Button>
                </div>
              </div>
            ) : !showNoProjectWarning ? (
              <div className="border-t pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-green-700 border-green-300 hover:bg-green-50"
                  onClick={handleCompletionClick}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  完了にする
                </Button>
              </div>
            ) : null}

            {/* 場所・Google Map */}
            {(event.location || event.map_url) && (
              <div className="border-t pt-4 space-y-2">
                {event.location && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>{event.location}</div>
                  </div>
                )}
                {event.map_url && (
                  <div className="flex items-start gap-3">
                    <ExternalLink className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <a
                      href={event.map_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Google Map で開く
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* フッターボタン */}
          <div className="flex gap-2 pt-4 border-t">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              削除
            </Button>
            <div className="flex-1" />
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              閉じる
            </Button>
            <Button onClick={handleEditClick}>
              <Pencil className="h-4 w-4 mr-1" />
              編集
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* イベント編集フォーム */}
      <MobileEventFormSheet
        open={showForm}
        onOpenChange={handleFormClose}
        date={event ? parseISO(event.start_date) : null}
        event={event}
        categories={categories}
        employees={employees}
        currentEmployeeId={currentEmployeeId}
      />
    </>
  );
}
