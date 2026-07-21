"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bell, Clock, MapPin } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { getUpcomingNotifications } from "@/app/calendar/actions";
import type { CalendarEventWithParticipants } from "@/types/database";

// 通知済みイベントIDの保存キー（{ [id]: expiryUnixMs }）
const NOTIFIED_STORAGE_KEY = "miero-event-notified-v1";

// チェック間隔（ミリ秒）
const CHECK_INTERVAL_MS = 30 * 1000;

// 通知タイミングを何ミリ秒過ぎたら諦めるか（イベント開始5分後まで）
const NOTIFICATION_GRACE_MS = 5 * 60 * 1000;

function loadNotifiedIds(): Map<string, number> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = localStorage.getItem(NOTIFIED_STORAGE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as Record<string, number>;
    const now = Date.now();
    const valid = new Map<string, number>();
    for (const [id, expiry] of Object.entries(parsed)) {
      if (typeof expiry === "number" && expiry > now) valid.set(id, expiry);
    }
    // 期限切れを掃除して保存し直す
    saveNotifiedIds(valid);
    return valid;
  } catch {
    return new Map();
  }
}

function saveNotifiedIds(ids: Map<string, number>) {
  if (typeof window === "undefined") return;
  try {
    const obj: Record<string, number> = {};
    ids.forEach((expiry, id) => {
      obj[id] = expiry;
    });
    localStorage.setItem(NOTIFIED_STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // ignore
  }
}

function markNotified(ids: Map<string, number>, eventId: string, eventStartDate: string) {
  // イベント開始日+2日で有効期限（同じ通知を繰り返さない）
  const expiry = new Date(eventStartDate).getTime() + 2 * 24 * 60 * 60 * 1000;
  ids.set(eventId, expiry);
  saveNotifiedIds(ids);
}

// Web Audio API でビープ音を鳴らす（3音のチャイム）
function playBeep() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const master = ctx.createGain();
    master.gain.value = 0.25;
    master.connect(ctx.destination);

    const notes: { freq: number; start: number; duration: number }[] = [
      { freq: 880, start: 0, duration: 0.18 },
      { freq: 880, start: 0.25, duration: 0.18 },
      { freq: 1175, start: 0.5, duration: 0.4 },
    ];

    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = n.freq;
      // 軽くフェードアウトさせて耳障りを抑える
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + n.start);
      gain.gain.exponentialRampToValueAtTime(1, ctx.currentTime + n.start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + n.start + n.duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start(ctx.currentTime + n.start);
      osc.stop(ctx.currentTime + n.start + n.duration + 0.05);
    }

    // 少し余裕を持って閉じる
    setTimeout(() => ctx.close().catch(() => {}), 1500);
  } catch (e) {
    console.warn("Failed to play notification sound", e);
  }
}

export function EventNotificationProvider() {
  const [queue, setQueue] = useState<CalendarEventWithParticipants[]>([]);
  const notifiedIdsRef = useRef<Map<string, number>>(new Map());
  const startedRef = useRef(false);

  const enqueueEvent = useCallback((event: CalendarEventWithParticipants) => {
    setQueue((prev) => {
      if (prev.some((e) => e.id === event.id)) return prev;
      return [...prev, event];
    });
  }, []);

  const runCheck = useCallback(async () => {
    try {
      const events = await getUpcomingNotifications();
      const now = Date.now();
      for (const event of events) {
        if (!event.start_time || event.notify_minutes_before === null) continue;
        if (notifiedIdsRef.current.has(event.id)) continue;

        const eventStartMs = new Date(`${event.start_date}T${event.start_time}`).getTime();
        if (isNaN(eventStartMs)) continue;

        const notifyAtMs = eventStartMs - event.notify_minutes_before * 60 * 1000;

        // 通知タイミングに到達しているが、イベント開始から5分以内
        if (now >= notifyAtMs && now < eventStartMs + NOTIFICATION_GRACE_MS) {
          markNotified(notifiedIdsRef.current, event.id, event.start_date);
          enqueueEvent(event);
          playBeep();
        }
      }
    } catch (e) {
      console.error("Notification check failed:", e);
    }
  }, [enqueueEvent]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    notifiedIdsRef.current = loadNotifiedIds();
    runCheck();
    const timer = setInterval(runCheck, CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [runCheck]);

  const currentEvent = queue[0] || null;

  const closeCurrent = () => {
    setQueue((prev) => prev.slice(1));
  };

  if (!currentEvent) return null;

  const eventStart = currentEvent.start_time
    ? parseISO(`${currentEvent.start_date}T${currentEvent.start_time}`)
    : parseISO(currentEvent.start_date);
  const endTimeStr = currentEvent.end_time ? currentEvent.end_time.slice(0, 5) : null;
  const minutes = currentEvent.notify_minutes_before ?? 0;
  const headline =
    minutes === 0
      ? "予定の開始時刻です"
      : minutes >= 1440
      ? `${Math.round(minutes / 1440)}日前のお知らせ`
      : minutes >= 60
      ? `${Math.round(minutes / 60)}時間前のお知らせ`
      : `${minutes}分前のお知らせ`;

  return (
    <Dialog open={!!currentEvent} onOpenChange={(open) => !open && closeCurrent()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <Bell className="h-5 w-5 animate-pulse" />
            {headline}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-lg font-semibold">{currentEvent.title}</div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            {format(eventStart, "M月d日(E) HH:mm", { locale: ja })}
            {endTimeStr && ` - ${endTimeStr}`}
          </div>
          {currentEvent.location && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              {currentEvent.location}
            </div>
          )}
          {currentEvent.description && (
            <div className="text-sm whitespace-pre-wrap border-t pt-3 max-h-40 overflow-y-auto">
              {currentEvent.description}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={closeCurrent}>確認</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
