"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { CalendarDays, Plus, CheckCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import type { CalendarEventWithParticipants, Employee } from "@/types/database";
import { createProjectEvent, updateProjectEvent, getProjectEvents } from "./schedule-actions";

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
  const [showAddModal, setShowAddModal] = useState(false);

  // 新規追加フォーム
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newStartHour, setNewStartHour] = useState("");
  const [newStartMinute, setNewStartMinute] = useState("");
  const [newEndHour, setNewEndHour] = useState("");
  const [newEndMinute, setNewEndMinute] = useState("");
  const [newAllDay, setNewAllDay] = useState(true);
  const [newParticipantIds, setNewParticipantIds] = useState<string[]>([]);

  // 完了処理中の状態
  const [completingEventId, setCompletingEventId] = useState<string | null>(null);
  const [completionStartHour, setCompletionStartHour] = useState("");
  const [completionStartMinute, setCompletionStartMinute] = useState("");
  const [completionEndHour, setCompletionEndHour] = useState("");
  const [completionEndMinute, setCompletionEndMinute] = useState("");

  const resetForm = () => {
    setNewTitle("");
    setNewDate("");
    setNewStartHour("");
    setNewStartMinute("");
    setNewEndHour("");
    setNewEndMinute("");
    setNewAllDay(true);
    // デフォルトで担当者を選択
    setNewParticipantIds(defaultAssigneeId ? [defaultAssigneeId] : []);
  };

  const handleOpenAddModal = () => {
    resetForm();
    // デフォルトで明日の日付を設定
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setNewDate(format(tomorrow, "yyyy-MM-dd"));
    setShowAddModal(true);
  };

  const handleAddSubmit = async () => {
    if (!newTitle.trim() || !newDate) return;

    startTransition(async () => {
      const startTime = newAllDay ? null : `${newStartHour || "09"}:${newStartMinute || "00"}:00`;
      const endTime = newAllDay ? null : `${newEndHour || "10"}:${newEndMinute || "00"}:00`;

      const result = await createProjectEvent({
        projectId,
        title: newTitle.trim(),
        date: newDate,
        startTime,
        endTime,
        allDay: newAllDay,
        participantIds: newParticipantIds,
      });

      if (result.error) {
        alert(result.error);
        return;
      }

      setShowAddModal(false);
      // イベント一覧を再取得
      const updatedEvents = await getProjectEvents(projectId);
      setEvents(updatedEvents);
      router.refresh();
    });
  };

  // 完了処理開始
  const handleCompletionClick = (event: CalendarEventWithParticipants) => {
    if (event.all_day || !event.start_time) {
      // 終日または時刻未設定の場合は現在時刻をデフォルトに
      const now = new Date();
      const hour = String(now.getHours()).padStart(2, "0");
      const minute = now.getMinutes() < 30 ? "00" : "30";
      setCompletionStartHour(hour);
      setCompletionStartMinute(minute);
      const endHourNum = (now.getHours() + 1) % 24;
      setCompletionEndHour(String(endHourNum).padStart(2, "0"));
      setCompletionEndMinute(minute);
    } else {
      // 既存の時刻をデフォルトに
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

  // 日付でソート（近い日付が上）
  const sortedEvents = [...events].sort((a, b) => {
    return a.start_date.localeCompare(b.start_date);
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            スケジュール
          </CardTitle>
          <Button size="sm" variant="outline" onClick={handleOpenAddModal}>
            <Plus className="h-4 w-4 mr-1" />
            追加
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {sortedEvents.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">
            スケジュールがありません
          </p>
        ) : (
          <div className="space-y-2">
            {sortedEvents.map((event) => {
              const isCompleting = completingEventId === event.id;

              return (
                <div
                  key={event.id}
                  className={`flex items-start gap-3 py-2 px-3 rounded-md border ${
                    event.is_completed ? "bg-green-50 border-green-200" : "bg-muted/30"
                  }`}
                >
                  {/* 完了チェック */}
                  {event.is_completed ? (
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <button
                      onClick={() => handleCompletionClick(event)}
                      className="w-5 h-5 border-2 border-muted-foreground/30 rounded-full flex-shrink-0 mt-0.5 hover:border-green-500 transition-colors"
                      title="完了にする"
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    {/* タイトル & 日付 */}
                    <div className="flex items-start justify-between gap-2">
                      <span className={`text-sm font-medium ${event.is_completed ? "text-green-800" : ""}`}>
                        {event.title}
                      </span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(event.start_date), "M/d(E)", { locale: ja })}
                        {event.start_time && !event.all_day && (
                          <span className="ml-1">
                            {event.start_time.slice(0, 5)}
                            {event.end_time && `〜${event.end_time.slice(0, 5)}`}
                          </span>
                        )}
                      </span>
                    </div>

                    {/* 完了時刻入力フォーム */}
                    {isCompleting && (
                      <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-md space-y-2">
                        <p className="text-xs font-medium text-green-800">
                          実際の作業時間を入力
                        </p>
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
            })}
          </div>
        )}
      </CardContent>

      {/* 新規スケジュール追加モーダル */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>スケジュールを追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">タイトル *</Label>
              <Input
                id="title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="スケジュールのタイトル"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">日付 *</Label>
              <Input
                id="date"
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="allDay"
                checked={newAllDay}
                onCheckedChange={(checked) => setNewAllDay(!!checked)}
              />
              <Label htmlFor="allDay" className="cursor-pointer">
                終日
              </Label>
            </div>

            {!newAllDay && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>開始時刻</Label>
                  <div className="flex items-center gap-1">
                    <select
                      className="w-16 h-9 px-2 rounded-md border text-sm"
                      value={newStartHour}
                      onChange={(e) => {
                        setNewStartHour(e.target.value);
                        if (!newStartMinute) setNewStartMinute("00");
                        // 終了時刻を1時間後に
                        if (e.target.value) {
                          const endHour = (parseInt(e.target.value) + 1) % 24;
                          setNewEndHour(String(endHour).padStart(2, "0"));
                          if (!newEndMinute) setNewEndMinute("00");
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
                      value={newStartMinute}
                      onChange={(e) => setNewStartMinute(e.target.value)}
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
                      value={newEndHour}
                      onChange={(e) => setNewEndHour(e.target.value)}
                    >
                      <option value="">--</option>
                      {HOUR_OPTIONS.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    <span>:</span>
                    <select
                      className="w-16 h-9 px-2 rounded-md border text-sm"
                      value={newEndMinute}
                      onChange={(e) => setNewEndMinute(e.target.value)}
                    >
                      {MINUTE_OPTIONS.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* 参加者選択 */}
            <div className="space-y-2">
              <Label>参加者</Label>
              <div className="border rounded-md p-3 max-h-32 overflow-y-auto space-y-2">
                {employees.map((emp) => (
                  <div key={emp.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`participant-${emp.id}`}
                      checked={newParticipantIds.includes(emp.id)}
                      onCheckedChange={(checked) => {
                        setNewParticipantIds((prev) =>
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              キャンセル
            </Button>
            <Button onClick={handleAddSubmit} disabled={isPending || !newTitle.trim() || !newDate}>
              {isPending ? "追加中..." : "追加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
