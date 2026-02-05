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
  GripVertical,
  BookTemplate,
  Save,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  type TaskTemplateSetWithItems,
} from "@/types/database";
import {
  createTask,
  updateTask,
  deleteTask,
  reorderTasks,
  getTaskTemplateSets,
  createTaskTemplateSetFromProject,
  deleteTaskTemplateSet,
  createTasksFromTemplateSet,
} from "./actions";

interface TaskListProps {
  projectId: string;
  tasks: Task[];
  employees: Employee[];
}

// 分を小数時間に変換してフォーマット（例: 90分 → "1.5h"）
function formatHours(minutes: number | null): string {
  if (minutes === null || minutes === 0) return "-";
  const hours = minutes / 60;
  // 小数点以下1桁まで表示
  return `${hours.toFixed(1)}h`;
}

// 小数時間を分に変換
function hoursToMinutes(hours: number): number {
  return Math.round(hours * 60);
}

// 分を小数時間に変換
function minutesToHours(minutes: number | null): number {
  if (minutes === null || minutes === 0) return 0;
  return minutes / 60;
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
  const [showEditTimeModal, setShowEditTimeModal] = useState(false);

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
    if (!isCompleted) {
      // 完了にする際は実時間入力モーダルを表示
      setShowTimeModal(true);
    } else {
      // 未完了に戻す
      startTransition(async () => {
        await updateTask(task.id, { status: "未完了", actual_minutes: null });
        router.refresh();
      });
    }
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
  const hasTimeInfo = task.estimated_minutes || task.actual_minutes;

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

        {/* 時間表示（クリックで編集） */}
        <button
          onClick={() => setShowEditTimeModal(true)}
          className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0 hover:text-foreground"
          title="時間を編集"
        >
          <Timer className="h-3 w-3" />
          {task.actual_minutes ? (
            <span>{formatHours(task.actual_minutes)}</span>
          ) : task.estimated_minutes ? (
            <span className="text-blue-500">{formatHours(task.estimated_minutes)}</span>
          ) : (
            <span className="text-muted-foreground/50">--</span>
          )}
        </button>

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

      {/* 完了時の時間入力モーダル */}
      <CompleteTaskModal
        task={task}
        open={showTimeModal}
        onOpenChange={setShowTimeModal}
      />

      {/* 時間編集モーダル */}
      <EditTimeModal
        task={task}
        open={showEditTimeModal}
        onOpenChange={setShowEditTimeModal}
      />
    </>
  );
}

