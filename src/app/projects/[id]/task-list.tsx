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
} from "lucide-react";
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

  const handleStatusChange = (newStatus: TaskStatus) => {
    startTransition(async () => {
      await updateTask(task.id, { status: newStatus });
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
    task.due_date && task.status !== "完了" && new Date(task.due_date) < new Date();

  return (
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
