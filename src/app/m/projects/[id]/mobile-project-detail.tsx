"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, User, Calendar, FolderOpen, CheckCircle2, Circle, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { PROJECT_CATEGORY_LABELS, type ProjectCategory } from "@/types/database";
import { toggleTaskComplete, createTask, updateTask, deleteTask } from "./actions";

// 閲覧履歴をlocalStorageに保存
const RECENT_PROJECTS_KEY = "miero_recent_projects";
const MAX_RECENT_PROJECTS = 10;

export function saveRecentProject(projectId: string) {
  if (typeof window === "undefined") return;

  try {
    const stored = localStorage.getItem(RECENT_PROJECTS_KEY);
    let recent: string[] = stored ? JSON.parse(stored) : [];

    // 既存の同じIDを削除
    recent = recent.filter((id) => id !== projectId);
    // 先頭に追加
    recent.unshift(projectId);
    // 最大件数に制限
    recent = recent.slice(0, MAX_RECENT_PROJECTS);

    localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(recent));
  } catch (e) {
    console.error("Error saving recent project:", e);
  }
}

export function getRecentProjectIds(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(RECENT_PROJECTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

interface Project {
  id: string;
  code: string;
  category: ProjectCategory;
  name: string;
  status: string;
  is_urgent: boolean;
  is_on_hold: boolean;
  manager_id: string | null;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  location_detail: string | null;
  notes: string | null;
  main_folder_path: string | null;
}

interface Task {
  id: string;
  title: string;
  is_completed: boolean;
  sort_order: number;
}

interface MobileProjectDetailProps {
  project: Project;
  tasks: Task[];
  customerName: string | null;
  employeeMap: Record<string, string>;
}

export function MobileProjectDetail({
  project,
  tasks,
  customerName,
  employeeMap,
}: MobileProjectDetailProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [localTasks, setLocalTasks] = useState(tasks);

  // タスク編集用state
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 閲覧履歴に保存
  useEffect(() => {
    saveRecentProject(project.id);
  }, [project.id]);

  const managerName = project.manager_id ? employeeMap[project.manager_id] : null;
  const location = [project.location, project.location_detail].filter(Boolean).join(" ");
  const categoryLabel = PROJECT_CATEGORY_LABELS[project.category] || project.category;

  const completedCount = localTasks.filter((t) => t.is_completed).length;
  const totalCount = localTasks.length;

  const handleTaskToggle = async (taskId: string, currentState: boolean) => {
    // 楽観的更新
    setLocalTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, is_completed: !currentState } : t))
    );

    startTransition(async () => {
      const result = await toggleTaskComplete(taskId, !currentState);
      if (result.error) {
        // エラー時は元に戻す
        setLocalTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, is_completed: currentState } : t))
        );
      }
    });
  };

  const handleAddTask = () => {
    setEditingTask(null);
    setTaskTitle("");
    setShowTaskForm(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setTaskTitle(task.title);
    setShowTaskForm(true);
  };

  const handleSaveTask = async () => {
    if (!taskTitle.trim()) return;

    setIsSaving(true);
    try {
      if (editingTask) {
        // 更新
        const result = await updateTask(editingTask.id, taskTitle);
        if (!result.error) {
          setLocalTasks((prev) =>
            prev.map((t) => (t.id === editingTask.id ? { ...t, title: taskTitle.trim() } : t))
          );
          setShowTaskForm(false);
        }
      } else {
        // 新規作成
        const result = await createTask(project.id, taskTitle);
        if (result.task) {
          setLocalTasks((prev) => [...prev, result.task!]);
          setShowTaskForm(false);
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!editingTask) return;
    if (!confirm("このタスクを削除しますか？")) return;

    setIsDeleting(true);
    try {
      const result = await deleteTask(editingTask.id);
      if (!result.error) {
        setLocalTasks((prev) => prev.filter((t) => t.id !== editingTask.id));
        setShowTaskForm(false);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* ヘッダー */}
      <header className="sticky top-0 bg-background border-b z-10 px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground font-mono">{project.code}</p>
            <h1 className="text-base font-bold truncate">{project.name}</h1>
          </div>
        </div>
      </header>

      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto">
        {/* 基本情報 */}
        <div className="px-4 py-4 border-b space-y-3">
          {/* バッジ */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{categoryLabel}</Badge>
            {project.is_urgent && (
              <Badge variant="destructive">重要</Badge>
            )}
            {project.is_on_hold && (
              <Badge variant="secondary">待機中</Badge>
            )}
          </div>

          {/* 顧客 */}
          {customerName && (
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{customerName}</span>
            </div>
          )}

          {/* 場所 */}
          {location && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{location}</span>
            </div>
          )}

          {/* 担当者 */}
          {managerName && (
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>担当: {managerName}</span>
            </div>
          )}

          {/* 期間 */}
          {(project.start_date || project.end_date) && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>
                {project.start_date || "---"} ~ {project.end_date || "---"}
              </span>
            </div>
          )}

          {/* Dropboxフォルダ */}
          {project.main_folder_path && (
            <div className="flex items-center gap-2 text-sm">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground truncate text-xs">
                {project.main_folder_path}
              </span>
            </div>
          )}

          {/* 備考 */}
          {project.notes && (
            <div className="mt-2 p-3 bg-muted/50 rounded-lg">
              <p className="text-sm whitespace-pre-wrap">{project.notes}</p>
            </div>
          )}
        </div>

        {/* タスク一覧 */}
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold">タスク</h2>
            <div className="flex items-center gap-2">
              {totalCount > 0 && (
                <span className="text-sm text-muted-foreground">
                  {completedCount}/{totalCount}
                </span>
              )}
              <Button size="sm" variant="outline" onClick={handleAddTask}>
                <Plus className="h-4 w-4 mr-1" />
                追加
              </Button>
            </div>
          </div>

          {localTasks.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground mb-4">
                タスクがありません
              </p>
              <Button variant="outline" onClick={handleAddTask}>
                <Plus className="h-4 w-4 mr-1" />
                タスクを追加
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {localTasks.map((task) => (
                <div
                  key={task.id}
                  className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                    task.is_completed
                      ? "bg-muted/50 border-muted"
                      : "bg-background border-border"
                  }`}
                >
                  <button
                    onClick={() => handleTaskToggle(task.id, task.is_completed)}
                    disabled={isPending}
                    className="flex-shrink-0"
                  >
                    {task.is_completed ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                  <span
                    className={`text-sm flex-1 ${
                      task.is_completed ? "line-through text-muted-foreground" : ""
                    }`}
                  >
                    {task.title}
                  </span>
                  <button
                    onClick={() => handleEditTask(task)}
                    className="p-1.5 rounded-md hover:bg-muted transition-colors flex-shrink-0"
                  >
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* タスク追加・編集シート */}
      <Sheet open={showTaskForm} onOpenChange={setShowTaskForm}>
        <SheetContent side="bottom" className="rounded-t-xl">
          <SheetHeader className="pb-4">
            <SheetTitle>
              {editingTask ? "タスクを編集" : "タスクを追加"}
            </SheetTitle>
          </SheetHeader>

          <div className="py-4">
            <Input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="タスク名"
              className="h-12"
              autoFocus
            />
          </div>

          <SheetFooter className="flex gap-2">
            {editingTask && (
              <Button
                variant="destructive"
                onClick={handleDeleteTask}
                disabled={isDeleting || isSaving}
                className="flex-1"
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
                削除
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setShowTaskForm(false)}
              className="flex-1"
            >
              キャンセル
            </Button>
            <Button
              onClick={handleSaveTask}
              disabled={isSaving || !taskTitle.trim()}
              className="flex-1"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "保存"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
