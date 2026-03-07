"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
  Clock,
  MapPin,
  Users,
  Edit,
  Trash2,
  ExternalLink,
  FileText,
  Briefcase,
  Repeat,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import {
  type CalendarEventWithParticipants,
  EVENT_CATEGORY_COLORS,
  type EventCategoryLegacy,
  RECURRENCE_TYPE_LABELS,
  DAY_OF_WEEK_LABELS,
} from "@/types/database";
import { deleteEvent, deleteRecurringEventsAll, deleteRecurringEventsFromDate } from "./actions";

interface EventDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEventWithParticipants | null;
  onEdit: (event: CalendarEventWithParticipants) => void;
  onDeleted: (eventId: string) => void;
}

export function EventDetailModal({
  open,
  onOpenChange,
  event,
  onEdit,
  onDeleted,
}: EventDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [showDeleteOptions, setShowDeleteOptions] = useState(false);

  if (!event) return null;

  const isRecurring = event.recurrence_group_id && event.recurrence_type && event.recurrence_type !== "none";

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

  // この予定だけを削除
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

  // すべての繰り返し予定を削除
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

  // この日以降の繰り返し予定を削除
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

  // 区分の色と名前を取得
  const getCategoryInfo = () => {
    if (event.eventCategory) {
      return {
        color: event.eventCategory.color,
        name: event.eventCategory.name,
      };
    }
    // 旧カテゴリーから取得（後方互換）
    if (event.category && EVENT_CATEGORY_COLORS[event.category as EventCategoryLegacy]) {
      return {
        color: EVENT_CATEGORY_COLORS[event.category as EventCategoryLegacy],
        name: event.category,
      };
    }
    return { color: "bg-gray-500", name: "未設定" };
  };

  const categoryInfo = getCategoryInfo();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className={`w-4 h-4 rounded mt-1 ${categoryInfo.color}`} />
            <div className="flex-1">
              <DialogTitle className="text-xl">{event.title}</DialogTitle>
              <Badge variant="secondary" className="mt-1">
                {categoryInfo.name}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* 日時 */}
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>{formatDateRange()}</div>
          </div>

          {/* 繰り返し情報 */}
          {isRecurring && (
            <div className="flex items-start gap-3">
              <Repeat className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>{getRecurrenceInfo()}</div>
            </div>
          )}

          {/* 参加者 */}
          {event.participants.length > 0 && (
            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                {event.participants.map((p) => p.name).join("、")}
              </div>
            </div>
          )}

          {/* 場所 */}
          {event.location && (
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>{event.location}</div>
            </div>
          )}

          {/* Google Map リンク */}
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
                {event.task && (
                  <div className="text-sm text-muted-foreground mt-1">
                    タスク: {event.task.title}
                  </div>
                )}
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

          {/* 作成者 */}
          {event.creator && (
            <div className="text-sm text-muted-foreground border-t pt-3">
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

        <DialogFooter className="flex justify-between">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={loading}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            削除
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              閉じる
            </Button>
            <Button onClick={() => onEdit(event)}>
              <Edit className="h-4 w-4 mr-1" />
              編集
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
