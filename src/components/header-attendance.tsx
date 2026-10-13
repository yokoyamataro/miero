"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Clock, LogIn, LogOut, Undo2, Settings2 } from "lucide-react";
import {
  clockIn,
  clockOut,
  cancelClockOut,
  updateTodayAttendanceDetail,
} from "@/app/attendance/actions";
import {
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_STATUS_COLORS,
  type AttendanceStatus,
} from "@/types/database";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

type Attendance = {
  id: string;
  clock_in: string | null;
  clock_out: string | null;
  date: string;
  break_minutes: number | null;
  status: string | null;
  note: string | null;
} | null;

type Props = {
  initialAttendance: Attendance;
  employeeId: string | null;
};

export function HeaderAttendance({ initialAttendance, employeeId }: Props) {
  const [attendance] = useState<Attendance>(initialAttendance);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 編集モーダル
  const [showEditModal, setShowEditModal] = useState(false);
  const [editStatus, setEditStatus] = useState<AttendanceStatus>(
    (attendance?.status as AttendanceStatus | null) ?? "Work"
  );
  const [editBreakMinutes, setEditBreakMinutes] = useState(
    String(attendance?.break_minutes ?? 0)
  );
  const [editNote, setEditNote] = useState(attendance?.note ?? "");

  // 現在時刻を1秒ごとに更新
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getStatus = () => {
    if (!attendance?.clock_in) return "未出勤";
    if (!attendance?.clock_out) return "勤務中";
    return "退勤済";
  };

  const status = getStatus();
  const dbStatus = (attendance?.status as AttendanceStatus | null) ?? "Work";
  const isSpecialStatus = dbStatus !== "Work";

  const handleClockIn = async () => {
    setLoading(true);
    setError(null);
    const result = await clockIn();
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      window.location.reload();
    }
  };

  const handleClockOut = async () => {
    setLoading(true);
    setError(null);
    const result = await clockOut();
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      window.location.reload();
    }
  };

  const handleCancelClockOut = async () => {
    if (!confirm("退勤を取り消しますか？")) return;
    setLoading(true);
    setError(null);
    const result = await cancelClockOut();
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      window.location.reload();
    }
  };

  const openEditModal = () => {
    setEditStatus((attendance?.status as AttendanceStatus | null) ?? "Work");
    setEditBreakMinutes(String(attendance?.break_minutes ?? 0));
    setEditNote(attendance?.note ?? "");
    setError(null);
    setShowEditModal(true);
  };

  const handleSaveDetail = async () => {
    setLoading(true);
    setError(null);
    const breakMin = parseInt(editBreakMinutes, 10);
    const result = await updateTodayAttendanceDetail({
      status: editStatus,
      breakMinutes: isNaN(breakMin) ? 0 : Math.max(0, breakMin),
      note: editNote.trim() || null,
    });
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setShowEditModal(false);
    window.location.reload();
  };

  if (!employeeId) return null;

  return (
    <>
      <div className="flex items-center gap-3">
        {/* 現在時刻（クリックで自分のタイムカードへ） */}
        <Link
          href="/attendance"
          className="flex items-center gap-2 hover:text-foreground hover:underline"
          title="自分のタイムカードを見る"
        >
          <Clock className="h-4 w-4 text-muted-foreground" />
          <div className="text-sm">
            <span className="font-bold tabular-nums">
              {format(currentTime, "HH:mm")}
            </span>
            <span className="text-muted-foreground ml-1 hidden sm:inline">
              {format(currentTime, "M/d(E)", { locale: ja })}
            </span>
          </div>
        </Link>

        {/* 勤務ステータス（Work以外は特別表示を優先） */}
        {isSpecialStatus ? (
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-medium ${ATTENDANCE_STATUS_COLORS[dbStatus]}`}
          >
            {ATTENDANCE_STATUS_LABELS[dbStatus]}
          </span>
        ) : (
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              status === "未出勤"
                ? "bg-gray-100 text-gray-600"
                : status === "勤務中"
                  ? "bg-green-100 text-green-700"
                  : "bg-blue-100 text-blue-700"
            }`}
          >
            {status}
          </span>
        )}

        {/* 出退勤時刻・休憩 */}
        {attendance?.clock_in && (
          <span className="text-xs text-muted-foreground hidden sm:inline tabular-nums">
            {format(new Date(attendance.clock_in), "HH:mm")}
            {attendance?.clock_out &&
              ` - ${format(new Date(attendance.clock_out), "HH:mm")}`}
            {attendance.break_minutes && attendance.break_minutes > 0
              ? ` (休${attendance.break_minutes}分)`
              : ""}
          </span>
        )}

        {/* 打刻ボタン */}
        {status === "未出勤" && (
          <Button
            size="sm"
            onClick={handleClockIn}
            disabled={loading}
            className="gap-1 bg-green-600 hover:bg-green-700 h-7"
          >
            <LogIn className="h-3 w-3" />
            出勤
          </Button>
        )}
        {status === "勤務中" && (
          <Button
            size="sm"
            onClick={handleClockOut}
            disabled={loading}
            className="gap-1 bg-blue-600 hover:bg-blue-700 h-7"
          >
            <LogOut className="h-3 w-3" />
            退勤
          </Button>
        )}
        {status === "退勤済" && (
          <div className="flex gap-1">
            <Button
              size="sm"
              onClick={handleClockIn}
              disabled={loading}
              className="gap-1 bg-green-600 hover:bg-green-700 h-7"
            >
              <LogIn className="h-3 w-3" />
              再出勤
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancelClockOut}
              disabled={loading}
              className="gap-1 text-orange-600 border-orange-300 hover:bg-orange-50 h-7 px-2"
              title="退勤を取り消す"
            >
              <Undo2 className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* 詳細編集 */}
        <Button
          size="sm"
          variant="ghost"
          onClick={openEditModal}
          disabled={loading}
          className="h-7 w-7 p-0"
          title="休憩・備考・ステータスを編集"
        >
          <Settings2 className="h-4 w-4" />
        </Button>

        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>

      {/* 編集モーダル */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>勤怠詳細を編集</DialogTitle>
            <DialogDescription>
              {format(new Date(), "yyyy年M月d日(E)", { locale: ja })}
              の勤怠情報を編集します。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="status">ステータス</Label>
              <select
                id="status"
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                value={editStatus}
                onChange={(e) =>
                  setEditStatus(e.target.value as AttendanceStatus)
                }
                disabled={loading}
              >
                {(Object.keys(ATTENDANCE_STATUS_LABELS) as AttendanceStatus[]).map(
                  (key) => (
                    <option key={key} value={key}>
                      {ATTENDANCE_STATUS_LABELS[key]}
                    </option>
                  )
                )}
              </select>
              <p className="text-xs text-muted-foreground">
                有給休暇・欠勤は打刻せず、ステータスだけ設定してください。
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="break_minutes">休憩時間（分）</Label>
              <Input
                id="break_minutes"
                type="number"
                min={0}
                step={5}
                value={editBreakMinutes}
                onChange={(e) => setEditBreakMinutes(e.target.value)}
                disabled={loading}
                placeholder="60"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">備考</Label>
              <Textarea
                id="note"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                disabled={loading}
                placeholder="遅刻理由・特記事項など"
                rows={3}
              />
            </div>

            {error && (
              <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditModal(false)}
              disabled={loading}
            >
              キャンセル
            </Button>
            <Button onClick={handleSaveDetail} disabled={loading}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
