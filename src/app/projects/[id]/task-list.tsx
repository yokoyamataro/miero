"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
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
  ArrowRight,
  ListTodo,
  Briefcase,
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
import { format } from "date-fns";
import {
  type Task,
  type Employee,
  type TaskTemplateSetWithItems,
  type EventCategory,
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
import {
  createProjectEvent,
  getEventCategories,
} from "./schedule-actions";

interface TaskListProps {
  projectId: string;
  projectCode: string;
  tasks: Task[];
  employees: Employee[];
  currentEmployeeId: string | null;
  defaultAssigneeId?: string | null;
  projectLocation?: string | null;
}

// 時間オプション (0-23)
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
// 分オプション (15分単位)
const MINUTE_OPTIONS = ["00", "15", "30", "45"];

function SortableTaskItem({
  task,
  employees,
  onExecute,
}: {
  task: Task;
  employees: Employee[];
  onExecute: (task: Task) => void;
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
      className={`flex items-center gap-2 p-2 rounded border hover:bg-muted/50 ${
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

      {/* 実行ボタン (→) */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onExecute(task)}
        className="h-7 w-7 p-0 flex-shrink-0 text-blue-600 border-blue-300 hover:bg-blue-50 hover:text-blue-700"
        title="スケジュールに移行"
      >
        <ArrowRight className="h-4 w-4" />
      </Button>

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
            className="cursor-pointer text-sm"
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
        <SelectTrigger className="w-24 h-7 text-xs">
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

// タスク→スケジュール移行モーダル
function TaskToScheduleModal({
  task,
  projectId,
  projectCode,
  employees,
  currentEmployeeId,
  projectLocation,
  open,
  onOpenChange,
}: {
  task: Task | null;
  projectId: string;
  projectCode: string;
  employees: Employee[];
  currentEmployeeId: string | null;
  projectLocation?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // フォーム状態
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [startHour, setStartHour] = useState("");
  const [startMinute, setStartMinute] = useState("");
  const [endHour, setEndHour] = useState("");
  const [endMinute, setEndMinute] = useState("");
  const [allDay, setAllDay] = useState(true);
  const [location, setLocation] = useState("");
  const [mapUrl, setMapUrl] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>([]);

  // イベントカテゴリ
  const [eventCategories, setEventCategories] = useState<EventCategory[]>([]);

  // 社員リストをソート（ログインユーザーを先頭に）
  const sortedEmployees = useMemo(() => {
    if (!currentEmployeeId) return employees;
    return [...employees].sort((a, b) => {
      if (a.id === currentEmployeeId) return -1;
      if (b.id === currentEmployeeId) return 1;
      return 0;
    });
  }, [employees, currentEmployeeId]);

  // カテゴリ取得
  useEffect(() => {
    const loadCategories = async () => {
      const categories = await getEventCategories();
      setEventCategories(categories);
    };
    loadCategories();
  }, []);

  // タスクが変更されたらフォームを初期化
  useEffect(() => {
    if (task && open) {
      setTitle(task.title);
      setDescription(task.description || "");
      setCategoryId("");
      // デフォルトで明日の日付を設定
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setEventDate(format(tomorrow, "yyyy-MM-dd"));
      setStartHour("");
      setStartMinute("");
      setEndHour("");
      setEndMinute("");
      setAllDay(true);
      setLocation(projectLocation || "");
      setMapUrl("");
      // タスクの担当者を参加者に設定
      if (task.assigned_to) {
        setParticipantIds([task.assigned_to]);
      } else if (currentEmployeeId) {
        setParticipantIds([currentEmployeeId]);
      } else {
        setParticipantIds([]);
      }
    }
  }, [task, open, projectLocation, currentEmployeeId]);

  const handleSubmit = async () => {
    if (!title.trim() || !eventDate || !task) return;

    startTransition(async () => {
      const startTime = allDay ? null : `${startHour || "09"}:${startMinute || "00"}:00`;
      const endTime = allDay ? null : `${endHour || "10"}:${endMinute || "00"}:00`;

      // スケジュールを作成
      const result = await createProjectEvent({
        projectId,
        title: title.trim(),
        description: description.trim(),
        date: eventDate,
        startTime,
        endTime,
        allDay,
        location: location.trim(),
        mapUrl: mapUrl.trim(),
        participantIds,
        eventCategoryId: categoryId || null,
      });

      if (result.error) {
        alert(result.error);
        return;
      }

      // タスクを削除
      await deleteTask(task.id);

      onOpenChange(false);
      router.refresh();
    });
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>タスクをスケジュールに移行</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 業務リンク表示（編集不可） */}
          <div className="flex items-center gap-2 text-sm bg-blue-50 text-blue-700 px-3 py-2 rounded-md">
            <Briefcase className="h-4 w-4" />
            <span>業務 {projectCode} にリンク中</span>
          </div>

          {/* タイトル */}
          <div className="space-y-2">
            <Label htmlFor="schedule-title">タイトル *</Label>
            <Input
              id="schedule-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="スケジュールのタイトル"
            />
          </div>

          {/* 区分 */}
          {eventCategories.length > 0 && (
            <div className="space-y-2">
              <Label>区分</Label>
              <div className="flex flex-wrap gap-2">
                {eventCategories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryId(cat.id === categoryId ? "" : cat.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm transition-colors ${
                      cat.id === categoryId
                        ? "border-primary bg-primary/10"
                        : "border-input hover:bg-muted"
                    }`}
                  >
                    <div className={`w-3 h-3 rounded ${cat.color}`} />
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 日付 */}
          <div className="space-y-2">
            <Label htmlFor="schedule-date">日付 *</Label>
            <Input
              id="schedule-date"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </div>

          {/* 終日 */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="schedule-allDay"
              checked={allDay}
              onCheckedChange={(checked) => setAllDay(!!checked)}
            />
            <Label htmlFor="schedule-allDay" className="cursor-pointer">
              終日
            </Label>
          </div>

          {/* 時刻 */}
          {!allDay && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>開始時刻</Label>
                <div className="flex items-center gap-1">
                  <select
                    className="w-16 h-9 px-2 rounded-md border text-sm"
                    value={startHour}
                    onChange={(e) => {
                      setStartHour(e.target.value);
                      if (!startMinute) setStartMinute("00");
                      if (e.target.value) {
                        const endHourNum = (parseInt(e.target.value) + 1) % 24;
                        setEndHour(String(endHourNum).padStart(2, "0"));
                        if (!endMinute) setEndMinute("00");
                      }
                    }}
                  >
                    <option value="">--</option>
                    {HOUR_OPTIONS.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <span>:</span>
                  <select
                    className="w-16 h-9 px-2 rounded-md border text-sm"
                    value={startMinute}
                    onChange={(e) => setStartMinute(e.target.value)}
                  >
                    {MINUTE_OPTIONS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>終了時刻</Label>
                <div className="flex items-center gap-1">
                  <select
                    className="w-16 h-9 px-2 rounded-md border text-sm"
                    value={endHour}
                    onChange={(e) => setEndHour(e.target.value)}
                  >
                    <option value="">--</option>
                    {HOUR_OPTIONS.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <span>:</span>
                  <select
                    className="w-16 h-9 px-2 rounded-md border text-sm"
                    value={endMinute}
                    onChange={(e) => setEndMinute(e.target.value)}
                  >
                    {MINUTE_OPTIONS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* 場所 */}
          <div className="space-y-2">
            <Label htmlFor="schedule-location">場所</Label>
            <Input
              id="schedule-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="場所"
            />
          </div>

          {/* 地図URL */}
          <div className="space-y-2">
            <Label htmlFor="schedule-mapUrl">地図URL</Label>
            <Input
              id="schedule-mapUrl"
              value={mapUrl}
              onChange={(e) => setMapUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          {/* 説明 */}
          <div className="space-y-2">
            <Label htmlFor="schedule-description">説明</Label>
            <Textarea
              id="schedule-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="詳細な説明"
              rows={3}
            />
          </div>

          {/* 参加者選択 */}
          <div className="space-y-2">
            <Label>参加者</Label>
            <div className="border rounded-md p-3 max-h-32 overflow-y-auto space-y-2">
              {sortedEmployees.map((emp) => (
                <div key={emp.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`participant-${emp.id}`}
                    checked={participantIds.includes(emp.id)}
                    onCheckedChange={(checked) => {
                      setParticipantIds((prev) =>
                        checked
                          ? [...prev, emp.id]
                          : prev.filter((id) => id !== emp.id)
                      );
                    }}
                  />
                  <Label
                    htmlFor={`participant-${emp.id}`}
                    className="cursor-pointer font-normal text-sm"
                  >
                    {emp.name}
                    {emp.id === currentEmployeeId && (
                      <span className="text-xs text-muted-foreground ml-1">(自分)</span>
                    )}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !title.trim() || !eventDate}>
            {isPending ? "移行中..." : "スケジュールに移行"}
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

export function TaskList({
  projectId,
  projectCode,
  tasks,
  employees,
  currentEmployeeId,
  defaultAssigneeId,
  projectLocation,
}: TaskListProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [localTasks, setLocalTasks] = useState(tasks);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // タスク→スケジュール移行用
  const [executingTask, setExecutingTask] = useState<Task | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

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

  // 実行ボタンが押されたらスケジュール移行モーダルを表示
  const handleExecuteTask = (task: Task) => {
    setExecutingTask(task);
    setShowScheduleModal(true);
  };

  const totalCount = localTasks.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <ListTodo className="h-5 w-5" />
            タスク
            {totalCount > 0 && (
              <Badge variant="secondary">
                {totalCount}件
              </Badge>
            )}
          </CardTitle>
          <div className="flex gap-1">
            {totalCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSaveModal(true)}
                className="h-7 px-2"
              >
                <Save className="h-3 w-3 mr-1" />
                <span className="text-xs">保存</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTemplateModal(true)}
              className="h-7 px-2"
            >
              <BookTemplate className="h-3 w-3 mr-1" />
              <span className="text-xs">読込</span>
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          →ボタンでスケジュールに移行
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {localTasks.length === 0 && (
          <p className="text-center text-muted-foreground py-4 text-sm">
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
                onExecute={handleExecuteTask}
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

      {/* タスク→スケジュール移行モーダル */}
      <TaskToScheduleModal
        task={executingTask}
        projectId={projectId}
        projectCode={projectCode}
        employees={employees}
        currentEmployeeId={currentEmployeeId}
        projectLocation={projectLocation}
        open={showScheduleModal}
        onOpenChange={(open) => {
          setShowScheduleModal(open);
          if (!open) setExecutingTask(null);
        }}
      />

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
