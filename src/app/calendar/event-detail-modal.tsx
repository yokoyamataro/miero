"use client";

import { useState } from "react";
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
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import {
  type CalendarEventWithParticipants,
  EVENT_CATEGORY_COLORS,
} from "@/types/database";
import { deleteEvent } from "./actions";

interface EventDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEventWithParticipants | null;
  onEdit: (event: CalendarEventWithParticipants) => void;
  onDeleted: () => void;
}

export function EventDetailModal({
  open,
  onOpenChange,
  event,
  onEdit,
  onDeleted,
}: EventDetailModalProps) {
  const [loading, setLoading] = useState(false);

  if (!event) return null;

  const handleDelete = async () => {
    if (!confirm("この予定を削除しますか？")) return;

    setLoading(true);
    const result = await deleteEvent(event.id);
    setLoading(false);

    if (result.error) {
      alert(result.error);
      return;
    }

    onDeleted();
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

  const categoryColor = EVENT_CATEGORY_COLORS[event.category];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className={`w-4 h-4 rounded mt-1 ${categoryColor}`} />
            <div className="flex-1">
              <DialogTitle className="text-xl">{event.title}</DialogTitle>
              <Badge variant="secondary" className="mt-1">
                {event.category}
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
