"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Plus,
  MapPin,
  Clock,
  Users,
  User,
  UsersRound,
  Settings,
  GripVertical,
  CheckCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
  addDays,
  subDays,
  parseISO,
} from "date-fns";
import { ja } from "date-fns/locale";
import {
  type CalendarEventWithParticipants,
  type Employee,
  type EventCategory,
  EVENT_CATEGORY_COLORS,
  type EventCategoryLegacy,
} from "@/types/database";
import { EventModal } from "./calendar/event-modal";
import { EventDetailModal } from "./calendar/event-detail-modal";
import { updateEvent } from "./calendar/actions";

type ViewMode = "day" | "dayAll" | "fiveDay" | "fiveDayAll" | "month";
type EmployeeFilter = "me" | "all" | string; // "me" = 自分のみ, "all" = 全員, string = 特定の社員ID

interface DashboardCalendarProps {
  initialEvents: CalendarEventWithParticipants[];
  employees: Employee[];
  eventCategories: EventCategory[];
  initialView: ViewMode;
  initialDate: string;
  currentEmployeeId: string | null;
  onDropProject: (
    date: Date,
    projectData: DroppedProjectData,
    startTime?: { hour: string; minute: string },
    endTime?: { hour: string; minute: string },
    targetEmployeeId?: string
  ) => void;
}

export interface DroppedProjectData {
  projectId: string;
  projectCode: string;
  projectName: string;
  projectLocation: string | null;
}

const WEEKDAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

