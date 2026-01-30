"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Calendar,
  User,
  CheckCircle2,
  Circle,
  Clock,
  Play,
  Square,
  Timer,
  Settings2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  type Task,
  type TaskStatus,
  type Employee,
  TASK_STATUS_COLORS,
} from "@/types/database";
import { createTask, updateTask, deleteTask } from "./actions";

interface TaskWithSubtasks extends Task {
  subtasks: Task[];
}

interface TaskListProps {
  projectId: string;
  tasks: TaskWithSubtasks[];
  employees: Employee[];
}

const STATUS_ICONS: Record<TaskStatus, React.ReactNode> = {
  未着手: <Circle className="h-4 w-4 text-gray-400" />,
  進行中: <Clock className="h-4 w-4 text-blue-500" />,
  完了: <CheckCircle2 className="h-4 w-4 text-green-500" />,
};

// 分を「時間:分」形式にフォーマット
function formatMinutes(minutes: number | null): string {
  if (minutes === null || minutes === 0) return "-";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}分`;
  if (mins === 0) return `${hours}時間`;
  return `${hours}時間${mins}分`;
}

// 時刻をフォーマット
function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TaskItem({
  task,
  employees,
  projectId,
  isSubtask = false,
}: {
  task: Task;
  employees: Employee[];
  projectId: string;
  isSubtask?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [showTimeModal, setShowTimeModal] = useState(false);

  const handleStatusChange = (newStatus: TaskStatus) => {
    startTransition(async () => {
      // ステータス変更時に時間も自動更新
      const updates: Parameters<typeof updateTask>[1] = { status: newStatus };

      if (newStatus === "進行中" && !task.started_at) {
        // 進行中に変更時、開始時刻を自動設定
        updates.started_at = new Date().toISOString();
      } else if (newStatus === "完了" && !task.completed_at) {
        // 完了に変更時、終了時刻と所要時間を自動設定
        updates.completed_at = new Date().toISOString();
        if (task.started_at) {
          const startedAt = new Date(task.started_at);
          const completedAt = new Date();
          const actualMinutes = Math.round((completedAt.getTime() - startedAt.getTime()) / 60000);
          updates.actual_minutes = actualMinutes;
        }
      }

      await updateTask(task.id, updates);
      router.refresh();
    });
  };

  const handleTitleSave = () => {
    if (title.trim() && title !== task.title) {
      startTransition(async () => {
        await updateTask(task.id, { title: title.trim() });
        router.refresh();
      });
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (confirm("このタスクを削除しますか？")) {
      startTransition(async () => {
        await deleteTask(task.id);
        router.refresh();
      });
    }
  };

  const handleDueDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    startTransition(async () => {
      await updateTask(task.id, { due_date: e.target.value || null });
      router.refresh();
    });
  };

  const handleAssigneeChange = (value: string) => {
    startTransition(async () => {
      await updateTask(task.id, { assigned_to: value === "none" ? null : value });
      router.refresh();
    });
  };

  // 開始ボタン
  const handleStart = () => {
    startTransition(async () => {
      await updateTask(task.id, {
        status: "進行中",
        started_at: new Date().toISOString(),
      });
      router.refresh();
    });
  };

  // 完了ボタン
  const handleComplete = () => {
    startTransition(async () => {
      const completedAt = new Date();
      let actualMinutes: number | null = null;

      if (task.started_at) {
        const startedAt = new Date(task.started_at);
        actualMinutes = Math.round((completedAt.getTime() - startedAt.getTime()) / 60000);
      }

      await updateTask(task.id, {
        status: "完了",
        completed_at: completedAt.toISOString(),
        actual_minutes: actualMinutes,
      });
      router.refresh();
    });
  };

  const assignee = employees.find((e) => e.id === task.assigned_to);
  const isOverdue =
    task.due_date && task.status !== "完了" && new Date(task.due_date) < new Date();

  // 時間情報があるかどうか
  const hasTimeInfo = task.estimated_minutes || task.started_at || task.completed_at || task.actual_minutes;

  return (
    <>
      <div
        className={`flex items-center gap-3 p-2 rounded hover:bg-muted/50 ${
          isSubtask ? "ml-6 border-l-2 border-muted pl-4" : ""
        } ${isPending ? "opacity-50" : ""}`}
      >
        {/* ステータスアイコン */}
        <button
          onClick={() => {
            const statuses: TaskStatus[] = ["未着手", "進行中", "完了"];
            const currentIdx = statuses.indexOf(task.status);
            const nextStatus = statuses[(currentIdx + 1) % statuses.length];
            handleStatusChange(nextStatus);
          }}
          className="flex-shrink-0"
          title={`クリックでステータス変更（現在: ${task.status}）`}
        >
          {STATUS_ICONS[task.status]}
        </button>

        {/* タイトル */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => e.key === "Enter" && handleTitleSave()}
              autoFocus
              className="h-7"
            />
          ) : (
            <span
              onClick={() => setIsEditing(true)}
              className={`cursor-pointer ${task.status === "完了" ? "line-through text-muted-foreground" : ""}`}
            >
              {task.title}
            </span>
          )}
        </div>

        {/* 時間表示（コンパクト） */}
        {hasTimeInfo && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
            <Timer className="h-3 w-3" />
            {task.actual_minutes ? (
              <span>{formatMinutes(task.actual_minutes)}</span>
            ) : task.estimated_minutes ? (
              <span>予{formatMinutes(task.estimated_minutes)}</span>
            ) : null}
          </div>
        )}

        {/* 開始/完了ボタン */}
        {task.status === "未着手" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleStart}
            className="h-7 px-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
            title="開始"
          >
            <Play className="h-4 w-4" />
          </Button>
        )}
        {task.status === "進行中" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleComplete}
            className="h-7 px-2 text-green-500 hover:text-green-700 hover:bg-green-50"
            title="完了"
          >
            <Square className="h-4 w-4" />
          </Button>
        )}

        {/* 時間設定ボタン */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowTimeModal(true)}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          title="時間設定"
        >
          <Settings2 className="h-4 w-4" />
        </Button>

        {/* 期限 */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Calendar className={`h-4 w-4 ${isOverdue ? "text-red-500" : "text-muted-foreground"}`} />
          <Input
            type="date"
            value={task.due_date || ""}
            onChange={handleDueDateChange}
            className={`w-32 h-7 text-sm ${isOverdue ? "text-red-500" : ""}`}
          />
        </div>

        {/* 担当者 */}
        <Select
          value={task.assigned_to || "none"}
          onValueChange={handleAssigneeChange}
        >
          <SelectTrigger className="w-28 h-7">
            <SelectValue>
              {assignee?.name || <span className="text-muted-foreground">未割当</span>}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">未割当</SelectItem>
            {employees.map((emp) => (
              <SelectItem key={emp.id} value={emp.id}>
                {emp.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 削除ボタン */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* 時間設定モーダル */}
      <TaskTimeModal
        task={task}
        open={showTimeModal}
        onOpenChange={setShowTimeModal}
      />
    </>
  );
}

// 時間設定モーダル
function TaskTimeModal({
  task,
  open,
  onOpenChange,
}: {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [estimatedHours, setEstimatedHours] = useState(
    task.estimated_minutes ? Math.floor(task.estimated_minutes / 60) : 0
  );
  const [estimatedMins, setEstimatedMins] = useState(
    task.estimated_minutes ? task.estimated_minutes % 60 : 0
  );
  const [actualHours, setActualHours] = useState(
    task.actual_minutes ? Math.floor(task.actual_minutes / 60) : 0
  );
  const [actualMins, setActualMins] = useState(
    task.actual_minutes ? task.actual_minutes % 60 : 0
  );

  const handleSave = () => {
    startTransition(async () => {
      const estimatedMinutes = estimatedHours * 60 + estimatedMins;
      const actualMinutes = actualHours * 60 + actualMins;

      await updateTask(task.id, {
        estimated_minutes: estimatedMinutes > 0 ? estimatedMinutes : null,
        actual_minutes: actualMinutes > 0 ? actualMinutes : null,
      });
      router.refresh();
      onOpenChange(false);
    });
  };

  const handleClearStartTime = () => {
    startTransition(async () => {
      await updateTask(task.id, { started_at: null });
      router.refresh();
    });
  };

  const handleClearEndTime = () => {
    startTransition(async () => {
      await updateTask(task.id, { completed_at: null, actual_minutes: null });
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>時間設定: {task.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 標準時間（見積もり） */}
          <div className="space-y-2">
            <Label>標準時間（見積もり）</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(parseInt(e.target.value) || 0)}
                className="w-20"
              />
              <span className="text-sm">時間</span>
              <Input
                type="number"
                min="0"
                max="59"
                value={estimatedMins}
                onChange={(e) => setEstimatedMins(parseInt(e.target.value) || 0)}
                className="w-20"
              />
              <span className="text-sm">分</span>
            </div>
          </div>

          {/* 開始時刻 */}
          <div className="space-y-2">
            <Label>開始時刻</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm flex-1">
                {task.started_at ? formatDateTime(task.started_at) : "未開始"}
              </span>
              {task.started_at && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearStartTime}
                  disabled={isPending}
                >
                  クリア
                </Button>
              )}
            </div>
          </div>

          {/* 終了時刻 */}
          <div className="space-y-2">
            <Label>終了時刻</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm flex-1">
                {task.completed_at ? formatDateTime(task.completed_at) : "未完了"}
              </span>
              {task.completed_at && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearEndTime}
                  disabled={isPending}
                >
                  クリア
                </Button>
              )}
            </div>
          </div>

          {/* 所要時間（実績） */}
          <div className="space-y-2">
            <Label>所要時間（実績）</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                value={actualHours}
                onChange={(e) => setActualHours(parseInt(e.target.value) || 0)}
                className="w-20"
              />
              <span className="text-sm">時間</span>
              <Input
                type="number"
                min="0"
                max="59"
                value={actualMins}
                onChange={(e) => setActualMins(parseInt(e.target.value) || 0)}
                className="w-20"
              />
              <span className="text-sm">分</span>
            </div>
            {task.started_at && task.completed_at && (
              <p className="text-xs text-muted-foreground">
                自動計算: {formatMinutes(
                  Math.round((new Date(task.completed_at).getTime() - new Date(task.started_at).getTime()) / 60000)
                )}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSave} disabled={isPending}>
              保存
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ParentTaskItem({
  task,
  employees,
  projectId,
}: {
  task: TaskWithSubtasks;
  employees: Employee[];
  projectId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(true);
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");

  const completedSubtasks = task.subtasks.filter((s) => s.status === "完了").length;
  const totalSubtasks = task.subtasks.length;

  const handleAddSubtask = () => {
    if (newSubtaskTitle.trim()) {
      startTransition(async () => {
        await createTask({
          project_id: projectId,
          parent_id: task.id,
          title: newSubtaskTitle.trim(),
        });
        setNewSubtaskTitle("");
        setIsAddingSubtask(false);
        router.refresh();
      });
    }
  };

  return (
    <div className="border rounded-lg p-2">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-shrink-0 p-1"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        <div className="flex-1">
          <TaskItem task={task} employees={employees} projectId={projectId} />
        </div>
      </div>

      {totalSubtasks > 0 && (
        <div className="ml-8 mt-1">
          <Badge variant="outline" className="text-xs">
            {completedSubtasks}/{totalSubtasks} 完了
          </Badge>
        </div>
      )}

      {expanded && (
        <div className="mt-2 space-y-1">
          {task.subtasks.map((subtask) => (
            <TaskItem
              key={subtask.id}
              task={subtask}
              employees={employees}
              projectId={projectId}
              isSubtask
            />
          ))}

          {isAddingSubtask ? (
            <div className="ml-6 pl-4 border-l-2 border-muted flex items-center gap-2">
              <Input
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                placeholder="サブタスクを入力..."
                onKeyDown={(e) => e.key === "Enter" && handleAddSubtask()}
                autoFocus
                className="flex-1 h-8"
                disabled={isPending}
              />
              <Button size="sm" onClick={handleAddSubtask} disabled={isPending}>
                追加
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsAddingSubtask(false);
                  setNewSubtaskTitle("");
                }}
              >
                キャンセル
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setIsAddingSubtask(true)}
              className="ml-6 pl-4 border-l-2 border-muted text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <Plus className="h-3 w-3" />
              サブタスク追加
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function TaskList({ projectId, tasks, employees }: TaskListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const handleAddTask = () => {
    if (newTaskTitle.trim()) {
      startTransition(async () => {
        await createTask({
          project_id: projectId,
          title: newTaskTitle.trim(),
        });
        setNewTaskTitle("");
        setIsAddingTask(false);
        router.refresh();
      });
    }
  };

  // 進捗計算
  const allTasks = tasks.flatMap((t) => [t, ...t.subtasks]);
  const completedCount = allTasks.filter((t) => t.status === "完了").length;
  const totalCount = allTasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            タスク
            {totalCount > 0 && (
              <Badge variant="secondary">
                {completedCount}/{totalCount} ({progressPercent}%)
              </Badge>
            )}
          </CardTitle>
        </div>
        {totalCount > 0 && (
          <div className="w-full bg-muted rounded-full h-2 mt-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {tasks.length === 0 && !isAddingTask && (
          <p className="text-center text-muted-foreground py-4">
            タスクがありません
          </p>
        )}

        {tasks.map((task) => (
          <ParentTaskItem
            key={task.id}
            task={task}
            employees={employees}
            projectId={projectId}
          />
        ))}

        {isAddingTask ? (
          <div className="flex items-center gap-2 p-2 border rounded-lg">
            <Input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="タスクを入力..."
              onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
              autoFocus
              className="flex-1"
              disabled={isPending}
            />
            <Button onClick={handleAddTask} disabled={isPending}>
              追加
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setIsAddingTask(false);
                setNewTaskTitle("");
              }}
            >
              キャンセル
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setIsAddingTask(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            タスクを追加
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