// 時間編集モーダル（標準時間を編集）
function EditTimeModal({
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
    minutesToHours(task.estimated_minutes).toString()
  );

  useEffect(() => {
    if (open) {
      setEstimatedHours(minutesToHours(task.estimated_minutes).toString());
    }
  }, [open, task.estimated_minutes]);

  const handleSave = () => {
    startTransition(async () => {
      const hours = parseFloat(estimatedHours) || 0;
      const minutes = hours > 0 ? hoursToMinutes(hours) : null;
      await updateTask(task.id, { estimated_minutes: minutes });
      router.refresh();
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>標準時間を編集</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{task.title}</p>

          <div className="space-y-2">
            <Label>標準時間（時間）</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                step="0.5"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                className="w-24"
                autoFocus
              />
              <span className="text-sm text-muted-foreground">時間</span>
            </div>
            <p className="text-xs text-muted-foreground">
              例: 1.5 = 1時間30分
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 完了時の時間入力モーダル
function CompleteTaskModal({
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
  const [actualHours, setActualHours] = useState(
    minutesToHours(task.estimated_minutes).toString()
  );

  // 標準時間をデフォルト値としてセット
  useEffect(() => {
    if (open) {
      setActualHours(minutesToHours(task.estimated_minutes).toString());
    }
  }, [open, task.estimated_minutes]);

  const handleComplete = () => {
    startTransition(async () => {
      const hours = parseFloat(actualHours) || 0;
      const actualMinutes = hours > 0 ? hoursToMinutes(hours) : null;
      await updateTask(task.id, {
        status: "完了",
        actual_minutes: actualMinutes,
      });
      router.refresh();
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>タスク完了</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm">{task.title}</p>

          {task.estimated_minutes && (
            <p className="text-sm text-muted-foreground">
              標準時間: {formatHours(task.estimated_minutes)}
            </p>
          )}

          <div className="space-y-2">
            <Label>実時間（時間）</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                step="0.5"
                value={actualHours}
                onChange={(e) => setActualHours(e.target.value)}
                className="w-24"
                autoFocus
              />
              <span className="text-sm text-muted-foreground">時間</span>
            </div>
            <p className="text-xs text-muted-foreground">
              例: 1.5 = 1時間30分
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={handleComplete} disabled={isPending}>
            完了
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// テンプレートセット選択モーダル
function TemplateModal({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [templateSets, setTemplateSets] = useState<TaskTemplateSetWithItems[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedSetId, setExpandedSetId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLoading(true);
      getTaskTemplateSets().then((data) => {
        setTemplateSets(data);
        setLoading(false);
      });
    }
  }, [open]);

  const handleLoadSet = (setId: string) => {
    startTransition(async () => {
      const result = await createTasksFromTemplateSet(projectId, setId);
      if (result.success) {
        router.refresh();
        onOpenChange(false);
      } else {
        alert(result.error || "エラーが発生しました");
      }
    });
  };

  const handleDeleteSet = (setId: string) => {
    if (confirm("このテンプレートセットを削除しますか？")) {
      startTransition(async () => {
        await deleteTaskTemplateSet(setId);
        setTemplateSets((prev) => prev.filter((s) => s.id !== setId));
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>テンプレートからタスクを読み込み</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {loading ? (
            <p className="text-center text-muted-foreground py-4">読み込み中...</p>
          ) : templateSets.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              テンプレートがありません。<br />
              「テンプレートとして保存」ボタンで現在のタスク一覧を保存できます。
            </p>
          ) : (
            templateSets.map((set) => (
              <div key={set.id} className="border rounded p-2">
                <div className="flex items-center gap-2">
                  <button
                    className="flex-1 text-left font-medium hover:underline"
                    onClick={() => setExpandedSetId(expandedSetId === set.id ? null : set.id)}
                  >
                    {set.name}
                    <span className="text-xs text-muted-foreground ml-2">
                      ({set.items.length}件)
                    </span>
                  </button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleLoadSet(set.id)}
                    disabled={isPending}
                  >
                    読込
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteSet(set.id)}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                {expandedSetId === set.id && (
                  <div className="mt-2 pl-2 border-l-2 space-y-1">
                    {set.items.map((item) => (
                      <div key={item.id} className="text-sm text-muted-foreground flex justify-between">
                        <span>{item.title}</span>
                        {item.estimated_minutes && (
                          <span className="text-xs">{formatHours(item.estimated_minutes)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            閉じる
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// テンプレート保存モーダル
function SaveTemplateModal({
  projectId,
  taskCount,
  open,
  onOpenChange,
}: {
  projectId: string;
  taskCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [setName, setSetName] = useState("");

  useEffect(() => {
    if (open) {
      setSetName("");
    }
  }, [open]);

  const handleSave = () => {
    if (!setName.trim()) {
      alert("テンプレート名を入力してください");
      return;
    }

    startTransition(async () => {
      const result = await createTaskTemplateSetFromProject(projectId, setName.trim());
      if (result.success) {
        alert("テンプレートとして保存しました");
        onOpenChange(false);
      } else {
        alert(result.error || "エラーが発生しました");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>テンプレートとして保存</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            現在の{taskCount}件のタスクをテンプレートとして保存します。
          </p>

          <div className="space-y-2">
            <Label>テンプレート名</Label>
            <Input
              value={setName}
              onChange={(e) => setSetName(e.target.value)}
              placeholder="例: 役員変更登記"
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={isPending || !setName.trim()}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// タスク追加モーダル
function AddTaskModal({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");

  useEffect(() => {
    if (open) {
      setTitle("");
      setEstimatedHours("");
    }
  }, [open]);

  const handleAdd = () => {
    if (!title.trim()) {
      alert("タスク名を入力してください");
      return;
    }

    startTransition(async () => {
      const hours = parseFloat(estimatedHours) || 0;
      const estimatedMinutes = hours > 0 ? hoursToMinutes(hours) : null;
      await createTask({
        project_id: projectId,
        title: title.trim(),
        estimated_minutes: estimatedMinutes,
      });
      router.refresh();
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>タスクを追加</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>タスク名</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="タスク名を入力..."
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>標準時間（時間）</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                step="0.5"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                placeholder="0"
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">時間</span>
            </div>
            <p className="text-xs text-muted-foreground">
              例: 1.5 = 1時間30分（省略可）
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={handleAdd} disabled={isPending || !title.trim()}>
            追加
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TaskList({ projectId, tasks, employees }: TaskListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [localTasks, setLocalTasks] = useState(tasks);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

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
          <div className="flex gap-2">
            {totalCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSaveModal(true)}
              >
                <Save className="h-4 w-4 mr-1" />
                保存
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTemplateModal(true)}
            >
              <BookTemplate className="h-4 w-4 mr-1" />
              読込
            </Button>
          </div>
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
        {localTasks.length === 0 && (
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

        <Button
          variant="outline"
          className="w-full"
          onClick={() => setShowAddModal(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          タスクを追加
        </Button>
      </CardContent>

      {/* テンプレート選択モーダル */}
      <TemplateModal
        projectId={projectId}
        open={showTemplateModal}
        onOpenChange={setShowTemplateModal}
      />

      {/* テンプレート保存モーダル */}
      <SaveTemplateModal
        projectId={projectId}
        taskCount={totalCount}
        open={showSaveModal}
        onOpenChange={setShowSaveModal}
      />

      {/* タスク追加モーダル */}
      <AddTaskModal
        projectId={projectId}
        open={showAddModal}
        onOpenChange={setShowAddModal}
      />
    </Card>
  );
}
