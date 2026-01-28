"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Clock, LogIn, LogOut, Briefcase, Plus, Trash2, Undo2 } from "lucide-react";
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

export function AttendanceClock({ initialAttendance, employeeId }: Props) {
  const [attendance, setAttendance] = useState<Attendance>(initialAttendance);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 工数入力モーダル
  const [showWorkLogModal, setShowWorkLogModal] = useState(false);
  const [pendingClockOut, setPendingClockOut] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [workLogs, setWorkLogs] = useState<WorkLogEntry[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [inputMinutes, setInputMinutes] = useState("");
  const [inputComment, setInputComment] = useState("");

  // 業務選択モーダル（出勤後）
  const [showProjectSelectModal, setShowProjectSelectModal] = useState(false);

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
      // 出勤成功後、業務選択モーダルを表示
      const projectsResult = await getActiveProjects();
      if (projectsResult.projects) {
        setProjects(projectsResult.projects);
        setShowProjectSelectModal(true);
      }
      // ページをリロードして最新の勤怠情報を取得
      window.location.reload();
    }
    setLoading(false);
  };

  // 退勤ボタン押下時
  const handleClockOutClick = async () => {
    setError(null);
    // 進行中の業務を取得
    const result = await getActiveProjects();
    if (result.projects) {
      setProjects(result.projects);
    }
    setWorkLogs([]);
    setShowWorkLogModal(true);
    setPendingClockOut(true);
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

    // 退勤打刻
    const clockOutResult = await clockOut();
    if (clockOutResult.error) {
      setError(clockOutResult.error);
      setLoading(false);
      return;
    }

    // 工数を保存
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
    setPendingClockOut(false);
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
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* 現在時刻 */}
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">
                  {format(currentTime, "HH:mm:ss")}
                </div>
                <div className="text-sm text-muted-foreground">
                  {format(currentTime, "yyyy年M月d日(E)", { locale: ja })}
                </div>
              </div>
            </div>

            {/* ステータス表示 */}
            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  status === "未出勤"
                    ? "bg-gray-100 text-gray-600"
                    : status === "勤務中"
                    ? "bg-green-100 text-green-700"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                {status}
              </span>
              {attendance?.clock_in && (
                <span className="text-sm text-muted-foreground">
                  出勤: {format(new Date(attendance.clock_in), "HH:mm")}
                </span>
              )}
              {attendance?.clock_out && (
                <span className="text-sm text-muted-foreground">
                  退勤: {format(new Date(attendance.clock_out), "HH:mm")}
                </span>
              )}
            </div>

            {/* 打刻ボタン */}
            <div className="flex gap-2">
              {status === "未出勤" && (
                <Button
                  size="lg"
                  onClick={handleClockIn}
                  disabled={loading}
                  className="gap-2 bg-green-600 hover:bg-green-700"
                >
                  <LogIn className="h-5 w-5" />
                  出勤
                </Button>
              )}
              {status === "勤務中" && (
                <Button
                  size="lg"
                  onClick={handleClockOutClick}
                  disabled={loading}
                  className="gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  <LogOut className="h-5 w-5" />
                  退勤
                </Button>
              )}
              {status === "退勤済" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancelClockOut}
                  disabled={loading}
                  className="gap-1 text-orange-600 border-orange-300 hover:bg-orange-50"
                >
                  <Undo2 className="h-4 w-4" />
                  退勤取消
                </Button>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-2 text-sm text-red-600">{error}</div>
          )}
        </CardContent>
      </Card>

      {/* 業務選択モーダル（出勤後） */}
      <Dialog open={showProjectSelectModal} onOpenChange={setShowProjectSelectModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              本日の担当業務を選択
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto">
            {projects.map((project) => (
              <div
                key={project.id}
                className="p-3 border-b hover:bg-accent cursor-pointer"
                onClick={() => setShowProjectSelectModal(false)}
              >
                <div className="font-medium">{project.code}</div>
                <div className="text-sm text-muted-foreground">{project.name}</div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProjectSelectModal(false)}>
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 工数入力モーダル */}
      <Dialog open={showWorkLogModal} onOpenChange={setShowWorkLogModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>退勤 - 本日の工数入力</DialogTitle>
          </DialogHeader>

          {/* 工数追加フォーム */}
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

            {/* 追加済み工数リスト */}
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

            {/* 合計 */}
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
