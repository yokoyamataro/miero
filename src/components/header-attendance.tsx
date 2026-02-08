"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Clock, LogIn, LogOut, Plus, Trash2, Undo2 } from "lucide-react";
import { clockIn, clockOut, saveWorkLogs, getActiveProjects, cancelClockOut } from "@/app/attendance/actions";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

type Attendance = {
  id: string;
  clock_in: string | null;
  clock_out: string | null;
  date: string;
} | null;

type Project = {
  id: string;
  code: string;
  name: string;
  status: string;
};

type WorkLogEntry = {
  projectId: string;
  projectCode: string;
  projectName: string;
  minutes: number;
  comment: string;
};

type Props = {
  initialAttendance: Attendance;
  employeeId: string | null;
};

export function HeaderAttendance({ initialAttendance, employeeId }: Props) {
  const [attendance, setAttendance] = useState<Attendance>(initialAttendance);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 工数入力モーダル
  const [showWorkLogModal, setShowWorkLogModal] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [workLogs, setWorkLogs] = useState<WorkLogEntry[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [inputMinutes, setInputMinutes] = useState("");
  const [inputComment, setInputComment] = useState("");

  // 現在時刻を更新
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ステータス判定
  const getStatus = () => {
    if (!attendance?.clock_in) return "未出勤";
    if (!attendance?.clock_out) return "勤務中";
    return "退勤済";
  };

  const status = getStatus();

  // 出勤処理
  const handleClockIn = async () => {
    setLoading(true);
    setError(null);
    const result = await clockIn();
    if (result.error) {
      setError(result.error);
    } else {
      window.location.reload();
    }
    setLoading(false);
  };

  // 退勤ボタン押下時
  const handleClockOutClick = async () => {
    setError(null);
    const result = await getActiveProjects();
    if (result.projects) {
      setProjects(result.projects);
    }
    setWorkLogs([]);
    setShowWorkLogModal(true);
  };

  // 工数を追加
  const addWorkLog = () => {
    if (!selectedProjectId || !inputMinutes) return;

    const project = projects.find((p) => p.id === selectedProjectId);
    if (!project) return;

    setWorkLogs([
      ...workLogs,
      {
        projectId: project.id,
        projectCode: project.code,
        projectName: project.name,
        minutes: parseInt(inputMinutes),
        comment: inputComment,
      },
    ]);

    setSelectedProjectId("");
    setInputMinutes("");
    setInputComment("");
  };

  // 工数を削除
  const removeWorkLog = (index: number) => {
    setWorkLogs(workLogs.filter((_, i) => i !== index));
  };

  // 退勤確定処理
  const confirmClockOut = async () => {
    setLoading(true);
    setError(null);

    const clockOutResult = await clockOut();
    if (clockOutResult.error) {
      setError(clockOutResult.error);
      setLoading(false);
      return;
    }

    if (workLogs.length > 0 && clockOutResult.attendanceId) {
      const saveResult = await saveWorkLogs(
        clockOutResult.attendanceId,
        workLogs.map((log) => ({
          projectId: log.projectId,
          minutes: log.minutes,
          comment: log.comment,
        }))
      );
      if (saveResult.error) {
        setError(saveResult.error);
      }
    }

    setShowWorkLogModal(false);
    window.location.reload();
  };

  // 合計時間の計算
  const totalMinutes = workLogs.reduce((sum, log) => sum + log.minutes, 0);

  // 退勤取消処理
  const handleCancelClockOut = async () => {
    if (!confirm("退勤を取り消しますか？工数データも削除されます。")) return;

    setLoading(true);
    setError(null);
    const result = await cancelClockOut();
    if (result.error) {
      setError(result.error);
    } else {
      window.location.reload();
    }
    setLoading(false);
  };

  if (!employeeId) {
    return null;
  }

  return (
    <>
      <div className="flex items-center gap-3">
        {/* 現在時刻 */}
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <div className="text-sm">
            <span className="font-bold">{format(currentTime, "HH:mm")}</span>
            <span className="text-muted-foreground ml-1 hidden sm:inline">
              {format(currentTime, "M/d(E)", { locale: ja })}
            </span>
          </div>
        </div>

        {/* ステータス */}
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

        {/* 出退勤時刻 */}
        {attendance?.clock_in && (
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {format(new Date(attendance.clock_in), "HH:mm")}
            {attendance?.clock_out && ` - ${format(new Date(attendance.clock_out), "HH:mm")}`}
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
            onClick={handleClockOutClick}
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
            >
              <Undo2 className="h-3 w-3" />
            </Button>
          </div>
        )}

        {error && (
          <span className="text-xs text-red-600">{error}</span>
        )}
      </div>

      {/* 工数入力モーダル */}
      <Dialog open={showWorkLogModal} onOpenChange={setShowWorkLogModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>退勤 - 本日の工数入力</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-5">
                <select
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                >
                  <option value="">業務を選択</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.code} - {project.name.slice(0, 10)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-3">
                <Input
                  type="number"
                  placeholder="分"
                  value={inputMinutes}
                  onChange={(e) => setInputMinutes(e.target.value)}
                />
              </div>
              <div className="col-span-3">
                <Input
                  placeholder="メモ"
                  value={inputComment}
                  onChange={(e) => setInputComment(e.target.value)}
                />
              </div>
              <div className="col-span-1">
                <Button size="icon" onClick={addWorkLog} disabled={!selectedProjectId || !inputMinutes}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
              {workLogs.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  工数が未入力です
                </div>
              ) : (
                workLogs.map((log, index) => (
                  <div key={index} className="p-2 flex items-center justify-between">
                    <div>
                      <span className="font-medium">{log.projectCode}</span>
                      <span className="mx-2 text-muted-foreground">-</span>
                      <span>{log.minutes}分</span>
                      {log.comment && (
                        <span className="ml-2 text-sm text-muted-foreground">
                          ({log.comment})
                        </span>
                      )}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeWorkLog(index)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-between items-center px-2">
              <span className="font-medium">合計</span>
              <span className="font-bold">
                {Math.floor(totalMinutes / 60)}時間{totalMinutes % 60}分
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWorkLogModal(false)}>
              キャンセル
            </Button>
            <Button onClick={confirmClockOut} disabled={loading}>
              退勤を確定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
