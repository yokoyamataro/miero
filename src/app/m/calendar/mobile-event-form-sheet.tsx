"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { type CalendarEventWithParticipants, type EventCategory } from "@/types/database";
import { createEvent, updateEvent, deleteEvent } from "@/app/calendar/actions";

interface Employee {
  id: string;
  name: string;
}

interface MobileEventFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | null;
  event: CalendarEventWithParticipants | null;
  categories: EventCategory[];
  employees: Employee[];
  currentEmployeeId: string | null;
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

export function MobileEventFormSheet({
  open,
  onOpenChange,
  date,
  event,
  categories,
  employees,
  currentEmployeeId,
}: MobileEventFormSheetProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // フォーム状態
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [startHour, setStartHour] = useState("");
  const [startMinute, setStartMinute] = useState("");
  const [endHour, setEndHour] = useState("");
  const [endMinute, setEndMinute] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>([]);

  // 社員リストをソート（ログインユーザーを先頭に）
  const sortedEmployees = useMemo(() => {
    if (!currentEmployeeId) return employees;
    return [...employees].sort((a, b) => {
      if (a.id === currentEmployeeId) return -1;
      if (b.id === currentEmployeeId) return 1;
      return 0;
    });
  }, [employees, currentEmployeeId]);

  // 編集時のデータ読み込み / 新規時の初期化
  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setCategoryId(event.event_category_id || categories[0]?.id || "");
      setStartDate(event.start_date);
      const startTimeParts = splitTime(event.start_time?.slice(0, 5) || "");
      setStartHour(startTimeParts.hour);
      setStartMinute(startTimeParts.minute);
      const endTimeParts = splitTime(event.end_time?.slice(0, 5) || "");
      setEndHour(endTimeParts.hour);
      setEndMinute(endTimeParts.minute);
      setAllDay(event.all_day);
      setLocation(event.location || "");
      setParticipantIds(event.participants.map((p) => p.id));
    } else if (date) {
      const dateStr = format(date, "yyyy-MM-dd");
      setTitle("");
      setCategoryId(categories[0]?.id || "");
      setStartDate(dateStr);
      setStartHour("");
      setStartMinute("");
      setEndHour("");
      setEndMinute("");
      setAllDay(false);
      setLocation("");
      setParticipantIds(currentEmployeeId ? [currentEmployeeId] : []);
    }
    setError(null);
  }, [event, date, open, categories, currentEmployeeId]);

  const handleSubmit = async () => {
    if (!title.trim() || !startDate) {
      setError("タイトルと日付は必須です");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const startTime = combineTime(startHour, startMinute);
      const endTime = combineTime(endHour, endMinute);

      const eventData = {
        title: title.trim(),
        description: null,
        category: "その他" as const,
        event_category_id: categoryId || null,
        start_date: startDate,
        start_time: startTime || null,
        end_date: startDate,
        end_time: endTime || null,
        all_day: allDay,
        location: location.trim() || null,
        map_url: null,
        project_id: event?.project_id || null,
        task_id: event?.task_id || null,
      };

      if (event && event.id) {
        const result = await updateEvent(event.id, eventData, participantIds);
        if (result.error) {
          setError(result.error);
          return;
        }
      } else {
        const result = await createEvent(eventData, participantIds);
        if (result.error) {
          setError(result.error);
          return;
        }
      }

      onOpenChange(false);
      router.refresh();
    } catch {
      setError("保存に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!event?.id) return;
    if (!confirm("この予定を削除しますか？")) return;

    setDeleting(true);
    try {
      const result = await deleteEvent(event.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      onOpenChange(false);
      router.refresh();
    } catch {
      setError("削除に失敗しました");
    } finally {
      setDeleting(false);
    }
  };

  const toggleParticipant = (employeeId: string) => {
    setParticipantIds((prev) =>
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  if (!date && !event) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-xl flex flex-col">
        <SheetHeader className="pb-2 border-b flex-shrink-0">
          <SheetTitle className="text-left">
            {event ? "予定を編集" : "予定を追加"}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* タイトル */}
          <div className="space-y-1">
            <Label htmlFor="title" className="text-sm">タイトル *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="予定のタイトル"
              className="h-10"
            />
          </div>

          {/* 区分 */}
          <div className="space-y-1">
            <Label className="text-sm">区分</Label>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryId(cat.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs transition-colors ${
                    categoryId === cat.id
                      ? "border-primary bg-primary/10"
                      : "border-input hover:bg-muted"
                  }`}
                >
                  <div className={`w-2.5 h-2.5 rounded ${cat.color}`} />
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* 日付 */}
          <div className="space-y-1">
            <Label htmlFor="startDate" className="text-sm">日付 *</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-10"
            />
          </div>

          {/* 終日チェック */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="allDay"
              checked={allDay}
              onCheckedChange={(checked) => setAllDay(!!checked)}
            />
            <Label htmlFor="allDay" className="text-sm cursor-pointer">
              終日
            </Label>
          </div>

          {/* 時刻 */}
          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-sm">開始時刻</Label>
                <div className="flex items-center gap-1">
                  <select
                    className="flex-1 h-10 px-2 rounded-md border border-input bg-background text-sm"
                    value={startHour}
                    onChange={(e) => {
                      const newHour = e.target.value;
                      setStartHour(newHour);
                      if (newHour && !startMinute) {
                        setStartMinute("00");
                        const startMinutes = parseInt(newHour) * 60;
                        const endMinutes = startMinutes + 60;
                        setEndHour(String(Math.floor(endMinutes / 60) % 24).padStart(2, "0"));
                        setEndMinute("00");
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
                    className="flex-1 h-10 px-2 rounded-md border border-input bg-background text-sm"
                    value={startMinute}
                    onChange={(e) => setStartMinute(e.target.value)}
                  >
                    <option value="">--</option>
                    {MINUTE_OPTIONS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-sm">終了時刻</Label>
                <div className="flex items-center gap-1">
                  <select
                    className="flex-1 h-10 px-2 rounded-md border border-input bg-background text-sm"
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
                    className="flex-1 h-10 px-2 rounded-md border border-input bg-background text-sm"
                    value={endMinute}
                    onChange={(e) => setEndMinute(e.target.value)}
                  >
                    <option value="">--</option>
                    {MINUTE_OPTIONS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* 場所 */}
          <div className="space-y-1">
            <Label htmlFor="location" className="text-sm">場所</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="場所"
              className="h-10"
            />
          </div>

          {/* 参加者 */}
          <div className="space-y-1">
            <Label className="text-sm">参加者</Label>
            <div className="border rounded-md p-2 max-h-32 overflow-y-auto space-y-1.5">
              {sortedEmployees.map((emp) => (
                <div key={emp.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`participant-${emp.id}`}
                    checked={participantIds.includes(emp.id)}
                    onCheckedChange={() => toggleParticipant(emp.id)}
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

          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>

        <SheetFooter className="flex-shrink-0 border-t pt-3 gap-2">
          {event && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || loading}
              className="flex-1"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "削除"}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            キャンセル
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="flex-1">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "保存"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
