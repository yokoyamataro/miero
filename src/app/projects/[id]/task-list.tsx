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
  defaultAssigneeId?: string | null;
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

  const isCompleted = task.is_completed;

  const handleToggleComplete = () => {
    startTransition(async () => {
      await updateTask(task.id, { is_completed: !isCompleted });
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

  const handleAssigneeChange = (value: string) => {
    startTransition(async () => {
      await updateTask(task.id, { assigned_to: value === "none" ? null : value });
      router.refresh();
    });
  };

  const assignee = employees.find((e) => e.id === task.assigned_to);

  return (
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

      {/* 担当者 */}
      <Select
        value={task.assigned_to || "none"}
        onValueChange={handleAssigneeChange}
      >
        <SelectTrigger className="w-44 h-7">
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
  );
}

// テンプレートセット選択モーダル
function TemplateModal({
  projectId,
  open,
  onOpenChange,
  defaultAssigneeId,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAssigneeId?: string | null;
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
      const result = await createTasksFromTemplateSet(projectId, setId, defaultAssigneeId);
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
                      <div key={item.id} className="text-sm text-muted-foreground">
                        <span>{item.title}</span>
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
  defaultAssigneeId,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAssigneeId?: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (open) {
      setTitle("");
    }
  }, [open]);

  const handleAdd = () => {
    if (!title.trim()) {
      alert("タスク名を入力してください");
      return;
    }

    startTransition(async () => {
      await createTask({
        project_id: projectId,
        title: title.trim(),
        assigned_to: defaultAssigneeId || null,
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

export function TaskList({ projectId, tasks, employees, defaultAssigneeId }: TaskListProps) {
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
  const completedCount = localTasks.filter((t) => t.is_completed).length;
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
        defaultAssigneeId={defaultAssigneeId}
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
        defaultAssigneeId={defaultAssigneeId}
      />
    </Card>
  );
}
