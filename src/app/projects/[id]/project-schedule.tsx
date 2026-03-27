"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CalendarDays, Plus, CheckCircle, Loader2, Pencil, Trash2, MapPin, Briefcase, Clock, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import type { CalendarEventWithParticipants, Employee, EventCategory } from "@/types/database";
import {
  createProjectEvent,
  updateProjectEvent,
  updateProjectEventFull,
  deleteProjectEvent,
  getProjectEvents,
  getEventCategories,
} from "./schedule-actions";

interface ProjectScheduleProps {
  projectId: string;
  events: CalendarEventWithParticipants[];
  employees: Employee[];
  currentEmployeeId: string | null;
  defaultAssigneeId: string | null;
}

// 時間オプション (0-23)
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
// 分オプション (15分単位)
const MINUTE_OPTIONS = ["00", "15", "30", "45"];

export function ProjectSchedule({
  projectId,
  events: initialEvents,
  employees,
  currentEmployeeId,
  defaultAssigneeId,
}: ProjectScheduleProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [events, setEvents] = useState<CalendarEventWithParticipants[]>(initialEvents);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEventWithParticipants | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // 日時未定で追加するかどうか
  const [isAddingUndated, setIsAddingUndated] = useState(false);

  // イベントカテゴリ
  const [eventCategories, setEventCategories] = useState<EventCategory[]>([]);

  // フォーム
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [startHour, setStartHour] = useState("");
  const [startMinute, setStartMinute] = useState("");
  const [endHour, setEndHour] = useState("");
  const [endMinute, setEndMinute] = useState("");
  const [allDay, setAllDay] = useState(true);
  const [location, setLocation] = useState("");
  const [mapUrl, setMapUrl] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);

  // 完了処理中の状態
  const [completingEventId, setCompletingEventId] = useState<string | null>(null);
  const [completionStartHour, setCompletionStartHour] = useState("");
  const [completionStartMinute, setCompletionStartMinute] = useState("");
  const [completionEndHour, setCompletionEndHour] = useState("");
  const [completionEndMinute, setCompletionEndMinute] = useState("");

  // 日時設定中のイベント
  const [settingDateEventId, setSettingDateEventId] = useState<string | null>(null);
  const [settingDate, setSettingDate] = useState("");

  // 社員リストをソート（ログインユーザーを先頭に）
  const sortedEmployees = useMemo(() => {
    if (!currentEmployeeId) return employees;
    return [...employees].sort((a, b) => {
      if (a.id === currentEmployeeId) return -1;
      if (b.id === currentEmployeeId) return 1;
      return 0;
    });
  }, [employees, currentEmployeeId]);

  // イベントカテゴリを取得
  useEffect(() => {
    const loadCategories = async () => {
      const categories = await getEventCategories();
      setEventCategories(categories);
    };
    loadCategories();
  }, []);

  // イベントを分類：日時確定（古い順）と日時未定
  const { datedEvents, undatedEvents } = useMemo(() => {
    const dated: CalendarEventWithParticipants[] = [];
    const undated: CalendarEventWithParticipants[] = [];

    events.forEach((event) => {
      if (event.start_date) {
        dated.push(event);
      } else {
        undated.push(event);
      }
    });

    // 日時確定は古い順（上から古い順）
    dated.sort((a, b) => a.start_date.localeCompare(b.start_date));
    // 日時未定はsort_orderで並び替え
    undated.sort((a, b) => ((a as { sort_order?: number }).sort_order || 0) - ((b as { sort_order?: number }).sort_order || 0));

    return { datedEvents: dated, undatedEvents: undated };
  }, [events]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setCategoryId(eventCategories[0]?.id || "");
    setEventDate("");
    setStartHour("");
    setStartMinute("");
    setEndHour("");
    setEndMinute("");
    setAllDay(true);
    setLocation("");
    setMapUrl("");
    setParticipantIds(defaultAssigneeId ? [defaultAssigneeId] : []);
    setIsCompleted(false);
    setEditingEvent(null);
    setIsAddingUndated(false);
  };

  const handleOpenAddModal = (undated: boolean = false) => {
    resetForm();
    setIsAddingUndated(undated);
    if (!undated) {
      // デフォルトで明日の日付を設定
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setEventDate(format(tomorrow, "yyyy-MM-dd"));
    }
    setShowModal(true);
  };

  const handleOpenEditModal = (event: CalendarEventWithParticipants) => {
    setEditingEvent(event);
    setIsAddingUndated(!event.start_date);
    setTitle(event.title);
    setDescription(event.description || "");
    setCategoryId(event.event_category_id || "");
    setEventDate(event.start_date || "");
    const startTimeParts = event.start_time?.slice(0, 5).split(":") || ["", ""];
    setStartHour(startTimeParts[0] || "");
    setStartMinute(startTimeParts[1] || "");
    const endTimeParts = event.end_time?.slice(0, 5).split(":") || ["", ""];
    setEndHour(endTimeParts[0] || "");
    setEndMinute(endTimeParts[1] || "");
    setAllDay(event.all_day);
    setLocation(event.location || "");
    setMapUrl(event.map_url || "");
    setParticipantIds(event.participants.map((p) => p.id));
    setIsCompleted(event.is_completed || false);
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    // 日時未定でない場合は日付が必須
    if (!isAddingUndated && !eventDate) return;

    startTransition(async () => {
      const startTime = allDay ? null : `${startHour || "09"}:${startMinute || "00"}:00`;
      const endTime = allDay ? null : `${endHour || "10"}:${endMinute || "00"}:00`;

      if (editingEvent) {
        // 更新
        const result = await updateProjectEventFull(editingEvent.id, {
          title: title.trim(),
          description: description.trim(),
          date: isAddingUndated ? null : eventDate,
          startTime: isAddingUndated ? null : startTime,
          endTime: isAddingUndated ? null : endTime,
          allDay: isAddingUndated ? true : allDay,
          location: location.trim(),
          mapUrl: mapUrl.trim(),
          participantIds,
          eventCategoryId: categoryId || null,
          isCompleted,
        });

        if (result.error) {
          alert(result.error);
          return;
        }
      } else {
        // 新規作成
        const result = await createProjectEvent({
          projectId,
          title: title.trim(),
          description: description.trim(),
          date: isAddingUndated ? null : eventDate,
          startTime: isAddingUndated ? null : startTime,
          endTime: isAddingUndated ? null : endTime,
          allDay: isAddingUndated ? true : allDay,
          location: location.trim(),
          mapUrl: mapUrl.trim(),
          participantIds,
          eventCategoryId: categoryId || null,
        });

        if (result.error) {
          alert(result.error);
          return;
        }
      }

      setShowModal(false);
      // イベント一覧を再取得
      const updatedEvents = await getProjectEvents(projectId);
      setEvents(updatedEvents);
      router.refresh();
    });
  };

  const handleDelete = async () => {
    if (!editingEvent) return;

    startTransition(async () => {
      const result = await deleteProjectEvent(editingEvent.id);

      if (result.error) {
        alert(result.error);
        return;
      }

      setShowDeleteConfirm(false);
      setShowModal(false);
      const updatedEvents = await getProjectEvents(projectId);
      setEvents(updatedEvents);
      router.refresh();
    });
  };

  // 完了処理開始
  const handleCompletionClick = (event: CalendarEventWithParticipants) => {
    if (event.all_day || !event.start_time) {
      const now = new Date();
      const hour = String(now.getHours()).padStart(2, "0");
      const minute = now.getMinutes() < 30 ? "00" : "30";
      setCompletionStartHour(hour);
      setCompletionStartMinute(minute);
      const endHourNum = (now.getHours() + 1) % 24;
      setCompletionEndHour(String(endHourNum).padStart(2, "0"));
      setCompletionEndMinute(minute);
    } else {
      const startParts = event.start_time?.slice(0, 5).split(":") || [];
      const endParts = event.end_time?.slice(0, 5).split(":") || [];
      setCompletionStartHour(startParts[0] || "");
      setCompletionStartMinute(startParts[1] || "00");
      setCompletionEndHour(endParts[0] || "");
      setCompletionEndMinute(endParts[1] || "00");
    }
    setCompletingEventId(event.id);
  };

  const handleCancelCompletion = () => {
    setCompletingEventId(null);
    setCompletionStartHour("");
    setCompletionStartMinute("");
    setCompletionEndHour("");
    setCompletionEndMinute("");
  };

  const handleSaveCompletion = async (event: CalendarEventWithParticipants) => {
    if (!completionStartHour || !completionEndHour) {
      alert("開始時刻と終了時刻を入力してください");
      return;
    }

    startTransition(async () => {
      const startTime = `${completionStartHour}:${completionStartMinute || "00"}:00`;
      const endTime = `${completionEndHour}:${completionEndMinute || "00"}:00`;

      const result = await updateProjectEvent(event.id, {
        is_completed: true,
        all_day: false,
        start_time: startTime,
        end_time: endTime,
      });

      if (result.error) {
        alert(result.error);
        return;
      }

      handleCancelCompletion();
      const updatedEvents = await getProjectEvents(projectId);
      setEvents(updatedEvents);
      router.refresh();
    });
  };

  // 日時未定イベントに日付を設定
  const handleSetDate = (event: CalendarEventWithParticipants) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setSettingDate(format(tomorrow, "yyyy-MM-dd"));
    setSettingDateEventId(event.id);
  };

  const handleCancelSetDate = () => {
    setSettingDateEventId(null);
    setSettingDate("");
  };

  const handleSaveSetDate = async (event: CalendarEventWithParticipants) => {
    if (!settingDate) {
      alert("日付を選択してください");
      return;
    }

    startTransition(async () => {
      const result = await updateProjectEventFull(event.id, {
        title: event.title,
        description: event.description || "",
        date: settingDate,
        startTime: null,
        endTime: null,
        allDay: true,
        location: event.location || "",
        mapUrl: event.map_url || "",
        participantIds: event.participants.map((p) => p.id),
        eventCategoryId: event.event_category_id || null,
        isCompleted: false,
      });

      if (result.error) {
        alert(result.error);
        return;
      }

      handleCancelSetDate();
      const updatedEvents = await getProjectEvents(projectId);
      setEvents(updatedEvents);
      router.refresh();
    });
  };

  // イベント行の描画
  const renderEventRow = (event: CalendarEventWithParticipants, isUndated: boolean = false) => {
    const isCompleting = completingEventId === event.id;
    const isSettingDate = settingDateEventId === event.id;
    const category = eventCategories.find((c) => c.id === event.event_category_id);

    return (
      <div
        key={event.id}
        className={`flex items-start gap-3 py-2 px-3 rounded-md border ${
          event.is_completed
            ? "bg-green-50 border-green-200"
            : isUndated
            ? "bg-amber-50/50 border-amber-200"
            : "bg-muted/30"
        }`}
      >
        {/* 完了チェック or 日時設定ボタン */}
        {isUndated && !event.is_completed ? (
          <button
            onClick={() => handleSetDate(event)}
            className="w-6 h-6 border border-blue-300 rounded flex items-center justify-center flex-shrink-0 mt-0.5 hover:bg-blue-50 transition-colors text-blue-500"
            title="日時を設定"
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : event.is_completed ? (
          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
        ) : (
          <button
            onClick={() => handleCompletionClick(event)}
            className="w-5 h-5 border-2 border-muted-foreground/30 rounded-full flex-shrink-0 mt-0.5 hover:border-green-500 transition-colors"
            title="完了にする"
          />
        )}

        <div className="flex-1 min-w-0">
          {/* タイトル & 日付 & 編集ボタン */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${event.is_completed ? "text-green-800" : ""}`}>
                  {event.title}
                </span>
                {category && (
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded text-white ${category.color || "bg-gray-500"}`}
                  >
                    {category.name}
                  </span>
                )}
              </div>
              {event.location && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                  <MapPin className="h-3 w-3" />
                  {event.location}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isUndated ? (
                <span className="text-xs text-amber-600 whitespace-nowrap flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  日時未定
                </span>
              ) : event.start_date && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {format(new Date(event.start_date), "M/d(E)", { locale: ja })}
                  {event.start_time && !event.all_day && (
                    <span className="ml-1">
                      {event.start_time.slice(0, 5)}
                      {event.end_time && `〜${event.end_time.slice(0, 5)}`}
                    </span>
                  )}
                </span>
              )}
              <button
                onClick={() => handleOpenEditModal(event)}
                className="p-1 rounded hover:bg-muted transition-colors"
                title="編集"
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* 日時設定フォーム（日時未定イベント用） */}
          {isSettingDate && (
            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md space-y-2">
              <p className="text-xs font-medium text-blue-800">日付を設定</p>
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  type="date"
                  value={settingDate}
                  onChange={(e) => setSettingDate(e.target.value)}
                  className="h-7 w-36 text-xs"
                />
                <div className="flex gap-1 ml-auto">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={handleCancelSetDate}
                    disabled={isPending}
                  >
                    取消
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 px-2 text-xs bg-blue-600 hover:bg-blue-700"
                    onClick={() => handleSaveSetDate(event)}
                    disabled={isPending}
                  >
                    {isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                    設定
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* 完了時刻入力フォーム */}
          {isCompleting && (
            <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-md space-y-2">
              <p className="text-xs font-medium text-green-800">実際の作業時間を入力</p>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                  <select
                    className="w-14 h-7 px-1 rounded border text-xs"
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
                    className="w-14 h-7 px-1 rounded border text-xs"
                    value={completionStartMinute}
                    onChange={(e) => setCompletionStartMinute(e.target.value)}
                  >
                    {MINUTE_OPTIONS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <span className="text-xs">〜</span>
                <div className="flex items-center gap-1">
                  <select
                    className="w-14 h-7 px-1 rounded border text-xs"
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
                    className="w-14 h-7 px-1 rounded border text-xs"
                    value={completionEndMinute}
                    onChange={(e) => setCompletionEndMinute(e.target.value)}
                  >
                    {MINUTE_OPTIONS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-1 ml-auto">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={handleCancelCompletion}
                    disabled={isPending}
                  >
                    取消
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700"
                    onClick={() => handleSaveCompletion(event)}
                    disabled={isPending}
                  >
                    {isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                    完了
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            スケジュール
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => handleOpenAddModal(true)}>
              <Clock className="h-4 w-4 mr-1" />
              未定
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleOpenAddModal(false)}>
              <Plus className="h-4 w-4 mr-1" />
              追加
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 日時確定イベント（古い順に上から） */}
        {datedEvents.length > 0 && (
          <div className="space-y-2">
            {datedEvents.map((event) => renderEventRow(event, false))}
          </div>
        )}

        {/* 日時未定イベント */}
        {undatedEvents.length > 0 && (
          <div className="space-y-2">
            {datedEvents.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
                <div className="h-px flex-1 bg-border" />
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  日時未定
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
            )}
            {undatedEvents.map((event) => renderEventRow(event, true))}
          </div>
        )}

        {/* イベントがない場合 */}
        {datedEvents.length === 0 && undatedEvents.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-4">
            スケジュールがありません
          </p>
        )}
      </CardContent>

      {/* スケジュール追加・編集モーダル */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEvent
                ? "スケジュールを編集"
                : isAddingUndated
                ? "日時未定のスケジュールを追加"
                : "スケジュールを追加"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* タイトル */}
            <div className="space-y-2">
              <Label htmlFor="schedule-title">タイトル *</Label>
              <Input
                id="schedule-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="スケジュールのタイトル"
              />
            </div>

            {/* 区分 */}
            {eventCategories.length > 0 && (
              <div className="space-y-2">
                <Label>区分</Label>
                <div className="flex flex-wrap gap-2">
                  {eventCategories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategoryId(cat.id === categoryId ? "" : cat.id)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm transition-colors ${
                        cat.id === categoryId
                          ? "border-primary bg-primary/10"
                          : "border-input hover:bg-muted"
                      }`}
                    >
                      <div className={`w-3 h-3 rounded ${cat.color}`} />
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 日時未定/確定の切り替え */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="schedule-undated"
                checked={isAddingUndated}
                onCheckedChange={(checked) => setIsAddingUndated(!!checked)}
              />
              <Label htmlFor="schedule-undated" className="cursor-pointer">
                日時未定
              </Label>
            </div>

            {/* 日付（日時未定でない場合のみ） */}
            {!isAddingUndated && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="schedule-date">日付 *</Label>
                  <Input
                    id="schedule-date"
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                  />
                </div>

                {/* 終日 */}
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="schedule-allDay"
                    checked={allDay}
                    onCheckedChange={(checked) => setAllDay(!!checked)}
                  />
                  <Label htmlFor="schedule-allDay" className="cursor-pointer">
                    終日
                  </Label>
                </div>

                {/* 時刻 */}
                {!allDay && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>開始時刻</Label>
                      <div className="flex items-center gap-1">
                        <select
                          className="w-16 h-9 px-2 rounded-md border text-sm"
                          value={startHour}
                          onChange={(e) => {
                            setStartHour(e.target.value);
                            if (!startMinute) setStartMinute("00");
                            if (e.target.value) {
                              const endHourNum = (parseInt(e.target.value) + 1) % 24;
                              setEndHour(String(endHourNum).padStart(2, "0"));
                              if (!endMinute) setEndMinute("00");
                            }
                          }}
                        >
                          <option value="">--</option>
                          {HOUR_OPTIONS.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                        <span>:</span>
                        <select
                          className="w-16 h-9 px-2 rounded-md border text-sm"
                          value={startMinute}
                          onChange={(e) => setStartMinute(e.target.value)}
                        >
                          {MINUTE_OPTIONS.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>終了時刻</Label>
                      <div className="flex items-center gap-1">
                        <select
                          className="w-16 h-9 px-2 rounded-md border text-sm"
                          value={endHour}
                          onChange={(e) => setEndHour(e.target.value)}
                        >
                          <option value="">--</option>
                          {HOUR_OPTIONS.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                        <span>:</span>
                        <select
                          className="w-16 h-9 px-2 rounded-md border text-sm"
                          value={endMinute}
                          onChange={(e) => setEndMinute(e.target.value)}
                        >
                          {MINUTE_OPTIONS.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 場所 */}
            <div className="space-y-2">
              <Label htmlFor="schedule-location">場所</Label>
              <Input
                id="schedule-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="場所"
              />
            </div>

            {/* 地図URL */}
            <div className="space-y-2">
              <Label htmlFor="schedule-mapUrl">地図URL</Label>
              <Input
                id="schedule-mapUrl"
                value={mapUrl}
                onChange={(e) => setMapUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            {/* 説明 */}
            <div className="space-y-2">
              <Label htmlFor="schedule-description">説明</Label>
              <Textarea
                id="schedule-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="詳細な説明"
                rows={3}
              />
            </div>

            {/* 参加者選択 */}
            <div className="space-y-2">
              <Label>参加者</Label>
              <div className="border rounded-md p-3 max-h-32 overflow-y-auto space-y-2">
                {sortedEmployees.map((emp) => (
                  <div key={emp.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`participant-${emp.id}`}
                      checked={participantIds.includes(emp.id)}
                      onCheckedChange={(checked) => {
                        setParticipantIds((prev) =>
                          checked
                            ? [...prev, emp.id]
                            : prev.filter((id) => id !== emp.id)
                        );
                      }}
                    />
                    <Label
                      htmlFor={`participant-${emp.id}`}
                      className="cursor-pointer font-normal text-sm"
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

            {/* 完了フラグ（編集時かつ日時確定の場合のみ） */}
            {editingEvent && !isAddingUndated && (
              <div className="flex items-center gap-2 pt-2 border-t">
                <Checkbox
                  id="schedule-completed"
                  checked={isCompleted}
                  onCheckedChange={(checked) => setIsCompleted(!!checked)}
                />
                <Label htmlFor="schedule-completed" className="cursor-pointer">
                  完了済み
                </Label>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {editingEvent && (
              <Button
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                className="sm:mr-auto"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                削除
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowModal(false)}>
              キャンセル
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending || !title.trim() || (!isAddingUndated && !eventDate)}
            >
              {isPending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>スケジュールを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{editingEvent?.title}」を削除します。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
