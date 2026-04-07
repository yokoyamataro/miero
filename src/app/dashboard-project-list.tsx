"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GripVertical, AlertTriangle, Pause, Plus, Info, Trash2, UserCheck, Briefcase, FolderOpen, Layers } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type Employee, type ProjectCategory, PROJECT_CATEGORY_LABELS } from "@/types/database";
import { type ActiveProject, type PersonalTask, toggleTaskComplete, createPersonalTask, deletePersonalTask } from "./dashboard-actions";

interface DashboardProjectListProps {
  activeProjects: ActiveProject[];
  personalTasks: PersonalTask[];
  employees: Employee[];
  currentEmployeeId: string | null;
}

// カテゴリの表示順序
const CATEGORY_ORDER: ProjectCategory[] = [
  "A_Survey",
  "B_Boundary",
  "C_Registration",
  "D_Inheritance",
  "E_Corporate",
  "F_Drone",
  "N_Farmland",
  "S_General",
  "Z_Other",
];

export function DashboardProjectList({
  activeProjects,
  personalTasks,
  employees,
  currentEmployeeId,
}: DashboardProjectListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // 個人タスク追加用
  const [newPersonalTaskTitle, setNewPersonalTaskTitle] = useState("");
  const [isAddingPersonalTask, setIsAddingPersonalTask] = useState(false);

  // タスク完了トグル
  const handleToggleComplete = (taskId: string, currentStatus: boolean) => {
    startTransition(async () => {
      await toggleTaskComplete(taskId, !currentStatus);
      router.refresh();
    });
  };

  // 個人タスク追加
  const handleAddPersonalTask = () => {
    if (!newPersonalTaskTitle.trim()) return;
    startTransition(async () => {
      const result = await createPersonalTask({
        title: newPersonalTaskTitle.trim(),
        assigned_to: currentEmployeeId,
      });
      if (result.error) {
        console.error("Error creating personal task:", result.error);
        return;
      }
      setNewPersonalTaskTitle("");
      setIsAddingPersonalTask(false);
      window.location.reload();
    });
  };

  // 個人タスク削除
  const handleDeletePersonalTask = (taskId: string) => {
    startTransition(async () => {
      await deletePersonalTask(taskId);
      router.refresh();
    });
  };

  // タスク表示モード（業務 or 個人タスク）
  const [viewMode, setViewMode] = useState<"business" | "personal">("business");

  // 存在するカテゴリのリストを取得
  const availableCategories = useMemo(() => {
    const categories = new Set(activeProjects.map((p) => p.category));
    return CATEGORY_ORDER.filter((cat) => categories.has(cat));
  }, [activeProjects]);

  // フィルタリングされた業務
  const filteredProjects = useMemo(() => {
    if (categoryFilter === "all") {
      return activeProjects;
    }
    return activeProjects.filter((project) => project.category === categoryFilter);
  }, [activeProjects, categoryFilter]);

  // ソート済み業務（緊急→通常→待機、code降順）
  const sortedProjects = useMemo(() => {
    return [...filteredProjects].sort((a, b) => {
      // 緊急を先頭に
      if (a.is_urgent !== b.is_urgent) {
        return a.is_urgent ? -1 : 1;
      }
      // 待機を最後に
      if (a.is_on_hold !== b.is_on_hold) {
        return a.is_on_hold ? 1 : -1;
      }
      return b.code.localeCompare(a.code);
    });
  }, [filteredProjects]);

  // 個人タスク（カテゴリフィルターは適用しない）
  const filteredPersonalTasks = useMemo(() => {
    return personalTasks;
  }, [personalTasks]);

  return (
    <Card className="h-full flex flex-col">
      {/* 新規業務登録ボタン */}
      <div className="px-4 pt-4">
        <Link href="/projects/new">
          <Button className="w-full h-12 text-base" size="lg">
            <Plus className="h-5 w-5 mr-2" />
            新規業務登録
          </Button>
        </Link>
      </div>

      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "business" | "personal")}>
              <TabsList className="h-8">
                <TabsTrigger value="business" className="text-sm px-3 h-7 gap-1">
                  <Briefcase className="h-4 w-4" />
                  業務
                </TabsTrigger>
                <TabsTrigger value="personal" className="text-sm px-3 h-7 gap-1">
                  <UserCheck className="h-4 w-4" />
                  個人タスク
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <span className="flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    全カテゴリ
                  </span>
                </SelectItem>
                {availableCategories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    <span className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 opacity-50" />
                      {PROJECT_CATEGORY_LABELS[cat]}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto pt-0">
        <div className="space-y-1">
          {/* 業務一覧 */}
          {viewMode === "business" && (
            <>
              {sortedProjects.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  進行中の業務はありません
                </p>
              ) : (
                sortedProjects.map((project) => {
                  // 背景色: 緊急=赤系、待機=グレー系
                  const projectBgClass = project.is_urgent
                    ? "bg-red-50"
                    : project.is_on_hold
                    ? "bg-gray-100"
                    : "";
                  return (
                    <div
                      key={project.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", JSON.stringify({
                          projectId: project.id,
                          projectCode: project.code,
                          projectName: project.name,
                          projectLocation: project.location,
                        }));
                      }}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded border bg-background hover:bg-muted cursor-grab active:cursor-grabbing group ${projectBgClass}`}
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0" />
                      {project.is_urgent && (
                        <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
                      )}
                      {project.is_on_hold && (
                        <Pause className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <Link
                        href={`/projects/${project.id}`}
                        className="flex items-center gap-2 flex-1 min-w-0 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="font-mono text-xs text-muted-foreground flex-shrink-0">
                          {project.code}
                        </span>
                        <span className={`text-sm truncate ${project.is_on_hold ? "text-muted-foreground" : ""}`}>
                          {project.name}
                        </span>
                      </Link>
                    </div>
                  );
                })
              )}
            </>
          )}

          {/* 個人タスク */}
          {viewMode === "personal" && (
            <>
              {filteredPersonalTasks.length === 0 && !isAddingPersonalTask ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  未完了の個人タスクはありません
                </p>
              ) : null}
              <div className="space-y-1">
                {filteredPersonalTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded border bg-background hover:bg-muted group"
                  >
                    <Checkbox
                      checked={task.is_completed}
                      onCheckedChange={() => handleToggleComplete(task.id, task.is_completed)}
                      disabled={isPending}
                      className="flex-shrink-0"
                    />
                    <span className="text-sm truncate flex-1">{task.title}</span>
                    {task.description && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="text-sm whitespace-pre-wrap">{task.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 flex-shrink-0 text-destructive hover:text-destructive"
                      onClick={() => handleDeletePersonalTask(task.id)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}

                {/* 個人タスク追加フォーム */}
                {isAddingPersonalTask ? (
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    <Input
                      type="text"
                      placeholder="タスク名を入力..."
                      value={newPersonalTaskTitle}
                      onChange={(e) => setNewPersonalTaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleAddPersonalTask();
                        } else if (e.key === "Escape") {
                          setIsAddingPersonalTask(false);
                          setNewPersonalTaskTitle("");
                        }
                      }}
                      className="h-8 text-sm flex-1"
                      autoFocus
                      disabled={isPending}
                    />
                    <Button
                      size="sm"
                      className="h-8"
                      onClick={handleAddPersonalTask}
                      disabled={isPending || !newPersonalTaskTitle.trim()}
                    >
                      追加
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8"
                      onClick={() => {
                        setIsAddingPersonalTask(false);
                        setNewPersonalTaskTitle("");
                      }}
                      disabled={isPending}
                    >
                      キャンセル
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-muted-foreground h-8"
                    onClick={() => setIsAddingPersonalTask(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    個人タスクを追加
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