export function DashboardCalendar({
  initialEvents,
  employees,
  eventCategories,
  initialView,
  initialDate,
  currentEmployeeId,
  onDropProject,
}: DashboardCalendarProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(initialView);
  const [currentDate, setCurrentDate] = useState(() => new Date()); // 常に今日で初期化
  const [events, setEvents] = useState(initialEvents);

  // マウント時に今日の日付を設定（ホームに戻った時、ログイン後に本日を表示）
  useEffect(() => {
    setCurrentDate(new Date());
  }, []);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventWithParticipants | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<{ date: string; hour: number } | null>(null);
  const [resizingEvent, setResizingEvent] = useState<{
    eventId: string;
    edge: "top" | "bottom";
    startY: number;
    originalTop: number;
    originalHeight: number;
    date: Date;
    previewTop: number;
    previewHeight: number;
  } | null>(null);
  const [justFinishedResizing, setJustFinishedResizing] = useState(false);
  const [hideWeekends, setHideWeekends] = useState(false);
  const [selectedStartTime, setSelectedStartTime] = useState<{ hour: string; minute: string } | null>(null);
  const [selectedEndTime, setSelectedEndTime] = useState<{ hour: string; minute: string } | null>(null);
  const [employeeFilter, setEmployeeFilter] = useState<EmployeeFilter>("me");
  const [showEmployeeOrderModal, setShowEmployeeOrderModal] = useState(false);
  const [employeeOrder, setEmployeeOrder] = useState<string[]>([]);
  const [draggingEmployeeId, setDraggingEmployeeId] = useState<string | null>(null);

  // localStorageから社員順序を読み込み
  useEffect(() => {
    const saved = localStorage.getItem("calendarEmployeeOrder");
    if (saved) {
      try {
        setEmployeeOrder(JSON.parse(saved));
      } catch {
        // パースエラーの場合は無視
      }
    }
  }, []);

  // 社員リストをソート（カスタム順序を優先）
  const sortedEmployees = useMemo(() => {
    if (employeeOrder.length === 0) {
      // デフォルト: 自分を先頭に
      if (!currentEmployeeId) return employees;
      return [...employees].sort((a, b) => {
        if (a.id === currentEmployeeId) return -1;
        if (b.id === currentEmployeeId) return 1;
        return 0;
      });
    }
    // カスタム順序で並び替え
    return [...employees].sort((a, b) => {
      const indexA = employeeOrder.indexOf(a.id);
      const indexB = employeeOrder.indexOf(b.id);
      // 順序に含まれない社員は末尾に
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [employees, currentEmployeeId, employeeOrder]);

  // 社員順序を保存
  const saveEmployeeOrder = useCallback((order: string[]) => {
    setEmployeeOrder(order);
    localStorage.setItem("calendarEmployeeOrder", JSON.stringify(order));
  }, []);

  // 社員をドラッグ開始
  const handleEmployeeOrderDragStart = useCallback((employeeId: string) => {
    setDraggingEmployeeId(employeeId);
  }, []);

  // 社員をドロップ
  const handleEmployeeOrderDrop = useCallback((targetEmployeeId: string) => {
    if (!draggingEmployeeId || draggingEmployeeId === targetEmployeeId) {
      setDraggingEmployeeId(null);
      return;
    }

    const currentOrder = employeeOrder.length > 0
      ? [...employeeOrder]
      : sortedEmployees.map(e => e.id);

    const dragIndex = currentOrder.indexOf(draggingEmployeeId);
    const dropIndex = currentOrder.indexOf(targetEmployeeId);

    if (dragIndex === -1 || dropIndex === -1) {
      setDraggingEmployeeId(null);
      return;
    }

    // 並び替え
    currentOrder.splice(dragIndex, 1);
    currentOrder.splice(dropIndex, 0, draggingEmployeeId);

    saveEmployeeOrder(currentOrder);
    setDraggingEmployeeId(null);
  }, [draggingEmployeeId, employeeOrder, sortedEmployees, saveEmployeeOrder]);

  // 順序をリセット
  const resetEmployeeOrder = useCallback(() => {
    setEmployeeOrder([]);
    localStorage.removeItem("calendarEmployeeOrder");
  }, []);

  // フィルタリングされたイベント
  const filteredEvents = useMemo(() => {
    if (employeeFilter === "all") {
      return events;
    }

    const targetEmployeeId = employeeFilter === "me" ? currentEmployeeId : employeeFilter;
    if (!targetEmployeeId) return events;

    return events.filter((event) => {
      // 作成者が対象社員
      if (event.created_by === targetEmployeeId) return true;
      // 参加者に対象社員が含まれる
      if (event.participants.some((p) => p.id === targetEmployeeId)) return true;
      return false;
    });
  }, [events, employeeFilter, currentEmployeeId]);

  // 月表示のカレンダー日付を生成
  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentDate]);

  // 5日表示の日付を生成（土日非表示オプション対応）
  const fiveDays = useMemo(() => {
    if (hideWeekends) {
      // 土日を除いて5日間を生成
      const days: Date[] = [];
      let current = currentDate;
      while (days.length < 5) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          days.push(current);
        }
        current = addDays(current, 1);
      }
      return days;
    }
    return eachDayOfInterval({ start: currentDate, end: addDays(currentDate, 4) });
  }, [currentDate, hideWeekends]);

  // 日付が範囲内かどうかをチェック（時刻を無視して日付のみで比較）
  const isDateInRange = (date: Date, startDateStr: string, endDateStr: string | null) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const endStr = endDateStr || startDateStr;
    return dateStr >= startDateStr && dateStr <= endStr;
  };

  // 日付ごとのイベントを取得
  const getEventsForDate = (date: Date) => {
    return filteredEvents.filter((event) => {
      return isDateInRange(date, event.start_date, event.end_date);
    });
  };

  // 全員表示用：日付×社員ごとのイベントを取得（フィルター無視、参加者のみで判定）
  const getAllEventsForDateAndEmployee = (date: Date, employeeId: string) => {
    return events.filter((event) => {
      if (!isDateInRange(date, event.start_date, event.end_date)) return false;
      return event.participants.some((p) => p.id === employeeId);
    });
  };

  // 5日表示用：フィルター対象の社員のイベントを取得（参加者のみで判定）
  const getFilteredEventsForDate = (date: Date) => {
    const targetEmployeeId = employeeFilter === "me" ? currentEmployeeId : employeeFilter === "all" ? null : employeeFilter;
    if (!targetEmployeeId) {
      // "all"の場合は全イベント
      return filteredEvents.filter((event) => isDateInRange(date, event.start_date, event.end_date));
    }
    return filteredEvents.filter((event) => {
      if (!isDateInRange(date, event.start_date, event.end_date)) return false;
      return event.participants.some((p) => p.id === targetEmployeeId);
    });
  };

  // ナビゲーション
  const navigatePrev = () => {
    switch (viewMode) {
      case "month":
        setCurrentDate(subMonths(currentDate, 1));
        break;
      case "fiveDay":
      case "fiveDayAll":
        setCurrentDate(subDays(currentDate, 5));
        break;
      case "day":
      case "dayAll":
        setCurrentDate(subDays(currentDate, 1));
        break;
    }
  };

  const navigateNext = () => {
    switch (viewMode) {
      case "month":
        setCurrentDate(addMonths(currentDate, 1));
        break;
      case "fiveDay":
      case "fiveDayAll":
        setCurrentDate(addDays(currentDate, 5));
        break;
      case "day":
      case "dayAll":
        setCurrentDate(addDays(currentDate, 1));
        break;
    }
  };

  const navigateToday = () => {
    setCurrentDate(new Date());
  };

  // 日付クリックでイベント作成
  const handleDateClick = (date: Date, startTime?: { hour: string; minute: string }, endTime?: { hour: string; minute: string }) => {
    setSelectedDate(date);
    setSelectedEvent(null);
    setSelectedStartTime(startTime || null);
    setSelectedEndTime(endTime || null);
    setShowEventModal(true);
  };

  // 時間枠クリックで時刻付きイベント作成
  const handleTimeSlotClick = (date: Date, hour: number) => {
    let startHour: string;
    let startMinute = "00";
    let endHour: string;
    let endMinute = "30";

    if (hour === -1) {
      // ～8:00枠
      startHour = "07";
      endHour = "07";
    } else if (hour === 18) {
      // 18:00～枠
      startHour = "18";
      endHour = "18";
    } else {
      startHour = String(hour).padStart(2, "0");
      // 30分後を終了時刻に
      if (hour === 23) {
        endHour = "23";
        endMinute = "30";
      } else {
        endHour = String(hour).padStart(2, "0");
      }
    }

    handleDateClick(
      date,
      { hour: startHour, minute: startMinute },
      { hour: endHour, minute: endMinute }
    );
  };

  // イベントクリックで詳細表示（リサイズ直後は無視）
  const handleEventClick = (event: CalendarEventWithParticipants, e: React.MouseEvent) => {
    e.stopPropagation();
    if (justFinishedResizing) return;
    setSelectedEvent(event);
    setShowDetailModal(true);
  };

  // イベント編集
  const handleEditEvent = (event: CalendarEventWithParticipants) => {
    setShowDetailModal(false);
    setSelectedEvent(event);
    setSelectedDate(parseISO(event.start_date));
    setShowEventModal(true);
  };

  // イベント更新後（楽観的UI更新）
  const handleEventSaved = useCallback((savedEvent: CalendarEventWithParticipants | CalendarEventWithParticipants[], isNew: boolean) => {
    setShowEventModal(false);
    setShowDetailModal(false);
    if (isNew) {
      // 新規イベントを追加（配列の場合は複数追加）
      if (Array.isArray(savedEvent)) {
        setEvents((prev) => [...prev, ...savedEvent]);
      } else {
        setEvents((prev) => [...prev, savedEvent]);
      }
    } else {
      // 既存イベントを更新（配列は想定しない）
      if (!Array.isArray(savedEvent)) {
        setEvents((prev) =>
          prev.map((e) => (e.id === savedEvent.id ? savedEvent : e))
        );
      }
    }
  }, []);

  // イベント削除後（楽観的UI更新）
  const handleEventDeleted = useCallback((deletedEventId: string) => {
    setShowDetailModal(false);
    setEvents((prev) => prev.filter((e) => e.id !== deletedEventId));
  }, []);

  // iPod風のカリカリ音を鳴らす（クリック音）
  const playClickSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // 短いクリック音（iPodホイール風）
      oscillator.frequency.value = 1200;
      oscillator.type = "square";
      gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.03);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.03);
    } catch (err) {
      // 音声再生に失敗しても続行
    }
  }, []);

  // 前回のドラッグオーバー位置を追跡
  const lastDragOverSlotRef = useRef<{ date: string; hour: number } | null>(null);

  // ドロップハンドラー
  const handleDrop = useCallback(
    (date: Date, e: React.DragEvent, targetEmployeeId?: string) => {
      e.preventDefault();
      setDragOverDate(null);
      lastDragOverSlotRef.current = null;

      try {
        const data = e.dataTransfer.getData("text/plain");
        if (data) {
          const projectData = JSON.parse(data) as DroppedProjectData;
          onDropProject(date, projectData, undefined, undefined, targetEmployeeId);
        }
      } catch (err) {
        console.error("Drop error:", err);
      }
    },
    [onDropProject]
  );

  const handleDragOver = useCallback((date: Date, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverDate(format(date, "yyyy-MM-dd"));
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverDate(null);
  }, []);

  // イベントのドラッグ開始
  const handleEventDragStart = useCallback((event: CalendarEventWithParticipants, e: React.DragEvent) => {
    e.stopPropagation();
    setDraggingEventId(event.id);
    e.dataTransfer.setData("application/event-id", event.id);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  // イベントのドラッグ終了
  const handleEventDragEnd = useCallback(() => {
    setDraggingEventId(null);
    setDragOverSlot(null);
    lastDragOverSlotRef.current = null;
  }, []);

  // 時間枠へのドロップ（イベント移動 or 業務ドロップ）
  const handleTimeSlotDrop = useCallback(async (date: Date, hour: number, e: React.DragEvent, targetEmployeeId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverSlot(null);
    setDragOverDate(null);
    lastDragOverSlotRef.current = null;

    // まず業務のドロップをチェック
    const projectDataStr = e.dataTransfer.getData("text/plain");
    if (projectDataStr) {
      try {
        const parsed = JSON.parse(projectDataStr) as DroppedProjectData;
        if (parsed.projectId) {
          // 業務がドロップされた - 時刻付きで予定作成
          let startHour: string;
          let startMinute = "00";
          let endHour: string;
          let endMinute = "30";

          if (hour === -1) {
            startHour = "07";
            endHour = "07";
          } else if (hour === 18) {
            startHour = "18";
            endHour = "18";
          } else {
            startHour = String(hour).padStart(2, "0");
            endHour = String(hour).padStart(2, "0");
          }

          // 時刻情報付きで親コンポーネントに通知（ドロップ先社員IDも渡す）
          onDropProject(
            date,
            parsed,
            { hour: startHour, minute: startMinute },
            { hour: endHour, minute: endMinute },
            targetEmployeeId
          );
          return;
        }
      } catch {
        // JSONパースに失敗した場合は続行
      }
    }

    // イベントの移動処理
    const eventId = e.dataTransfer.getData("application/event-id");
    if (!eventId) return;

    const event = events.find((ev) => ev.id === eventId);
    if (!event) return;

    // 新しい開始時刻を計算
    let newStartTime: string;
    if (hour === -1) {
      // ～8:00枠
      newStartTime = "07:00:00";
    } else if (hour === 18) {
      // 18:00～枠
      newStartTime = "18:00:00";
    } else {
      newStartTime = `${String(hour).padStart(2, "0")}:00:00`;
    }

    // イベントの長さを保持
    let newEndTime: string | null = null;
    if (event.start_time && event.end_time) {
      const [startH, startM] = event.start_time.split(":").map(Number);
      const [endH, endM] = event.end_time.split(":").map(Number);
      const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
      const [newH] = newStartTime.split(":").map(Number);
      const newEndMinutes = newH * 60 + durationMinutes;
      const endHour = Math.floor(newEndMinutes / 60);
      const endMin = newEndMinutes % 60;
      newEndTime = `${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}:00`;
    }

    // 楽観的UI更新：先にローカルstateを更新
    const updatedEvent = {
      ...event,
      start_date: format(date, "yyyy-MM-dd"),
      end_date: format(date, "yyyy-MM-dd"),
      start_time: newStartTime,
      end_time: newEndTime,
    };
    setEvents((prev) =>
      prev.map((e) => (e.id === eventId ? updatedEvent : e))
    );

    // バックグラウンドでDB更新
    const result = await updateEvent(
      eventId,
      {
        start_date: format(date, "yyyy-MM-dd"),
        end_date: format(date, "yyyy-MM-dd"),
        start_time: newStartTime,
        end_time: newEndTime,
      },
      event.participants.map((p) => p.id)
    );

    // エラー時はロールバック
    if (!result.success) {
      setEvents((prev) =>
        prev.map((e) => (e.id === eventId ? event : e))
      );
    }
  }, [events, onDropProject, playClickSound]);

  // 時間枠へのドラッグオーバー（イベント or タスク）
  const handleTimeSlotDragOver = useCallback((date: Date, hour: number, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const dateStr = format(date, "yyyy-MM-dd");
    const lastSlot = lastDragOverSlotRef.current;

    // 時間枠が変わったら音を鳴らす
    if (!lastSlot || lastSlot.date !== dateStr || lastSlot.hour !== hour) {
      playClickSound();
      lastDragOverSlotRef.current = { date: dateStr, hour };
    }

    // イベントまたはタスクのドラッグを受け入れる
    setDragOverSlot({ date: dateStr, hour });
  }, [playClickSound]);

  // イベントリサイズ開始
  const handleResizeStart = useCallback((
    event: CalendarEventWithParticipants,
    edge: "top" | "bottom",
    e: React.MouseEvent,
    date: Date,
    currentTop: number,
    currentHeight: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingEvent({
      eventId: event.id,
      edge,
      startY: e.clientY,
      originalTop: currentTop,
      originalHeight: currentHeight,
      date,
      previewTop: currentTop,
      previewHeight: currentHeight,
    });
  }, []);

  // イベントリサイズ中（グローバルマウスイベント）- プレビュー表示を更新
  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizingEvent) return;

    const deltaY = e.clientY - resizingEvent.startY;
    const deltaMinutes = Math.round(deltaY / 48 * 60 / 30) * 30; // 30分単位
    const deltaPx = (deltaMinutes / 60) * 48;

    let newTop = resizingEvent.originalTop;
    let newHeight = resizingEvent.originalHeight;

    if (resizingEvent.edge === "top") {
      newTop = resizingEvent.originalTop + deltaPx;
      newHeight = resizingEvent.originalHeight - deltaPx;
      // 最小30分（24px）を確保
      if (newHeight < 24) {
        newHeight = 24;
        newTop = resizingEvent.originalTop + resizingEvent.originalHeight - 24;
      }
      // 上限チェック
      if (newTop < 48) {
        newTop = 48;
        newHeight = resizingEvent.originalTop + resizingEvent.originalHeight - 48;
      }
    } else {
      newHeight = resizingEvent.originalHeight + deltaPx;
      // 最小30分（24px）を確保
      if (newHeight < 24) newHeight = 24;
    }

    setResizingEvent((prev) =>
      prev ? { ...prev, previewTop: newTop, previewHeight: newHeight } : null
    );
  }, [resizingEvent]);

  // イベントリサイズ終了
  const handleResizeEnd = useCallback(async (e: MouseEvent) => {
    if (!resizingEvent) return;

    const deltaY = e.clientY - resizingEvent.startY;
    const deltaMinutes = Math.round(deltaY / 48 * 60 / 30) * 30; // 30分単位

    const event = events.find((ev) => ev.id === resizingEvent.eventId);
    if (!event || !event.start_time) {
      setResizingEvent(null);
      return;
    }

    const [startH, startM] = event.start_time.split(":").map(Number);
    const [endH, endM] = (event.end_time || event.start_time).split(":").map(Number);

    let newStartMinutes = startH * 60 + startM;
    let newEndMinutes = endH * 60 + endM;

    if (resizingEvent.edge === "top") {
      newStartMinutes += deltaMinutes;
      if (newEndMinutes - newStartMinutes < 30) {
        newStartMinutes = newEndMinutes - 30;
      }
      if (newStartMinutes < 0) newStartMinutes = 0;
    } else {
      newEndMinutes += deltaMinutes;
      if (newEndMinutes - newStartMinutes < 30) {
        newEndMinutes = newStartMinutes + 30;
      }
      if (newEndMinutes > 24 * 60) newEndMinutes = 24 * 60;
    }

    const newStartTime = `${String(Math.floor(newStartMinutes / 60)).padStart(2, "0")}:${String(newStartMinutes % 60).padStart(2, "0")}:00`;
    const newEndTime = `${String(Math.floor(newEndMinutes / 60)).padStart(2, "0")}:${String(newEndMinutes % 60).padStart(2, "0")}:00`;

    setResizingEvent(null);
    // リサイズ直後のクリックイベントを防ぐためのフラグ
    setJustFinishedResizing(true);
    setTimeout(() => setJustFinishedResizing(false), 100);

    // 変更がない場合はスキップ
    if (newStartTime === event.start_time && newEndTime === event.end_time) {
      return;
    }

    // 楽観的UI更新：先にローカルstateを更新
    const updatedEvent = {
      ...event,
      start_time: newStartTime,
      end_time: newEndTime,
    };
    setEvents((prev) =>
      prev.map((e) => (e.id === event.id ? updatedEvent : e))
    );

    // バックグラウンドでDB更新
    const result = await updateEvent(
      event.id,
      {
        start_time: newStartTime,
        end_time: newEndTime,
      },
      event.participants.map((p) => p.id)
    );

    // エラー時はロールバック
    if (!result.success) {
      setEvents((prev) =>
        prev.map((e) => (e.id === event.id ? event : e))
      );
    }
  }, [resizingEvent, events]);

  // グローバルマウスイベントのリスナー登録
  useEffect(() => {
    if (resizingEvent) {
      window.addEventListener("mousemove", handleResizeMove);
      window.addEventListener("mouseup", handleResizeEnd);
      return () => {
        window.removeEventListener("mousemove", handleResizeMove);
        window.removeEventListener("mouseup", handleResizeEnd);
      };
    }
  }, [resizingEvent, handleResizeMove, handleResizeEnd]);

  // タイトル
  const getTitle = () => {
    switch (viewMode) {
      case "month":
        return format(currentDate, "yyyy年M月", { locale: ja });
      case "fiveDay":
      case "fiveDayAll": {
        const fiveDayEnd = addDays(currentDate, 4);
        return `${format(currentDate, "M月d日", { locale: ja })} - ${format(fiveDayEnd, "M月d日", { locale: ja })}`;
      }
      case "day":
      case "dayAll":
        return format(currentDate, "M月d日(E)", { locale: ja });
    }
  };

  // イベントの区分色を取得
  const getCategoryColor = (event: CalendarEventWithParticipants) => {
    if (event.eventCategory) {
      return event.eventCategory.color;
    }
    if (event.category && EVENT_CATEGORY_COLORS[event.category as EventCategoryLegacy]) {
      return EVENT_CATEGORY_COLORS[event.category as EventCategoryLegacy];
    }
    return "bg-gray-500";
  };

  // 濃い色から薄い背景色を取得
  const LIGHT_BG_MAP: Record<string, string> = {
    "bg-blue-500": "bg-blue-100",
    "bg-blue-300": "bg-blue-100",
    "bg-indigo-500": "bg-indigo-100",
    "bg-sky-500": "bg-sky-100",
    "bg-green-500": "bg-green-100",
    "bg-green-300": "bg-green-100",
    "bg-teal-500": "bg-teal-100",
    "bg-emerald-500": "bg-emerald-100",
    "bg-yellow-500": "bg-yellow-100",
    "bg-orange-500": "bg-orange-100",
    "bg-red-500": "bg-red-100",
    "bg-pink-500": "bg-pink-100",
    "bg-purple-500": "bg-purple-100",
    "bg-violet-500": "bg-violet-100",
    "bg-fuchsia-500": "bg-fuchsia-100",
    "bg-cyan-500": "bg-cyan-100",
    "bg-rose-500": "bg-rose-100",
    "bg-amber-500": "bg-amber-100",
    "bg-gray-500": "bg-gray-100",
    "bg-gray-400": "bg-gray-100",
    "bg-slate-500": "bg-slate-100",
    "bg-slate-400": "bg-slate-100",
  };
  const getLightBgColor = (categoryColor: string) => {
    return LIGHT_BG_MAP[categoryColor] || "bg-gray-100";
  };

  const getCategoryName = (event: CalendarEventWithParticipants) => {
    if (event.eventCategory) {
      return event.eventCategory.name;
    }
    if (event.category) {
      return event.category;
    }
    return "";
  };

  // イベントレンダリング
  const renderEvent = (event: CalendarEventWithParticipants, compact = false, hideParticipants = false) => {
    const categoryColor = getCategoryColor(event);
    const lightBgColor = getLightBgColor(categoryColor);
    const categoryName = getCategoryName(event);
    const timeStr = event.start_time ? event.start_time.slice(0, 5) : "";
    const isCompleted = event.is_completed;

    if (compact) {
      return (
        <div
          key={event.id}
          className={`text-xs truncate cursor-pointer hover:opacity-80 flex items-center gap-1 px-1 py-0.5 rounded ${lightBgColor}`}
          onClick={(e) => handleEventClick(event, e)}
          title={event.title}
        >
          {categoryName && (
            <span className={`${categoryColor} text-white px-1 rounded text-[10px] flex-shrink-0`}>{categoryName}</span>
          )}
          {isCompleted && (
            <CheckCircle className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
          )}
          <span className="text-black truncate">{timeStr && `${timeStr} `}{event.title}</span>
        </div>
      );
    }

    return (
      <div
        key={event.id}
        className={`border rounded cursor-pointer hover:opacity-80 mb-1 overflow-hidden ${lightBgColor}`}
        onClick={(e) => handleEventClick(event, e)}
      >
        {categoryName && (
          <div className={`${categoryColor} text-white text-xs font-medium px-2 py-0.5`}>{categoryName}</div>
        )}
        <div className="p-2">
          <div className="font-medium text-black">{event.title}</div>
          {event.start_time && (
            <div className="text-sm flex items-center gap-1 mt-1 text-black">
              <Clock className="h-3 w-3" />
              {event.start_time.slice(0, 5)}
              {event.end_time && ` - ${event.end_time.slice(0, 5)}`}
            </div>
          )}
          {event.location && (
            <div className="text-sm flex items-center gap-1 mt-1 text-black">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{event.location}</span>
            </div>
          )}
          {!hideParticipants && event.participants.length > 0 && (
            <div className="text-sm flex items-center gap-1 mt-1 text-black">
              <Users className="h-3 w-3" />
              {event.participants.map((p) => p.name).join(", ")}
            </div>
          )}
        </div>
      </div>
    );
  };

  // 月表示
  const renderMonthView = () => (
    <div className="grid grid-cols-7 gap-px bg-border">
      {WEEKDAY_LABELS.map((day, idx) => (
        <div
          key={day}
          className={`p-2 text-center text-sm font-medium bg-muted ${
            idx === 5 ? "text-blue-500" : idx === 6 ? "text-red-500" : ""
          }`}
        >
          {day}
        </div>
      ))}

      {monthDays.map((date, idx) => {
        const dayEvents = getEventsForDate(date);
        const isCurrentMonth = isSameMonth(date, currentDate);
        const dayOfWeek = date.getDay();
        const dateStr = format(date, "yyyy-MM-dd");
        const isDragOver = dragOverDate === dateStr;

        return (
          <div
            key={idx}
            className={`min-h-[80px] p-1 bg-background cursor-pointer hover:bg-muted/50 ${
              !isCurrentMonth ? "opacity-40" : ""
            } ${isDragOver ? "bg-blue-100 ring-2 ring-blue-400" : ""}`}
            onClick={() => handleDateClick(date)}
            onDrop={(e) => handleDrop(date, e)}
            onDragOver={(e) => handleDragOver(date, e)}
            onDragLeave={handleDragLeave}
          >
            <div
              className={`text-sm mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                isToday(date)
                  ? "bg-primary text-primary-foreground"
                  : dayOfWeek === 0
                  ? "text-red-500"
                  : dayOfWeek === 6
                  ? "text-blue-500"
                  : ""
              }`}
            >
              {format(date, "d")}
            </div>
            <div className="space-y-0.5">
              {dayEvents.slice(0, 2).map((event) => renderEvent(event, true))}
              {dayEvents.length > 2 && (
                <div className="text-xs text-muted-foreground">
                  +{dayEvents.length - 2}件
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // 週表示
  // 5日全員表示（縦軸=社員、横軸=5日間）
  const renderFiveDayAllView = () => {
    // 5日分の日付（土日非表示オプション対応）
    const displayDays = hideWeekends
      ? (() => {
          const days: Date[] = [];
          let current = currentDate;
          while (days.length < 5) {
            const dayOfWeek = current.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
              days.push(current);
            }
            current = addDays(current, 1);
          }
          return days;
        })()
      : eachDayOfInterval({ start: currentDate, end: addDays(currentDate, 4) });

    return (
      <div className="overflow-auto">
        <table className="w-full border-collapse table-fixed">
          <colgroup>
            <col className="w-[100px]" />
            {displayDays.map((_, idx) => (
              <col key={idx} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="p-2 bg-muted border text-left sticky left-0 z-10">
                社員
              </th>
              {displayDays.map((date, idx) => {
                const dayOfWeek = date.getDay();
                return (
                  <th
                    key={idx}
                    className={`p-2 text-center bg-muted border ${
                      dayOfWeek === 0 ? "text-red-500" : dayOfWeek === 6 ? "text-blue-500" : ""
                    }`}
                  >
                    <div className="text-sm font-medium">{format(date, "M/d(E)", { locale: ja })}</div>
                    {isToday(date) && (
                      <span className="inline-block w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs leading-6">
                        今
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedEmployees.map((employee) => (
              <tr key={employee.id}>
                <td className="p-1 bg-muted/50 border font-medium sticky left-0 z-10">
                  <div className="flex items-center gap-0.5">
                    <span className="text-xs truncate">{employee.name}</span>
                    {employee.id === currentEmployeeId && (
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">(自)</span>
                    )}
                  </div>
                </td>
                {displayDays.map((date, idx) => {
                  const dayEvents = getAllEventsForDateAndEmployee(date, employee.id);
                  const dateStr = format(date, "yyyy-MM-dd");
                  const isDragOver = dragOverDate === dateStr;
                  return (
                    <td
                      key={idx}
                      className={`p-2 bg-background border align-top cursor-pointer hover:bg-muted/50 ${
                        isDragOver ? "bg-blue-100 ring-2 ring-blue-400" : ""
                      }`}
                      onClick={() => handleDateClick(date)}
                      onDrop={(e) => handleDrop(date, e, employee.id)}
                      onDragOver={(e) => handleDragOver(date, e)}
                      onDragLeave={handleDragLeave}
                    >
                      <div className="space-y-1 min-h-[60px]">
                        {dayEvents.map((event) => renderEvent(event, true, true))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            {sortedEmployees.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-muted-foreground">
                  表示する社員がいません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  // 時間枠ラベル（共通）
  const hourLabels = [
    { label: "～8:00", hour: -1 },
    ...Array.from({ length: 10 }, (_, i) => ({ label: `${i + 8}:00`, hour: i + 8 })),
    { label: "18:00～", hour: 18 },
  ];

  // イベントを時間枠に配置するヘルパー（共通）
  const getEventPosition = (event: CalendarEventWithParticipants) => {
    if (!event.start_time) return null;
    const [startHour, startMin] = event.start_time.split(":").map(Number);
    const startMinutes = startHour * 60 + startMin;

    const baseMinutes = 8 * 60;
    const firstSlotHeight = 48;
    let top: number;

    if (startMinutes < baseMinutes) {
      top = 0;
    } else if (startMinutes >= 18 * 60) {
      top = firstSlotHeight + 10 * 48;
    } else {
      top = firstSlotHeight + ((startMinutes - baseMinutes) / 60) * 48;
    }

    let height = 48;
    if (event.end_time) {
      const [endHour, endMin] = event.end_time.split(":").map(Number);
      const endMinutes = endHour * 60 + endMin;
      height = Math.max(24, ((endMinutes - startMinutes) / 60) * 48);
    }

    return { top, height };
  };

  // 1日全員表示（時間軸付き、メンバー横並び）
  const renderDayAllView = () => {
    // 終日または時間なしイベント
    const getAllDayEventsForEmployee = (date: Date, employeeId: string) => {
      return getAllEventsForDateAndEmployee(date, employeeId).filter((e) => !e.start_time || e.all_day);
    };

    // 時間指定イベント
    const getTimedEventsForEmployee = (date: Date, employeeId: string) => {
      return getAllEventsForDateAndEmployee(date, employeeId).filter((e) => e.start_time && !e.all_day);
    };

    const dateStr = format(currentDate, "yyyy-MM-dd");
    const dayOfWeek = currentDate.getDay();

    return (
      <div className="overflow-auto">
        {/* ヘッダー: 社員名 */}
        <div className={`grid border-b`} style={{ gridTemplateColumns: `60px repeat(${sortedEmployees.length}, 1fr)` }}>
          <div className={`p-2 bg-muted border-r text-center ${
            dayOfWeek === 0 ? "text-red-500" : dayOfWeek === 6 ? "text-blue-500" : ""
          }`}>
            <div className="text-sm font-medium">{format(currentDate, "M/d(E)", { locale: ja })}</div>
            {isToday(currentDate) && (
              <span className="inline-block w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs leading-6">
                今
              </span>
            )}
          </div>
          {sortedEmployees.map((emp) => (
            <div key={emp.id} className="p-2 bg-muted border-r text-center text-sm font-medium truncate">
              {emp.name}
              {emp.id === currentEmployeeId && <span className="text-xs text-muted-foreground ml-1">(自)</span>}
            </div>
          ))}
        </div>

        {/* 終日イベント行 */}
        <div className="border-b bg-gray-50" style={{ display: "grid", gridTemplateColumns: `60px repeat(${sortedEmployees.length}, 1fr)` }}>
          <div className="p-1 border-r text-xs text-muted-foreground text-center">終日</div>
          {sortedEmployees.map((emp) => {
            const allDayEvents = getAllDayEventsForEmployee(currentDate, emp.id);
            const isDragOver = dragOverDate === dateStr;
            return (
              <div
                key={emp.id}
                className={`p-1 border-r min-h-[32px] cursor-pointer hover:bg-muted/50 ${
                  isDragOver ? "bg-blue-100 ring-2 ring-blue-400" : ""
                }`}
                onClick={() => handleDateClick(currentDate)}
                onDrop={(e) => handleDrop(currentDate, e, emp.id)}
                onDragOver={(e) => handleDragOver(currentDate, e)}
                onDragLeave={handleDragLeave}
              >
                {allDayEvents.map((event) => renderEvent(event, true, true))}
              </div>
            );
          })}
        </div>

        {/* 時間軸 */}
        <div style={{ display: "grid", gridTemplateColumns: `60px repeat(${sortedEmployees.length}, 1fr)` }}>
          {/* 時間ラベル列 */}
          <div className="border-r">
            {hourLabels.map((slot, idx) => (
              <div key={idx} className={`h-12 border-b text-xs text-muted-foreground text-right pr-2 pt-0.5 ${slot.hour === 12 ? "bg-gray-100" : ""}`}>
                {slot.label}
              </div>
            ))}
          </div>

          {/* 社員ごとのイベント列 */}
          {sortedEmployees.map((emp) => {
            const timedEvents = getTimedEventsForEmployee(currentDate, emp.id);
            return (
              <div key={emp.id} className="border-r relative">
                {/* 時間枠の背景線 */}
                {hourLabels.map((slot, idx) => {
                  const isSlotDragOver = dragOverSlot?.date === dateStr && dragOverSlot?.hour === slot.hour;
                  const isLunchTime = slot.hour === 12;
                  return (
                    <div
                      key={idx}
                      className={`h-12 border-b cursor-pointer ${
                        isSlotDragOver ? "bg-blue-200" : isLunchTime ? "bg-gray-100" : "hover:bg-muted/30"
                      }`}
                      onClick={() => handleTimeSlotClick(currentDate, slot.hour)}
                      onDrop={(e) => handleTimeSlotDrop(currentDate, slot.hour, e, emp.id)}
                      onDragOver={(e) => handleTimeSlotDragOver(currentDate, slot.hour, e)}
                      onDragLeave={() => setDragOverSlot(null)}
                    />
                  );
                })}

                {/* イベント */}
                {timedEvents.map((event) => {
                  const pos = getEventPosition(event);
                  if (!pos) return null;
                  const categoryColor = getCategoryColor(event);
                  const lightBgColor = getLightBgColor(categoryColor);
                  const categoryName = getCategoryName(event);
                  const isDragging = draggingEventId === event.id;
                  const isResizing = resizingEvent?.eventId === event.id;
                  const displayTop = isResizing ? resizingEvent.previewTop : pos.top;
                  const displayHeight = isResizing ? resizingEvent.previewHeight : pos.height;
                  return (
                    <div
                      key={event.id}
                      draggable={!isResizing}
                      onDragStart={(e) => !isResizing && handleEventDragStart(event, e)}
                      onDragEnd={handleEventDragEnd}
                      className={`absolute left-0.5 right-0.5 rounded px-1 py-0.5 overflow-hidden border ${lightBgColor} ${
                        isDragging ? "opacity-50 ring-2 ring-primary" : ""
                      } ${isResizing ? "ring-2 ring-primary z-10" : "cursor-grab hover:opacity-80"}`}
                      style={{ top: displayTop, height: displayHeight }}
                      onClick={(e) => handleEventClick(event, e)}
                    >
                      <div
                        className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-primary/20 z-10"
                        onMouseDown={(e) => handleResizeStart(event, "top", e, currentDate, pos.top, pos.height)}
                      />
                      <div className="text-xs font-medium truncate text-black flex items-center gap-1">
                        {categoryName && (
                          <span className={`${categoryColor} text-white px-1 rounded text-[10px] flex-shrink-0`}>{categoryName}</span>
                        )}
                        {event.is_completed && (
                          <CheckCircle className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                        )}
                        <span className="truncate">{event.start_time?.slice(0, 5)} {event.title}</span>
                      </div>
                      {event.location && displayHeight >= 48 && (
                        <div className="text-[10px] text-black truncate flex items-center gap-0.5">
                          <MapPin className="h-2.5 w-2.5" />
                          {event.location}
                        </div>
                      )}
                      <div
                        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-primary/20 z-10"
                        onMouseDown={(e) => handleResizeStart(event, "bottom", e, currentDate, pos.top, pos.height)}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // 5日表示（時間軸付き、フィルター対象の社員）
  const renderFiveDayView = () => {
    // 終日または時間なしイベント
    const getAllDayEvents = (date: Date) => {
      return getFilteredEventsForDate(date).filter((e) => !e.start_time || e.all_day);
    };

    // 時間指定イベント
    const getTimedEvents = (date: Date) => {
      return getFilteredEventsForDate(date).filter((e) => e.start_time && !e.all_day);
    };

    return (
      <div className="overflow-auto">
        {/* ヘッダー: 5日分の日付 */}
        <div className="grid grid-cols-[60px_1fr_1fr_1fr_1fr_1fr] border-b">
          <div className="p-2 bg-muted border-r text-center text-xs font-medium">時間</div>
          {fiveDays.map((date, idx) => {
            const dayOfWeek = date.getDay();
            return (
              <div
                key={idx}
                className={`p-2 bg-muted border-r text-center ${
                  dayOfWeek === 0 ? "text-red-500" : dayOfWeek === 6 ? "text-blue-500" : ""
                }`}
              >
                <div className="text-sm font-medium">{format(date, "M/d(E)", { locale: ja })}</div>
                {isToday(date) && (
                  <span className="inline-block w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs leading-6">
                    今
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* 終日イベント行 */}
        <div className="grid grid-cols-[60px_1fr_1fr_1fr_1fr_1fr] border-b bg-gray-50">
          <div className="p-1 border-r text-xs text-muted-foreground text-center">終日</div>
          {fiveDays.map((date, idx) => {
            const allDayEvents = getAllDayEvents(date);
            const dateStr = format(date, "yyyy-MM-dd");
            const isDragOver = dragOverDate === dateStr;
            return (
              <div
                key={idx}
                className={`p-1 border-r min-h-[32px] cursor-pointer hover:bg-muted/50 ${
                  isDragOver ? "bg-blue-100 ring-2 ring-blue-400" : ""
                }`}
                onClick={() => handleDateClick(date)}
                onDrop={(e) => handleDrop(date, e)}
                onDragOver={(e) => handleDragOver(date, e)}
                onDragLeave={handleDragLeave}
              >
                {allDayEvents.map((event) => renderEvent(event, true, true))}
              </div>
            );
          })}
        </div>

        {/* 時間軸 */}
        <div className="grid grid-cols-[60px_1fr_1fr_1fr_1fr_1fr]">
          {/* 時間ラベル列 */}
          <div className="border-r">
            {hourLabels.map((slot, idx) => (
              <div key={idx} className={`h-12 border-b text-xs text-muted-foreground text-right pr-2 pt-0.5 ${slot.hour === 12 ? "bg-gray-100" : ""}`}>
                {slot.label}
              </div>
            ))}
          </div>

          {/* 5日分のイベント列 */}
          {fiveDays.map((date, dayIdx) => {
            const timedEvents = getTimedEvents(date);
            const dateStr = format(date, "yyyy-MM-dd");
            return (
              <div
                key={dayIdx}
                className="border-r relative"
              >
                {/* 時間枠の背景線（ドロップ可能） */}
                {hourLabels.map((slot, idx) => {
                  const isSlotDragOver = dragOverSlot?.date === dateStr && dragOverSlot?.hour === slot.hour;
                  const isLunchTime = slot.hour === 12;
                  return (
                    <div
                      key={idx}
                      className={`h-12 border-b cursor-pointer ${
                        isSlotDragOver ? "bg-blue-200" : isLunchTime ? "bg-gray-100" : "hover:bg-muted/30"
                      }`}
                      onClick={() => handleTimeSlotClick(date, slot.hour)}
                      onDrop={(e) => handleTimeSlotDrop(date, slot.hour, e)}
                      onDragOver={(e) => handleTimeSlotDragOver(date, slot.hour, e)}
                      onDragLeave={() => setDragOverSlot(null)}
                    />
                  );
                })}

                {/* イベント（絶対配置・ドラッグ可能・リサイズ可能） */}
                {timedEvents.map((event) => {
                  const pos = getEventPosition(event);
                  if (!pos) return null;
                  const categoryColor = getCategoryColor(event);
                  const lightBgColor = getLightBgColor(categoryColor);
                  const categoryName = getCategoryName(event);
                  const isDragging = draggingEventId === event.id;
                  const isResizing = resizingEvent?.eventId === event.id;
                  const displayTop = isResizing ? resizingEvent.previewTop : pos.top;
                  const displayHeight = isResizing ? resizingEvent.previewHeight : pos.height;
                  return (
                    <div
                      key={event.id}
                      draggable={!isResizing}
                      onDragStart={(e) => !isResizing && handleEventDragStart(event, e)}
                      onDragEnd={handleEventDragEnd}
                      className={`absolute left-0.5 right-0.5 rounded px-1 py-0.5 overflow-hidden border ${lightBgColor} ${
                        isDragging ? "opacity-50 ring-2 ring-primary" : ""
                      } ${isResizing ? "ring-2 ring-primary z-10" : "cursor-grab hover:opacity-80"}`}
                      style={{ top: displayTop, height: displayHeight }}
                      onClick={(e) => handleEventClick(event, e)}
                    >
                      <div
                        className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-primary/20 z-10"
                        onMouseDown={(e) => handleResizeStart(event, "top", e, date, pos.top, pos.height)}
                      />
                      <div className="text-xs font-medium truncate text-black flex items-center gap-1">
                        {categoryName && (
                          <span className={`${categoryColor} text-white px-1 rounded text-[10px] flex-shrink-0`}>{categoryName}</span>
                        )}
                        {event.is_completed && (
                          <CheckCircle className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                        )}
                        <span className="truncate">{event.start_time?.slice(0, 5)} {event.title}</span>
                      </div>
                      {event.location && displayHeight >= 48 && (
                        <div className="text-[10px] text-black truncate flex items-center gap-0.5">
                          <MapPin className="h-2.5 w-2.5" />
                          {event.location}
                        </div>
                      )}
                      <div
                        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-primary/20 z-10"
                        onMouseDown={(e) => handleResizeStart(event, "bottom", e, date, pos.top, pos.height)}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // 1日表示（個人別、時間軸付き）
  const renderDayView = () => {
    // 終日または時間なしイベント
    const getAllDayEvents = (date: Date) => {
      return getFilteredEventsForDate(date).filter((e) => !e.start_time || e.all_day);
    };

    // 時間指定イベント
    const getTimedEvents = (date: Date) => {
      return getFilteredEventsForDate(date).filter((e) => e.start_time && !e.all_day);
    };

    const dateStr = format(currentDate, "yyyy-MM-dd");
    const dayOfWeek = currentDate.getDay();

    return (
      <div className="overflow-auto">
        {/* ヘッダー: 日付 */}
        <div className="grid grid-cols-[60px_1fr] border-b">
          <div className="p-2 bg-muted border-r text-center text-xs font-medium">時間</div>
          <div
            className={`p-2 bg-muted border-r text-center ${
              dayOfWeek === 0 ? "text-red-500" : dayOfWeek === 6 ? "text-blue-500" : ""
            }`}
          >
            <div className="text-sm font-medium">{format(currentDate, "M/d(E)", { locale: ja })}</div>
            {isToday(currentDate) && (
              <span className="inline-block w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs leading-6">
                今
              </span>
            )}
          </div>
        </div>

        {/* 終日イベント行 */}
        <div className="grid grid-cols-[60px_1fr] border-b bg-gray-50">
          <div className="p-1 border-r text-xs text-muted-foreground text-center">終日</div>
          <div
            className={`p-1 border-r min-h-[32px] cursor-pointer hover:bg-muted/50 ${
              dragOverDate === dateStr ? "bg-blue-100 ring-2 ring-blue-400" : ""
            }`}
            onClick={() => handleDateClick(currentDate)}
            onDrop={(e) => handleDrop(currentDate, e)}
            onDragOver={(e) => handleDragOver(currentDate, e)}
            onDragLeave={handleDragLeave}
          >
            {getAllDayEvents(currentDate).map((event) => renderEvent(event, true))}
          </div>
        </div>

        {/* 時間軸 */}
        <div className="grid grid-cols-[60px_1fr]">
          {/* 時間ラベル列 */}
          <div className="border-r">
            {hourLabels.map((slot, idx) => (
              <div key={idx} className={`h-12 border-b text-xs text-muted-foreground text-right pr-2 pt-0.5 ${slot.hour === 12 ? "bg-gray-100" : ""}`}>
                {slot.label}
              </div>
            ))}
          </div>

          {/* イベント列 */}
          <div className="border-r relative">
            {/* 時間枠の背景線 */}
            {hourLabels.map((slot, idx) => {
              const isSlotDragOver = dragOverSlot?.date === dateStr && dragOverSlot?.hour === slot.hour;
              const isLunchTime = slot.hour === 12;
              return (
                <div
                  key={idx}
                  className={`h-12 border-b cursor-pointer ${
                    isSlotDragOver ? "bg-blue-200" : isLunchTime ? "bg-gray-100" : "hover:bg-muted/30"
                  }`}
                  onClick={() => handleTimeSlotClick(currentDate, slot.hour)}
                  onDrop={(e) => handleTimeSlotDrop(currentDate, slot.hour, e)}
                  onDragOver={(e) => handleTimeSlotDragOver(currentDate, slot.hour, e)}
                  onDragLeave={() => setDragOverSlot(null)}
                />
              );
            })}

            {/* イベント */}
            {getTimedEvents(currentDate).map((event) => {
              const pos = getEventPosition(event);
              if (!pos) return null;
              const categoryColor = getCategoryColor(event);
              const lightBgColor = getLightBgColor(categoryColor);
              const categoryName = getCategoryName(event);
              const isDragging = draggingEventId === event.id;
              const isResizing = resizingEvent?.eventId === event.id;
              const displayTop = isResizing ? resizingEvent.previewTop : pos.top;
              const displayHeight = isResizing ? resizingEvent.previewHeight : pos.height;
              return (
                <div
                  key={event.id}
                  draggable={!isResizing}
                  onDragStart={(e) => !isResizing && handleEventDragStart(event, e)}
                  onDragEnd={handleEventDragEnd}
                  className={`absolute left-0.5 right-0.5 rounded px-1 py-0.5 overflow-hidden border ${lightBgColor} ${
                    isDragging ? "opacity-50 ring-2 ring-primary" : ""
                  } ${isResizing ? "ring-2 ring-primary z-10" : "cursor-grab hover:opacity-80"}`}
                  style={{ top: displayTop, height: displayHeight }}
                  onClick={(e) => handleEventClick(event, e)}
                >
                  <div
                    className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-primary/20 z-10"
                    onMouseDown={(e) => handleResizeStart(event, "top", e, currentDate, pos.top, pos.height)}
                  />
                  <div className="text-xs font-medium truncate text-black flex items-center gap-1">
                    {categoryName && (
                      <span className={`${categoryColor} text-white px-1 rounded text-[10px] flex-shrink-0`}>{categoryName}</span>
                    )}
                    {event.is_completed && (
                      <CheckCircle className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                    )}
                    <span className="truncate">{event.start_time?.slice(0, 5)} {event.title}</span>
                  </div>
                  {event.location && displayHeight >= 48 && (
                    <div className="text-[10px] text-black truncate flex items-center gap-0.5">
                      <MapPin className="h-2.5 w-2.5" />
                      {event.location}
                    </div>
                  )}
                  {event.participants.length > 0 && displayHeight >= 60 && (
                    <div className="text-[10px] text-black truncate flex items-center gap-0.5">
                      <Users className="h-2.5 w-2.5" />
                      {event.participants.map((p) => p.name).join(", ")}
                    </div>
                  )}
                  <div
                    className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-primary/20 z-10"
                    onMouseDown={(e) => handleResizeStart(event, "bottom", e, currentDate, pos.top, pos.height)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="h-full flex flex-col">
      {/* ナビゲーション */}
      <div className="flex items-center justify-between flex-wrap gap-2 p-4 border-b">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={navigatePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={navigateToday}>
            今日
          </Button>
          <Button variant="outline" size="sm" onClick={navigateNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold ml-2">{getTitle()}</h2>

          {/* 社員フィルター（1日・5日表示・月表示でのみ表示） */}
          {(viewMode === "day" || viewMode === "fiveDay" || viewMode === "month") && (
            <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
              <SelectTrigger className="w-[140px] h-8 ml-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currentEmployeeId && (
                  <SelectItem value="me">
                    <span className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      自分
                    </span>
                  </SelectItem>
                )}
                <SelectItem value="all">
                  <span className="flex items-center gap-2">
                    <UsersRound className="h-4 w-4" />
                    全員
                  </span>
                </SelectItem>
                {sortedEmployees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    <span className="flex items-center gap-2">
                      <User className="h-4 w-4 opacity-50" />
                      {emp.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          {/* 表示切替: 1日（個人）/1日全員/5日（個人）/5日全員/月 */}
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === "day" ? "default" : "ghost"}
              size="sm"
              className="rounded-r-none"
              onClick={() => setViewMode("day")}
            >
              <User className="h-4 w-4 mr-1" />
              1日
            </Button>
            <Button
              variant={viewMode === "dayAll" ? "default" : "ghost"}
              size="sm"
              className="rounded-none border-x"
              onClick={() => setViewMode("dayAll")}
            >
              <UsersRound className="h-4 w-4 mr-1" />
              1日全員
            </Button>
            <Button
              variant={viewMode === "fiveDay" ? "default" : "ghost"}
              size="sm"
              className="rounded-none border-x"
              onClick={() => setViewMode("fiveDay")}
            >
              <User className="h-4 w-4 mr-1" />
              5日
            </Button>
            <Button
              variant={viewMode === "fiveDayAll" ? "default" : "ghost"}
              size="sm"
              className="rounded-none border-x"
              onClick={() => setViewMode("fiveDayAll")}
            >
              <UsersRound className="h-4 w-4 mr-1" />
              5日全員
            </Button>
            <Button
              variant={viewMode === "month" ? "default" : "ghost"}
              size="sm"
              className="rounded-l-none"
              onClick={() => setViewMode("month")}
            >
              <Calendar className="h-4 w-4 mr-1" />
              月
            </Button>
          </div>

          {/* 平日/全日切替（5日表示・5日全員表示のときのみ） */}
          {(viewMode === "fiveDay" || viewMode === "fiveDayAll") && (
            <div className="flex border rounded-md">
              <Button
                variant={!hideWeekends ? "default" : "ghost"}
                size="sm"
                className="rounded-r-none"
                onClick={() => setHideWeekends(false)}
              >
                全日
              </Button>
              <Button
                variant={hideWeekends ? "default" : "ghost"}
                size="sm"
                className="rounded-l-none border-l"
                onClick={() => setHideWeekends(true)}
              >
                平日
              </Button>
            </div>
          )}

          {/* 新規作成ボタン */}
          <Button size="sm" onClick={() => handleDateClick(new Date())}>
            <Plus className="h-4 w-4 mr-1" />
            追加
          </Button>

          {/* 社員順序設定ボタン（1日全員・5日全員表示のときのみ） */}
          {(viewMode === "dayAll" || viewMode === "fiveDayAll") && (
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowEmployeeOrderModal(true)}
              title="社員の表示順を変更"
            >
              <GripVertical className="h-4 w-4" />
            </Button>
          )}

          {/* 設定リンク */}
          <Link href="/calendar/settings">
            <Button variant="outline" size="icon" className="h-8 w-8">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* カレンダー本体 */}
      <CardContent className="p-0 flex-1 overflow-auto">
        {viewMode === "month" && renderMonthView()}
        {viewMode === "fiveDayAll" && renderFiveDayAllView()}
        {viewMode === "dayAll" && renderDayAllView()}
        {viewMode === "fiveDay" && renderFiveDayView()}
        {viewMode === "day" && renderDayView()}
      </CardContent>

      {/* イベント作成・編集モーダル */}
      <EventModal
        open={showEventModal}
        onOpenChange={(open) => {
          setShowEventModal(open);
          if (!open) {
            setSelectedStartTime(null);
            setSelectedEndTime(null);
          }
        }}
        employees={employees}
        eventCategories={eventCategories}
        selectedDate={selectedDate}
        event={selectedEvent}
        onSaved={handleEventSaved}
        currentEmployeeId={currentEmployeeId}
        initialStartTime={selectedStartTime}
        initialEndTime={selectedEndTime}
      />

      {/* イベント詳細モーダル */}
      <EventDetailModal
        open={showDetailModal}
        onOpenChange={setShowDetailModal}
        event={selectedEvent}
        onEdit={handleEditEvent}
        onDeleted={handleEventDeleted}
        onUpdated={(updatedEvent) => handleEventSaved(updatedEvent, false)}
      />

      {/* 社員順序設定モーダル */}
      <Dialog open={showEmployeeOrderModal} onOpenChange={setShowEmployeeOrderModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>社員の表示順</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              ドラッグ＆ドロップで並び替えができます
            </p>
            <div className="border rounded-md divide-y max-h-[400px] overflow-auto">
              {sortedEmployees.map((emp) => (
                <div
                  key={emp.id}
                  draggable
                  onDragStart={() => handleEmployeeOrderDragStart(emp.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleEmployeeOrderDrop(emp.id)}
                  className={`flex items-center gap-2 p-2 cursor-grab hover:bg-muted/50 ${
                    draggingEmployeeId === emp.id ? "opacity-50 bg-primary/10" : ""
                  }`}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1">{emp.name}</span>
                  {emp.id === currentEmployeeId && (
                    <span className="text-xs text-muted-foreground">（自分）</span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={resetEmployeeOrder}>
                リセット
              </Button>
              <Button size="sm" onClick={() => setShowEmployeeOrderModal(false)}>
                閉じる
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
