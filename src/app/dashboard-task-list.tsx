"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListTodo, User, UsersRound, GripVertical, Clock, AlertTriangle } from "lucide-react";
import { type Employee } from "@/types/database";
import { type TaskWithProject } from "./dashboard-actions";
import Link from "next/link";

interface DashboardTaskListProps {
  tasks: TaskWithProject[];
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
  employees,
  currentEmployeeId,
  onDragStart,
}: DashboardTaskListProps) {
  const [assigneeFilter, setAssigneeFilter] = useState<string>(
    currentEmployeeId || "all"
  );

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

  // 業務ごとにグループ化
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
    // 緊急を先頭に、その後はcode順にソート
    return Object.values(grouped).sort((a, b) => {
      if (a.project.is_urgent !== b.project.is_urgent) {
        return a.project.is_urgent ? -1 : 1;
      }
      return b.project.code.localeCompare(a.project.code);
    });
  }, [filteredTasks]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <ListTodo className="h-5 w-5" />
            タスク
          </CardTitle>
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="w-[140px] h-8">
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
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto pt-0">
        {tasksByProject.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            未完了のタスクはありません
          </p>
        ) : (
          <div className="space-y-4">
            {tasksByProject.map(({ project, tasks: projectTasks }) => (
              <div key={project.id}>
                {/* 業務ヘッダー */}
                <Link
                  href={`/projects/${project.id}`}
                  className="flex items-center gap-2 mb-2 hover:bg-muted px-2 py-1 rounded -mx-2"
                >
                  {project.is_urgent && (
                    <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
                  )}
                  <span className="font-mono text-xs text-muted-foreground">
                    {project.code}
                  </span>
                  <span className="font-medium text-sm truncate">
                    {project.name}
                  </span>
                </Link>

                {/* タスク一覧 */}
                <div className="space-y-1 ml-2">
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
                      <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0" />
                      <span className="text-sm truncate flex-1">{task.title}</span>
                      {task.estimated_minutes && (
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5 flex-shrink-0">
                          <Clock className="h-3 w-3" />
                          {formatHours(task.estimated_minutes)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
