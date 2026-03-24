"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Clock, MapPin, Users, Plus, Pencil, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { type CalendarEventWithParticipants, type EventCategory } from "@/types/database";
import { MobileEventFormSheet } from "./mobile-event-form-sheet";
import { updateEvent } from "@/app/calendar/actions";

interface Employee {
  id: string;
  name: string;
}

interface MobileEventSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | null;
  events: CalendarEventWithParticipants[];
  categories: EventCategory[];
  employees: Employee[];
  currentEmployeeId: string | null;
}

// 時間オプション (0-23)
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
// 分オプション (15分単位)
const MINUTE_OPTIONS = ["00", "15", "30", "45"];

export function MobileEventSheet({
  open,
  onOpenChange,
  date,
  events,
  categories,
  employees,
  currentEmployeeId,
}: MobileEventSheetProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEventWithParticipants | null>(null);

  // 完了フォーム用の状態
  const [completingEventId, setCompletingEventId] = useState<string | null>(null);
  const [completionStartHour, setCompletionStartHour] = useState("");
  const [completionStartMinute, setCompletionStartMinute] = useState("");
  const [completionEndHour, setCompletionEndHour] = useState("");
  const [completionEndMinute, setCompletionEndMinute] = useState("");
  const [savingCompletion, setSavingCompletion] = useState(false);

  // ローカルでイベントの完了状態を管理
  const [localCompletedEvents, setLocalCompletedEvents] = useState<Set<string>>(new Set());

  if (!date) return null;

  const employeeMap = new Map(employees.map((e) => [e.id, e.name]));

  const handleAddClick = () => {
    setEditingEvent(null);
    setShowForm(true);
  };

  const handleEditClick = (event: CalendarEventWithParticipants) => {
    setEditingEvent(event);
    setShowForm(true);
  };

  const handleFormClose = (isOpen: boolean) => {
    setShowForm(isOpen);
    if (!isOpen) {
      setEditingEvent(null);
    }
  };

  // 完了ボタンを押したとき（時刻入力フォームを表示）
  const handleCompletionClick = (event: CalendarEventWithParticipants) => {
    if (event.all_day) {
      // 終日イベントの場合は現在時刻をデフォルトに
      const now = new Date();
      const hour = String(now.getHours()).padStart(2, "0");
      const minute = now.getMinutes() < 30 ? "00" : "30";
      setCompletionStartHour(hour);
      setCompletionStartMinute(minute);
      // 終了時刻を1時間後に
      const endHourNum = (now.getHours() + 1) % 24;
      setCompletionEndHour(String(endHourNum).padStart(2, "0"));
      setCompletionEndMinute(minute);
    } else {
      // 時刻指定済みの場合は既存の時刻をデフォルトに
      const startTimeParts = event.start_time?.slice(0, 5).split(":") || [];
      const endTimeParts = event.end_time?.slice(0, 5).split(":") || [];
      setCompletionStartHour(startTimeParts[0] || "");
      setCompletionStartMinute(startTimeParts[1] || "00");
      setCompletionEndHour(endTimeParts[0] || "");
      setCompletionEndMinute(endTimeParts[1] || "00");
    }
    setCompletingEventId(event.id);
  };

  // 完了をキャンセル
  const handleCancelCompletion = () => {
    setCompletingEventId(null);
    setCompletionStartHour("");
    setCompletionStartMinute("");
    setCompletionEndHour("");
    setCompletionEndMinute("");
  };

  // 完了を保存
  const handleSaveCompletion = async (event: CalendarEventWithParticipants) => {
    if (!completionStartHour || !completionEndHour) {
      alert("開始時刻と終了時刻を入力してください");
      return;
    }

    setSavingCompletion(true);
    const startTime = `${completionStartHour}:${completionStartMinute || "00"}:00`;
    const endTime = `${completionEndHour}:${completionEndMinute || "00"}:00`;

    const result = await updateEvent(
      event.id,
      {
        is_completed: true,
        all_day: event.all_day ? false : event.all_day,
        start_time: startTime,
        end_time: endTime,
      },
      event.participants.map((p) => p.id)
    );

    setSavingCompletion(false);

    if (result.error) {
      alert(result.error);
      return;
    }

    // ローカル状態を更新
    setLocalCompletedEvents(prev => new Set(prev).add(event.id));
    handleCancelCompletion();
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-xl">
          <SheetHeader className="pb-4 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-left">
                {format(date, "M月d日（E）", { locale: ja })}
              </SheetTitle>
              <Button size="sm" onClick={handleAddClick}>
                <Plus className="h-4 w-4 mr-1" />
                追加
              </Button>
            </div>
          </SheetHeader>

          <div className="py-4 overflow-y-auto h-full">
            {events.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">予定がありません</p>
                <Button variant="outline" onClick={handleAddClick}>
                  <Plus className="h-4 w-4 mr-1" />
                  予定を追加
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {events.map((event) => {
                  const category = categories.find((c) => c.id === event.event_category_id);
                  const color = category?.color || "bg-gray-400";
                  const participantNames = event.participants
                    ?.map((p) => employeeMap.get(p.id) || p.name)
                    .join(", ");
                  const isCompleted = event.is_completed || localCompletedEvents.has(event.id);
                  const isCompletingThis = completingEventId === event.id;

                  return (
                    <div
                      key={event.id}
                      className="bg-muted/50 rounded-lg p-4 space-y-2 relative"
                    >
                      {/* 編集ボタン */}
                      <button
                        onClick={() => handleEditClick(event)}
                        className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-muted transition-colors"
                      >
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </button>
                    {/* タイトル */}
                    <div className="flex items-start gap-3">
                      <span className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {isCompleted && (
                            <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                          )}
                          <h3 className="font-medium text-base">{event.title}</h3>
                        </div>
                        {category && (
                          <span className="text-xs text-muted-foreground">
                            {category.name}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 時間 */}
                    {(event.start_time || event.all_day) && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground ml-6">
                        <Clock className="h-4 w-4" />
                        {event.all_day ? (
                          <span>終日</span>
                        ) : (
                          <span>
                            {event.start_time?.slice(0, 5)}
                            {event.end_time && ` - ${event.end_time.slice(0, 5)}`}
                          </span>
                        )}
                      </div>
                    )}

                    {/* 場所 */}
                    {event.location && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground ml-6">
                        <MapPin className="h-4 w-4" />
                        <span>{event.location}</span>
                      </div>
                    )}

                    {/* 参加者 */}
                    {participantNames && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground ml-6">
                        <Users className="h-4 w-4" />
                        <span className="truncate">{participantNames}</span>
                      </div>
                    )}

                    {/* 説明 */}
                    {event.description && (
                      <p className="text-sm text-muted-foreground ml-6 whitespace-pre-wrap">
                        {event.description}
                      </p>
                    )}

                    {/* 完了ボタン / 完了済み表示 */}
                    {isCompleted ? (
                      <div className="flex items-center gap-2 text-green-700 ml-6 pt-2 border-t mt-2">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">完了済み</span>
                      </div>
                    ) : isCompletingThis ? (
                      <div className="border rounded-md p-3 bg-green-50 space-y-3 mt-2">
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
                            onClick={() => handleSaveCompletion(event)}
                            disabled={savingCompletion}
                          >
                            {savingCompletion && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                            完了を保存
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2 text-green-700 border-green-300 hover:bg-green-50"
                        onClick={() => handleCompletionClick(event)}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        完了にする
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>

    {/* イベント追加・編集フォーム */}
    <MobileEventFormSheet
      open={showForm}
      onOpenChange={handleFormClose}
      date={date}
      event={editingEvent}
      categories={categories}
      employees={employees}
      currentEmployeeId={currentEmployeeId}
    />
    </>
  );
}
