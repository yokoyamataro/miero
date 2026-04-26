"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Plus, Info, Trash2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type PersonalTask, toggleTaskComplete, createPersonalTask, deletePersonalTask } from "./dashboard-actions";

interface DashboardProjectListProps {
  personalTasks: PersonalTask[];
  currentEmployeeId: string | null;
}

export function DashboardProjectList({
  personalTasks,
  currentEmployeeId,
}: DashboardProjectListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [newPersonalTaskTitle, setNewPersonalTaskTitle] = useState("");
  const [isAddingPersonalTask, setIsAddingPersonalTask] = useState(false);

  const handleToggleComplete = (taskId: string, currentStatus: boolean) => {
    startTransition(async () => {
      await toggleTaskComplete(taskId, !currentStatus);
      router.refresh();
    });
  };

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

  const handleDeletePersonalTask = (taskId: string) => {
    startTransition(async () => {
      await deletePersonalTask(taskId);
      router.refresh();
    });
  };

  return (
    <Card className="h-full flex flex-col">
      <div className="px-4 pt-4">
        <Link href="/projects/new">
          <Button className="w-full h-12 text-base" size="lg">
            <Plus className="h-5 w-5 mr-2" />
            新規業務登録
          </Button>
        </Link>
      </div>

      <CardContent className="flex-1 overflow-y-auto pt-4">
        {personalTasks.length === 0 && !isAddingPersonalTask ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            未完了の個人タスクはありません
          </p>
        ) : null}
        <div className="space-y-1">
          {personalTasks.map((task) => (
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
      </CardContent>
    </Card>
  );
}
