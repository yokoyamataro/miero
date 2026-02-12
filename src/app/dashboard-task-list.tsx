"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListTodo, User, UsersRound, GripVertical, Clock, AlertTriangle, Pause, ChevronDown, ChevronRight, Plus, Info, Trash2, UserCheck, Briefcase } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type Employee } from "@/types/database";
import { type TaskWithProject, type PersonalTask, toggleTaskComplete, createPersonalTask, deletePersonalTask } from "./dashboard-actions";
import Link from "next/link";

interface DashboardTaskListProps {
  tasks: TaskWithProject[];
  personalTasks: PersonalTask[];
  employees: Employee[];
  currentEmployeeId: string | null;
  onDragStart: (task: TaskWithProject) => void;
}

// 時間表示（分 → 小数時間）
function formatHours(minutes: number | null): string {
  if (minutes === null || minutes === 0) return "";
  const hours = minutes / 60;
  return `${hours.toFixed(1)}h`;
}

export function DashboardTaskList({
  tasks,
  personalTasks,
  employees,
  currentEmployeeId,
  onDragStart,
}: DashboardTaskListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [assigneeFilter, setAssigneeFilter] = useState<string>(
    currentEmployeeId || "all"
  );

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
      await createPersonalTask({
        title: newPersonalTaskTitle.trim(),
        assigned_to: currentEmployeeId,
      });
      setNewPersonalTaskTitle("");
      setIsAddingPersonalTask(false);
      router.refresh();
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

  // 折りたたまれている業務IDのSet（デフォルトで全て折りたたみ）
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(() => {
    // 初期状態で全業務を折りたたむ
    return new Set(tasks.map((t) => t.project_id));
  });

  // 個人タスクの折りたたみ状態
  const [personalTasksCollapsed, setPersonalTasksCollapsed] = useState(false);

  // タスク表示モード（業務タスク or 個人タスク）
  const [taskViewMode, setTaskViewMode] = useState<"business" | "personal">("business");

  const toggleProject = (projectId: string) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  // 社員リストをソート（ログインユーザーを先頭に）
  const sortedEmployees = useMemo(() => {
    if (!currentEmployeeId) return employees;
    return [...employees].sort((a, b) => {
      if (a.id === currentEmployeeId) return -1;
      if (b.id === currentEmployeeId) return 1;
      return 0;
    });
  }, [employees, currentEmployeeId]);

  // フィルタリングされたタスク
  const filteredTasks = useMemo(() => {
    if (assigneeFilter === "all") {
      return tasks;
    }
    // 担当者が一致するか、担当者未設定のタスクも表示
    return tasks.filter((task) =>
      task.assigned_to === assigneeFilter || task.assigned_to === null
    );
  }, [tasks, assigneeFilter]);

  // フィルタリングされた個人タスク
  const filteredPersonalTasks = useMemo(() => {
    if (assigneeFilter === "all") {
      return personalTasks;
    }
    return personalTasks.filter((task) =>
      task.assigned_to === assigneeFilter || task.assigned_to === null
    );
  }, [personalTasks, assigneeFilter]);

  // 業務ごとにグループ化（関連業務が連続するようにソート）
  const tasksByProject = useMemo(() => {
    const grouped: Record<string, { project: TaskWithProject["project"]; tasks: TaskWithProject[] }> = {};
    for (const task of filteredTasks) {
      if (!grouped[task.project_id]) {
        grouped[task.project_id] = {
          project: task.project,
          tasks: [],
        };
      }
      grouped[task.project_id].tasks.push(task);
    }

    const projectEntries = Object.values(grouped);

    // 訪問済みの業務IDセット
    const visited = new Set<string>();
    const result: typeof projectEntries = [];

    // 関連業務を深さ優先で収集する関数
    const collectRelatedProjects = (projectId: string, entries: typeof projectEntries) => {
      if (visited.has(projectId)) return;

      const entry = entries.find((e) => e.project.id === projectId);
      if (!entry) return;

      visited.add(projectId);
      result.push(entry);

      // 関連業務を再帰的に追加（code降順でソート）
      const relatedIds = entry.project.relatedProjectIds || [];
      const relatedEntries = relatedIds
        .map((id) => entries.find((e) => e.project.id === id))
        .filter((e): e is NonNullable<typeof e> => e !== undefined && !visited.has(e.project.id))
        .sort((a, b) => b.project.code.localeCompare(a.project.code));

      for (const relatedEntry of relatedEntries) {
        collectRelatedProjects(relatedEntry.project.id, entries);
      }
    };

    // 緊急を先頭に、待機を最後に、その後はcode順にソート
    const sortedEntries = [...projectEntries].sort((a, b) => {
      // 緊急を先頭に
      if (a.project.is_urgent !== b.project.is_urgent) {
        return a.project.is_urgent ? -1 : 1;
      }
      // 待機を最後に
      if (a.project.is_on_hold !== b.project.is_on_hold) {
        return a.project.is_on_hold ? 1 : -1;
      }
      return b.project.code.localeCompare(a.project.code);
    });

    // ソート順に関連業務を収集
    for (const entry of sortedEntries) {
      collectRelatedProjects(entry.project.id, sortedEntries);
    }

    return result;
  }, [filteredTasks]);

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
            <Tabs value={taskViewMode} onValueChange={(v) => setTaskViewMode(v as "business" | "personal")}>
              <TabsList className="h-8">
                <TabsTrigger value="business" className="text-sm px-3 h-7 gap-1">
                  <Briefcase className="h-4 w-4" />
                  業務タスク
                </TabsTrigger>
                <TabsTrigger value="personal" className="text-sm px-3 h-7 gap-1">
                  <UserCheck className="h-4 w-4" />
                  個人タスク
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="w-[196px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <span className="flex items-center gap-2">
                    <UsersRound className="h-4 w-4" />
                    全員
                  </span>
                </SelectItem>
                {sortedEmployees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    <span className="flex items-center gap-2">
                      <User className="h-4 w-4 opacity-50" />
                      {emp.name}
                      {emp.id === currentEmployeeId && (
                        <span className="text-xs text-muted-foreground">(自分)</span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto pt-0">
        <div className="space-y-2">
          {/* 業務タスク */}
          {taskViewMode === "business" && (
            <>
              {tasksByProject.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  未完了の業務タスクはありません
                </p>
              ) : (
                tasksByProject.map(({ project, tasks: projectTasks }) => {
                const isCollapsed = collapsedProjects.has(project.id);
                // 背景色: 緊急=赤系、待機=グレー系
                const projectBgClass = project.is_urgent
                  ? "bg-red-50 rounded-md"
                  : project.is_on_hold
                  ? "bg-gray-100 rounded-md"
                  : "";
                return (
                  <Collapsible
                    key={project.id}
                    open={!isCollapsed}
                    onOpenChange={() => toggleProject(project.id)}
                    className={projectBgClass}
                  >
                    {/* 業務ヘッダー */}
                    <div className="flex items-center gap-1 group p-1">
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 flex-shrink-0"
                        >
                          {isCollapsed ? (
                            <ChevronRight className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <Link
                        href={`/projects/${project.id}`}
                        className="flex items-center gap-2 flex-1 min-w-0 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {project.is_urgent && (
                          <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
                        )}
                        {project.is_on_hold && (
                          <Pause className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <span className="font-mono text-xs text-muted-foreground flex-shrink-0">
                          {project.code}
                        </span>
                        <span className={`font-medium text-sm truncate ${project.is_on_hold ? "text-muted-foreground" : ""}`}>
                          {project.name}
                        </span>
                      </Link>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        ({projectTasks.length})
                      </span>
                    </div>

                    {/* タスク一覧 */}
                    <CollapsibleContent>
                      <div className="space-y-1 ml-7 mt-1">
                        {projectTasks.map((task) => (
                          <div
                            key={task.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/plain", JSON.stringify({
                                taskId: task.id,
                                projectId: task.project_id,
                                projectCode: project.code,
                                projectName: project.name,
                                projectLocation: project.location,
                                taskTitle: task.title,
                              }));
                              onDragStart(task);
                            }}
                            className="flex items-center gap-2 px-2 py-1.5 rounded border bg-background hover:bg-muted cursor-grab active:cursor-grabbing group"
                          >
                            <Checkbox
                              checked={task.is_completed}
                              onCheckedChange={() => handleToggleComplete(task.id, task.is_completed)}
                              disabled={isPending}
                              className="flex-shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0" />
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
                            {task.estimated_minutes && (
                              <span className="text-xs text-muted-foreground flex items-center gap-0.5 flex-shrink-0">
                                <Clock className="h-3 w-3" />
                                {formatHours(task.estimated_minutes)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })
              )}
            </>
          )}

          {/* 個人タスク */}
          {taskViewMode === "personal" && (
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
                    {task.estimated_minutes && (
                      <span className="text-xs text-muted-foreground flex items-center gap-0.5 flex-shrink-0">
                        <Clock className="h-3 w-3" />
                        {formatHours(task.estimated_minutes)}
                      </span>
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
