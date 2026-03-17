"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Clock, MapPin, Users, Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { type CalendarEventWithParticipants, type EventCategory } from "@/types/database";
import { MobileEventFormSheet } from "./mobile-event-form-sheet";

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
                        <h3 className="font-medium text-base">{event.title}</h3>
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
