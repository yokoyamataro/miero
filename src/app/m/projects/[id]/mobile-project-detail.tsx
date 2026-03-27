"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, User, Calendar, FolderOpen, CheckCircle2, Circle, Plus, Pencil, Trash2, Loader2, Check, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { PROJECT_CATEGORY_LABELS, type ProjectCategory, type ProjectStatus } from "@/types/database";
import { toggleEventComplete, createEvent, updateEventTitle, deleteEvent, saveProjectView, updateProjectStatus } from "./actions";

interface Project {
  id: string;
  code: string;
  category: ProjectCategory;
  name: string;
  status: string;
  is_urgent: boolean;
  is_on_hold: boolean;
  manager_id: string | null;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  location_detail: string | null;
  notes: string | null;
  main_folder_path: string | null;
}

interface CalendarEvent {
  id: string;
  title: string;
  is_completed: boolean;
  start_date: string | null;
  sort_order: number;
}

interface MobileProjectDetailProps {
  project: Project;
  events: CalendarEvent[];
  customerName: string | null;
  employeeMap: Record<string, string>;
}

export function MobileProjectDetail({
  project,
  events,
  customerName,
  employeeMap,
}: MobileProjectDetailProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [localEvents, setLocalEvents] = useState(events);

  // スケジュール編集用state
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [eventTitle, setEventTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ステータス変更用state
  const [currentStatus, setCurrentStatus] = useState<ProjectStatus>(project.status as ProjectStatus);
  const [isStatusChanging, setIsStatusChanging] = useState(false);

  // 閲覧履歴をDBに保存
  useEffect(() => {
    saveProjectView(project.id);
  }, [project.id]);

  const managerName = project.manager_id ? employeeMap[project.manager_id] : null;
  const location = [project.location, project.location_detail].filter(Boolean).join(" ");
  const categoryLabel = PROJECT_CATEGORY_LABELS[project.category] || project.category;

  // 日付あり（古い順）と日時未定に分ける
  const datedEvents = localEvents
    .filter((e) => e.start_date !== null)
    .sort((a, b) => {
      if (a.start_date && b.start_date) {
        return a.start_date.localeCompare(b.start_date);
      }
      return 0;
    });
  const undatedEvents = localEvents.filter((e) => e.start_date === null);

  const completedCount = localEvents.filter((e) => e.is_completed).length;
  const totalCount = localEvents.length;

  const handleEventToggle = async (eventId: string, currentState: boolean) => {
    // 楽観的更新
    setLocalEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, is_completed: !currentState } : e))
    );

    startTransition(async () => {
      const result = await toggleEventComplete(eventId, !currentState);
      if (result.error) {
        // エラー時は元に戻す
        setLocalEvents((prev) =>
          prev.map((e) => (e.id === eventId ? { ...e, is_completed: currentState } : e))
        );
      }
    });
  };

  const handleAddEvent = () => {
    setEditingEvent(null);
    setEventTitle("");
    setShowEventForm(true);
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event);
    setEventTitle(event.title);
    setShowEventForm(true);
  };

  const handleSaveEvent = async () => {
    if (!eventTitle.trim()) return;

    setIsSaving(true);
    try {
      if (editingEvent) {
        // 更新
        const result = await updateEventTitle(editingEvent.id, eventTitle);
        if (!result.error) {
          setLocalEvents((prev) =>
            prev.map((e) => (e.id === editingEvent.id ? { ...e, title: eventTitle.trim() } : e))
          );
          setShowEventForm(false);
        }
      } else {
        // 新規作成（日時未定として作成）
        const result = await createEvent(project.id, eventTitle, true);
        if (result.event) {
          setLocalEvents((prev) => [...prev, result.event!]);
          setShowEventForm(false);
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!editingEvent) return;
    if (!confirm("このスケジュールを削除しますか？")) return;

    setIsDeleting(true);
    try {
      const result = await deleteEvent(editingEvent.id);
      if (!result.error) {
        setLocalEvents((prev) => prev.filter((e) => e.id !== editingEvent.id));
        setShowEventForm(false);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // ステータス変更
  const handleStatusChange = async (newStatus: ProjectStatus) => {
    if (newStatus === currentStatus || isStatusChanging) return;

    setIsStatusChanging(true);
    const oldStatus = currentStatus;
    setCurrentStatus(newStatus); // 楽観的更新

    try {
      const result = await updateProjectStatus(project.id, newStatus);
      if (result.error) {
        setCurrentStatus(oldStatus); // エラー時は元に戻す
        alert("ステータスの更新に失敗しました");
      }
    } finally {
      setIsStatusChanging(false);
    }
  };

  // 日付フォーマット
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // イベント行のレンダリング
  const renderEventItem = (event: CalendarEvent) => (
    <div
      key={event.id}
      className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
        event.is_completed
          ? "bg-muted/50 border-muted"
          : "bg-background border-border"
      }`}
    >
      <button
        onClick={() => handleEventToggle(event.id, event.is_completed)}
        disabled={isPending}
        className="flex-shrink-0"
      >
        {event.is_completed ? (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground" />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <span
          className={`text-sm block ${
            event.is_completed ? "line-through text-muted-foreground" : ""
          }`}
        >
          {event.title}
        </span>
        {event.start_date && (
          <span className="text-xs text-muted-foreground">
            {formatDate(event.start_date)}
          </span>
        )}
      </div>
      <button
        onClick={() => handleEditEvent(event)}
        className="p-1.5 rounded-md hover:bg-muted transition-colors flex-shrink-0"
      >
        <Pencil className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* ヘッダー */}
      <header className="sticky top-0 bg-background border-b z-10 px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground font-mono">{project.code}</p>
            <h1 className="text-base font-bold truncate">{project.name}</h1>
          </div>
          {/* ステータス変更ボタン */}
          <Button
            variant={currentStatus === "完了" ? "default" : "outline"}
            size="sm"
            onClick={() => handleStatusChange(currentStatus === "進行中" ? "完了" : "進行中")}
            disabled={isStatusChanging}
            className={currentStatus === "完了" ? "bg-green-600 hover:bg-green-700" : ""}
          >
            {isStatusChanging ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : currentStatus === "完了" ? (
              <>
                <Check className="h-4 w-4 mr-1" />
                完了
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-1" />
                進行中
              </>
            )}
          </Button>
        </div>
      </header>

      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto">
        {/* 基本情報 */}
        <div className="px-4 py-4 border-b space-y-3">
          {/* バッジ */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{categoryLabel}</Badge>
            {project.is_urgent && (
              <Badge variant="destructive">重要</Badge>
            )}
            {project.is_on_hold && (
              <Badge variant="secondary">待機中</Badge>
            )}
          </div>

          {/* 顧客 */}
          {customerName && (
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{customerName}</span>
            </div>
          )}

          {/* 場所 */}
          {location && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{location}</span>
            </div>
          )}

          {/* 担当者 */}
          {managerName && (
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>担当: {managerName}</span>
            </div>
          )}

          {/* 期間 */}
          {(project.start_date || project.end_date) && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>
                {project.start_date || "---"} ~ {project.end_date || "---"}
              </span>
            </div>
          )}

          {/* Dropboxフォルダ */}
          {project.main_folder_path && (
            <div className="flex items-center gap-2 text-sm">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground truncate text-xs">
                {project.main_folder_path}
              </span>
            </div>
          )}

          {/* 備考 */}
          {project.notes && (
            <div className="mt-2 p-3 bg-muted/50 rounded-lg">
              <p className="text-sm whitespace-pre-wrap">{project.notes}</p>
            </div>
          )}
        </div>

        {/* スケジュール一覧 */}
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold">スケジュール</h2>
            <div className="flex items-center gap-2">
              {totalCount > 0 && (
                <span className="text-sm text-muted-foreground">
                  {completedCount}/{totalCount}
                </span>
              )}
              <Button size="sm" variant="outline" onClick={handleAddEvent}>
                <Plus className="h-4 w-4 mr-1" />
                追加
              </Button>
            </div>
          </div>

          {localEvents.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground mb-4">
                スケジュールがありません
              </p>
              <Button variant="outline" onClick={handleAddEvent}>
                <Plus className="h-4 w-4 mr-1" />
                追加
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 日付ありのイベント（古い順） */}
              {datedEvents.length > 0 && (
                <div className="space-y-2">
                  {datedEvents.map(renderEventItem)}
                </div>
              )}

              {/* 日時未定のイベント */}
              {undatedEvents.length > 0 && (
                <div className="space-y-2">
                  {datedEvents.length > 0 && (
                    <div className="text-xs text-muted-foreground pt-2 border-t">
                      日時未定
                    </div>
                  )}
                  {undatedEvents.map(renderEventItem)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* スケジュール追加・編集シート */}
      <Sheet open={showEventForm} onOpenChange={setShowEventForm}>
        <SheetContent side="bottom" className="rounded-t-xl">
          <SheetHeader className="pb-4">
            <SheetTitle>
              {editingEvent ? "スケジュールを編集" : "スケジュールを追加"}
            </SheetTitle>
          </SheetHeader>

          <div className="py-4">
            <Input
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              placeholder="タイトル"
              className="h-12"
              autoFocus
            />
          </div>

          <SheetFooter className="flex gap-2">
            {editingEvent && (
              <Button
                variant="destructive"
                onClick={handleDeleteEvent}
                disabled={isDeleting || isSaving}
                className="flex-1"
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
                削除
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setShowEventForm(false)}
              className="flex-1"
            >
              キャンセル
            </Button>
            <Button
              onClick={handleSaveEvent}
              disabled={isSaving || !eventTitle.trim()}
              className="flex-1"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "保存"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
