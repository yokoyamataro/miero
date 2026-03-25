"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
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
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  MapPin,
  Users,
  Trash2,
  ExternalLink,
  FileText,
  Briefcase,
  Repeat,
  CheckCircle,
  Loader2,
  Circle,
  Save,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import {
  type CalendarEventWithParticipants,
  type Employee,
  type EventCategory,
  EVENT_CATEGORY_COLORS,
  type EventCategoryLegacy,
  RECURRENCE_TYPE_LABELS,
  DAY_OF_WEEK_LABELS,
} from "@/types/database";
import { deleteEvent, deleteRecurringEventsAll, deleteRecurringEventsFromDate, updateEvent } from "./actions";

// 時間オプション (0-23)
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
// 分オプション (15分単位)
const MINUTE_OPTIONS = ["00", "15", "30", "45"];

interface EventDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEventWithParticipants | null;
  employees: Employee[];
  eventCategories: EventCategory[];
  currentEmployeeId: string | null;
  onDeleted: (eventId: string) => void;
  onUpdated?: (event: CalendarEventWithParticipants) => void;
}

export function EventDetailModal({
  open,
  onOpenChange,
  event,
  employees,
  eventCategories,
  currentEmployeeId,
  onDeleted,
  onUpdated,
}: EventDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteOptions, setShowDeleteOptions] = useState(false);

  // 編集フォーム状態
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startHour, setStartHour] = useState("");
  const [startMinute, setStartMinute] = useState("");
  const [endHour, setEndHour] = useState("");
  const [endMinute, setEndMinute] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState("");
  const [mapUrl, setMapUrl] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);

  // 変更検知用
  const [hasChanges, setHasChanges] = useState(false);

  // 社員リストをソート
  const sortedEmployees = useMemo(() => {
    if (!currentEmployeeId) return employees;
    return [...employees].sort((a, b) => {
      if (a.id === currentEmployeeId) return -1;
      if (b.id === currentEmployeeId) return 1;
      return 0;
    });
  }, [employees, currentEmployeeId]);

  // イベントデータをフォームにロード
  useEffect(() => {
    if (event && open) {
      setTitle(event.title);
      setDescription(event.description || "");
      setCategoryId(event.event_category_id || "");
      setStartDate(event.start_date);
      const startParts = event.start_time?.slice(0, 5).split(":") || ["", ""];
      setStartHour(startParts[0] || "");
      setStartMinute(startParts[1] || "");
      const endParts = event.end_time?.slice(0, 5).split(":") || ["", ""];
      setEndHour(endParts[0] || "");
      setEndMinute(endParts[1] || "");
      setAllDay(event.all_day);
      setLocation(event.location || "");
      setMapUrl(event.map_url || "");
      setParticipantIds(event.participants.map((p) => p.id));
      setIsCompleted(event.is_completed || false);
      setHasChanges(false);
    }
  }, [event, open]);

  // 変更検知
  useEffect(() => {
    if (!event) return;
    const startTime = event.start_time?.slice(0, 5) || "";
    const endTime = event.end_time?.slice(0, 5) || "";
    const [origStartHour, origStartMin] = startTime.split(":");
    const [origEndHour, origEndMin] = endTime.split(":");

    const changed =
      title !== event.title ||
      description !== (event.description || "") ||
      categoryId !== (event.event_category_id || "") ||
      startDate !== event.start_date ||
      startHour !== (origStartHour || "") ||
      startMinute !== (origStartMin || "") ||
      endHour !== (origEndHour || "") ||
      endMinute !== (origEndMin || "") ||
      allDay !== event.all_day ||
      location !== (event.location || "") ||
      mapUrl !== (event.map_url || "") ||
      isCompleted !== (event.is_completed || false) ||
      JSON.stringify(participantIds.sort()) !== JSON.stringify(event.participants.map(p => p.id).sort());

    setHasChanges(changed);
  }, [event, title, description, categoryId, startDate, startHour, startMinute, endHour, endMinute, allDay, location, mapUrl, participantIds, isCompleted]);

  if (!event) return null;

  const isRecurring = event.recurrence_group_id && event.recurrence_type && event.recurrence_type !== "none";

  // 保存処理
  const handleSave = async () => {
    if (!title.trim()) {
      alert("タイトルを入力してください");
      return;
    }

    setSaving(true);

    const startTime = allDay ? null : (startHour && startMinute ? `${startHour}:${startMinute}:00` : null);
    const endTime = allDay ? null : (endHour && endMinute ? `${endHour}:${endMinute}:00` : null);

    const result = await updateEvent(
      event.id,
      {
        title: title.trim(),
        description: description.trim() || null,
        event_category_id: categoryId || null,
        start_date: startDate,
        start_time: startTime,
        end_date: startDate,
        end_time: endTime,
        all_day: allDay,
        is_completed: isCompleted,
        location: location.trim() || null,
        map_url: mapUrl.trim() || null,
      },
      participantIds
    );

    setSaving(false);

    if (result.error) {
      alert(result.error);
      return;
    }

    if (result.event && onUpdated) {
      onUpdated(result.event);
    }
    onOpenChange(false);
  };

  // 完了トグル処理（即座に保存）
  const handleCompletionToggle = async () => {
    const newCompleted = !isCompleted;
    setIsCompleted(newCompleted);

    // 終日イベントで完了にする場合は時刻を設定
    let startTime = event.start_time;
    let endTime = event.end_time;
    let newAllDay = event.all_day;

    if (newCompleted && event.all_day) {
      const now = new Date();
      const hour = String(now.getHours()).padStart(2, "0");
      const minute = now.getMinutes() < 30 ? "00" : "30";
      const endHourNum = (now.getHours() + 1) % 24;
      startTime = `${hour}:${minute}:00`;
      endTime = `${String(endHourNum).padStart(2, "0")}:${minute}:00`;
      newAllDay = false;
      // フォームの状態も更新
      setStartHour(hour);
      setStartMinute(minute);
      setEndHour(String(endHourNum).padStart(2, "0"));
      setEndMinute(minute);
      setAllDay(false);
    }

    setSaving(true);
    const result = await updateEvent(
      event.id,
      {
        is_completed: newCompleted,
        all_day: newAllDay,
        start_time: startTime,
        end_time: endTime,
      },
      event.participants.map((p) => p.id)
    );
    setSaving(false);

    if (result.error) {
      setIsCompleted(!newCompleted); // 元に戻す
      alert(result.error);
      return;
    }

    if (result.event && onUpdated) {
      onUpdated(result.event);
    }
  };

  const handleDelete = async () => {
    if (isRecurring) {
      setShowDeleteOptions(true);
      return;
    }

    if (!confirm("この予定を削除しますか？")) return;

    setLoading(true);
    const result = await deleteEvent(event.id);
    setLoading(false);

    if (result.error) {
      alert(result.error);
      return;
    }

    onDeleted(event.id);
  };

  const handleDeleteSingle = async () => {
    setLoading(true);
    const result = await deleteEvent(event.id);
    setLoading(false);
    setShowDeleteOptions(false);

    if (result.error) {
      alert(result.error);
      return;
    }

    onDeleted(event.id);
  };

  const handleDeleteAll = async () => {
    if (!event.recurrence_group_id) return;
    if (!confirm("この繰り返し予定のすべてを削除しますか？")) return;

    setLoading(true);
    const result = await deleteRecurringEventsAll(event.recurrence_group_id);
    setLoading(false);
    setShowDeleteOptions(false);

    if (result.error) {
      alert(result.error);
      return;
    }

    alert(`${result.count}件の予定を削除しました`);
    onDeleted(event.id);
  };

  const handleDeleteFromDate = async () => {
    if (!event.recurrence_group_id) return;
    if (!confirm(`${format(parseISO(event.start_date), "M月d日")}以降の繰り返し予定を削除しますか？`)) return;

    setLoading(true);
    const result = await deleteRecurringEventsFromDate(event.recurrence_group_id, event.start_date);
    setLoading(false);
    setShowDeleteOptions(false);

    if (result.error) {
      alert(result.error);
      return;
    }

    alert(`${result.count}件の予定を削除しました`);
    onDeleted(event.id);
  };

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

  // 区分の色と名前を取得
  const getCategoryInfo = () => {
    const selectedCategory = eventCategories.find(c => c.id === categoryId);
    if (selectedCategory) {
      return { color: selectedCategory.color, name: selectedCategory.name };
    }
    if (event.eventCategory) {
      return { color: event.eventCategory.color, name: event.eventCategory.name };
    }
    if (event.category && EVENT_CATEGORY_COLORS[event.category as EventCategoryLegacy]) {
      return { color: EVENT_CATEGORY_COLORS[event.category as EventCategoryLegacy], name: event.category };
    }
    return { color: "bg-gray-500", name: "未設定" };
  };

  const categoryInfo = getCategoryInfo();

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
          <div className="flex items-center gap-3">
            <div className={`w-4 h-4 rounded ${categoryInfo.color}`} />
            <DialogTitle className="text-xl flex-1">予定の詳細</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* 完了ステータス - 大きく目立つボタン */}
          <div
            onClick={handleCompletionToggle}
            className={`flex items-center gap-3 p-4 rounded-lg cursor-pointer transition-all ${
              isCompleted
                ? "bg-green-100 border-2 border-green-500"
                : "bg-gray-50 border-2 border-gray-200 hover:border-green-300 hover:bg-green-50"
            }`}
          >
            {saving ? (
              <Loader2 className="h-8 w-8 animate-spin text-green-600" />
            ) : isCompleted ? (
              <CheckCircle className="h-8 w-8 text-green-600" />
            ) : (
              <Circle className="h-8 w-8 text-gray-400" />
            )}
            <div className="flex-1">
              <div className={`font-bold text-lg ${isCompleted ? "text-green-700" : "text-gray-700"}`}>
                {isCompleted ? "完了済み" : "未完了"}
              </div>
              <div className="text-sm text-muted-foreground">
                {isCompleted ? "クリックで未完了に戻す" : "クリックで完了にする"}
              </div>
            </div>
          </div>

          {/* タイトル */}
          <div className="space-y-2">
            <Label>タイトル *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="予定のタイトル"
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

          {/* 日付・時刻 */}
          <div className="space-y-2">
            <Label>日時</Label>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40"
              />
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={allDay}
                  onCheckedChange={(checked) => setAllDay(checked as boolean)}
                />
                終日
              </label>
            </div>
            {!allDay && (
              <div className="flex items-center gap-2 mt-2">
                <select
                  className="w-20 h-9 px-2 rounded-md border border-input bg-background text-sm"
                  value={startHour}
                  onChange={(e) => setStartHour(e.target.value)}
                >
                  <option value="">--</option>
                  {HOUR_OPTIONS.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                <span>:</span>
                <select
                  className="w-20 h-9 px-2 rounded-md border border-input bg-background text-sm"
                  value={startMinute}
                  onChange={(e) => setStartMinute(e.target.value)}
                >
                  {MINUTE_OPTIONS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <span className="mx-2">〜</span>
                <select
                  className="w-20 h-9 px-2 rounded-md border border-input bg-background text-sm"
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
                  className="w-20 h-9 px-2 rounded-md border border-input bg-background text-sm"
                  value={endMinute}
                  onChange={(e) => setEndMinute(e.target.value)}
                >
                  {MINUTE_OPTIONS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 繰り返し情報（読み取り専用） */}
          {isRecurring && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-2 rounded">
              <Repeat className="h-4 w-4" />
              <span>{getRecurrenceInfo()}</span>
            </div>
          )}

          {/* 参加者 */}
          <div className="space-y-2">
            <Label>参加者</Label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {sortedEmployees.map((emp) => (
                <label
                  key={emp.id}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm cursor-pointer transition-colors ${
                    participantIds.includes(emp.id)
                      ? "border-primary bg-primary/10"
                      : "border-input hover:bg-muted"
                  }`}
                >
                  <Checkbox
                    checked={participantIds.includes(emp.id)}
                    onCheckedChange={() => toggleParticipant(emp.id)}
                  />
                  {emp.name}
                </label>
              ))}
            </div>
          </div>

          {/* 場所 */}
          <div className="space-y-2">
            <Label>場所</Label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="場所"
            />
          </div>

          {/* Google Map URL */}
          <div className="space-y-2">
            <Label>Google Map URL</Label>
            <Input
              value={mapUrl}
              onChange={(e) => setMapUrl(e.target.value)}
              placeholder="https://maps.google.com/..."
            />
            {mapUrl && (
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                Google Map で開く
              </a>
            )}
          </div>

          {/* 詳細・メモ */}
          <div className="space-y-2">
            <Label>詳細・メモ</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="メモや詳細情報"
              rows={3}
            />
          </div>

          {/* 業務リンク（読み取り専用） */}
          {event.project && (
            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
              <Briefcase className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <Link
                  href={`/projects/${event.project.id}`}
                  className="text-blue-600 hover:underline flex items-center gap-1 font-medium"
                  onClick={() => onOpenChange(false)}
                >
                  【{event.project.code}】{event.project.name}
                  <ExternalLink className="h-3 w-3" />
                </Link>
                {event.task && (
                  <div className="text-sm text-muted-foreground mt-1">
                    タスク: {event.task.title}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 作成者 */}
          {event.creator && (
            <div className="text-sm text-muted-foreground">
              作成者: {event.creator.name}
            </div>
          )}
        </div>

        {/* 繰り返し予定の削除オプション */}
        {showDeleteOptions && isRecurring && (
          <div className="border rounded-md p-3 bg-muted/30 space-y-2">
            <p className="text-sm font-medium">削除オプション</p>
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={handleDeleteSingle}
                disabled={loading}
              >
                この予定だけを削除
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={handleDeleteFromDate}
                disabled={loading}
              >
                この日以降の繰り返しを削除
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="w-full justify-start"
                onClick={handleDeleteAll}
                disabled={loading}
              >
                すべての繰り返しを削除
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setShowDeleteOptions(false)}
              >
                キャンセル
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={loading || saving}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            削除
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              閉じる
            </Button>
            {hasChanges && (
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                保存
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
