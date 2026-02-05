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
  type TaskTemplate,
} from "@/types/database";
import {
  createTask,
  updateTask,
  deleteTask,
  reorderTasks,
  getTaskTemplates,
  createTaskTemplate,
  deleteTaskTemplate,
  createTasksFromTemplates,
} from "./actions";

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

function SortableTaskItem({
  task,
  employees,
  onSaveAsTemplate,
}: {
  task: Task;
  employees: Employee[];
  onSaveAsTemplate: (task: Task) => void;
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

        {/* 時間表示（コンパクト） */}
        {hasTimeInfo && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
            <Timer className="h-3 w-3" />
            {task.actual_minutes ? (
              <span>{formatMinutes(task.actual_minutes)}</span>
            ) : task.estimated_minutes ? (
              <span className="text-blue-500">予{formatMinutes(task.estimated_minutes)}</span>
            ) : null}
          </div>
        )}

        {/* テンプレート保存ボタン */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSaveAsTemplate(task)}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          title="テンプレートとして保存"
        >
          <Save className="h-4 w-4" />
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

      {/* 完了時の時間入力モーダル */}
      <CompleteTaskModal
        task={task}
        open={showTimeModal}
        onOpenChange={setShowTimeModal}
      />
    </>
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
    task.estimated_minutes ? Math.floor(task.estimated_minutes / 60) : 0
  );
  const [actualMins, setActualMins] = useState(
    task.estimated_minutes ? task.estimated_minutes % 60 : 0
  );

  // 標準時間をデフォルト値としてセット
  useEffect(() => {
    if (open && task.estimated_minutes) {
      setActualHours(Math.floor(task.estimated_minutes / 60));
      setActualMins(task.estimated_minutes % 60);
    }
  }, [open, task.estimated_minutes]);

  const handleComplete = () => {
    startTransition(async () => {
      const actualMinutes = actualHours * 60 + actualMins;
      await updateTask(task.id, {
        status: "完了",
        actual_minutes: actualMinutes > 0 ? actualMinutes : null,
      });
      router.refresh();
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>タスク完了</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm">{task.title}</p>

          {task.estimated_minutes && (
            <p className="text-sm text-muted-foreground">
              標準時間: {formatMinutes(task.estimated_minutes)}
            </p>
          )}

          <div className="space-y-2">
            <Label>実時間</Label>
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

// テンプレート選択モーダル
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
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      getTaskTemplates().then((data) => {
        setTemplates(data);
        setLoading(false);
      });
      setSelectedIds(new Set());
    }
  }, [open]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAddTasks = () => {
    if (selectedIds.size === 0) return;

    startTransition(async () => {
      await createTasksFromTemplates(projectId, Array.from(selectedIds));
      router.refresh();
      onOpenChange(false);
    });
  };

  const handleDeleteTemplate = (templateId: string) => {
    if (confirm("このテンプレートを削除しますか？")) {
      startTransition(async () => {
        await deleteTaskTemplate(templateId);
        setTemplates((prev) => prev.filter((t) => t.id !== templateId));
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>テンプレートからタスクを追加</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {loading ? (
            <p className="text-center text-muted-foreground py-4">読み込み中...</p>
          ) : templates.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              テンプレートがありません。<br />
              タスクの保存ボタンからテンプレートを作成できます。
            </p>
          ) : (
            templates.map((template) => (
              <div
                key={template.id}
                className="flex items-center gap-2 p-2 border rounded hover:bg-muted/50"
              >
                <Checkbox
                  checked={selectedIds.has(template.id)}
                  onCheckedChange={() => toggleSelect(template.id)}
                />
                <span className="flex-1">{template.title}</span>
                {template.estimated_minutes && (
                  <span className="text-xs text-muted-foreground">
                    {formatMinutes(template.estimated_minutes)}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteTemplate(template.id)}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button
            onClick={handleAddTasks}
            disabled={isPending || selectedIds.size === 0}
          >
            追加 ({selectedIds.size})
          </Button>
        </DialogFooter>
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
  const [showTemplateModal, setShowTemplateModal] = useState(false);

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

  const handleSaveAsTemplate = (task: Task) => {
    startTransition(async () => {
      const result = await createTaskTemplate(task.title, task.estimated_minutes);
      if (result.success) {
        alert("テンプレートとして保存しました");
      } else {
        alert(result.error || "エラーが発生しました");
      }
    });
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTemplateModal(true)}
          >
            <BookTemplate className="h-4 w-4 mr-1" />
            テンプレート
          </Button>
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
                onSaveAsTemplate={handleSaveAsTemplate}
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

      {/* テンプレート選択モーダル */}
      <TemplateModal
        projectId={projectId}
        open={showTemplateModal}
        onOpenChange={setShowTemplateModal}
      />
    </Card>
  );
}
