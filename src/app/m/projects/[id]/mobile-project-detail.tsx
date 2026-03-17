"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, User, Calendar, FolderOpen, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { PROJECT_CATEGORY_LABELS, type ProjectCategory } from "@/types/database";
import { toggleTaskComplete } from "./actions";

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
            {totalCount > 0 && (
              <span className="text-sm text-muted-foreground">
                {completedCount}/{totalCount} 完了
              </span>
            )}
          </div>

          {localTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              タスクがありません
            </p>
          ) : (
            <div className="space-y-2">
              {localTasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => handleTaskToggle(task.id, task.is_completed)}
                  disabled={isPending}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                    task.is_completed
                      ? "bg-muted/50 border-muted"
                      : "bg-background border-border hover:bg-muted/30"
                  }`}
                >
                  {task.is_completed ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  )}
                  <span
                    className={`text-sm flex-1 ${
                      task.is_completed ? "line-through text-muted-foreground" : ""
                    }`}
                  >
                    {task.title}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
