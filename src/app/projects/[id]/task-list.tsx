"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Calendar,
  Timer,
  Settings2,
  GripVertical,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  type Task,
  type Employee,
} from "@/types/database";
import { createTask, updateTask, deleteTask, reorderTasks } from "./actions";

interface TaskListProps {
  projectId: string;
  tasks: Task[];
  employees: Employee[];
}

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

function SortableTaskItem({
  task,
  employees,
}: {
  task: Task;
  employees: Employee[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [showTimeModal, setShowTimeModal] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isCompleted = task.status === "完了";

  const handleToggleComplete = () => {
    startTransition(async () => {
      const newStatus = isCompleted ? "未完了" : "完了";
      const updates: Parameters<typeof updateTask>[1] = { status: newStatus };

      if (newStatus === "完了" && !task.completed_at) {
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

  const assignee = employees.find((e) => e.id === task.assigned_to);
  const isOverdue =
    task.due_date && !isCompleted && new Date(task.due_date) < new Date();

  // 時間情報があるかどうか
  const hasTimeInfo = task.estimated_minutes || task.started_at || task.completed_at || task.actual_minutes;

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={`flex items-center gap-3 p-2 rounded border hover:bg-muted/50 ${
          isPending ? "opacity-50" : ""
        }`}
      >
        {/* ドラッグハンドル */}
        <button
          {...attributes}
          {...listeners}
          className="flex-shrink-0 p-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
          title="ドラッグして並び替え"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* チェックボックス */}
        <Checkbox
          checked={isCompleted}
          onCheckedChange={handleToggleComplete}
          className="flex-shrink-0"
        />

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
              className={`cursor-pointer ${isCompleted ? "line-through text-muted-foreground" : ""}`}
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

export function TaskList({ projectId, tasks, employees }: TaskListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [localTasks, setLocalTasks] = useState(tasks);

  // tasksが更新されたらlocalTasksも更新
  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setLocalTasks((items) => {
        const oldIndex = items.findIndex((t) => t.id === active.id);
        const newIndex = items.findIndex((t) => t.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);

        // サーバーに並び順を保存
        startTransition(async () => {
          const taskOrders = newItems.map((task, index) => ({
            id: task.id,
            sort_order: index,
          }));
          await reorderTasks(projectId, taskOrders);
          router.refresh();
        });

        return newItems;
      });
    }
  };

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
  const completedCount = localTasks.filter((t) => t.status === "完了").length;
  const totalCount = localTasks.length;
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
        {localTasks.length === 0 && !isAddingTask && (
          <p className="text-center text-muted-foreground py-4">
            タスクがありません
          </p>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={localTasks.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            {localTasks.map((task) => (
              <SortableTaskItem
                key={task.id}
                task={task}
                employees={employees}
              />
            ))}
          </SortableContext>
        </DndContext>

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
