"use client";

import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Clock, MapPin, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { type CalendarEventWithParticipants, type EventCategory } from "@/types/database";

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
}: MobileEventSheetProps) {
  if (!date) return null;

  const employeeMap = new Map(employees.map((e) => [e.id, e.name]));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-xl">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="text-left">
            {format(date, "M月d日（E）", { locale: ja })}
          </SheetTitle>
        </SheetHeader>

        <div className="py-4 overflow-y-auto h-full">
          {events.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              予定がありません
            </p>
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
                    className="bg-muted/50 rounded-lg p-4 space-y-2"
                  >
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
  );
}
