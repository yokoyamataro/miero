"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Loader2 } from "lucide-react";
import {
  type StandardTaskTemplateWithItems,
  type ProjectStandardTaskWithDetails,
  type StandardTaskStatus,
} from "@/types/database";
import {
  assignStandardTaskToProject,
  removeStandardTaskFromProject,
  updateStandardTaskProgress,
} from "./standard-task-actions";

interface StandardTaskSectionProps {
  projectId: string;
  templates: StandardTaskTemplateWithItems[];
  projectTasks: ProjectStandardTaskWithDetails[];
}

// ステータスアイコン
const getStatusIcon = (status: StandardTaskStatus) => {
  switch (status) {
    case "完了":
      return "✓";
    case "進行中":
      return "●";
    case "不要":
      return "−";
    default:
      return "○";
  }
};

// ステータス色
const getStatusColor = (status: StandardTaskStatus) => {
  switch (status) {
    case "完了":
      return "bg-green-100 text-green-700 border-green-300 hover:bg-green-200";
    case "進行中":
      return "bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200";
    case "不要":
      return "bg-gray-100 text-gray-400 border-gray-200 line-through hover:bg-gray-200";
    default:
      return "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100";
  }
};

export function StandardTaskSection({
  projectId,
  templates,
  projectTasks: initialProjectTasks,
}: StandardTaskSectionProps) {
  const [isPending, startTransition] = useTransition();
  const [projectTasks, setProjectTasks] = useState(initialProjectTasks);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  // 割り当て可能なテンプレート（まだ割り当てられていないもの）
  const assignedTemplateIds = new Set(projectTasks.map((pt) => pt.template_id));
  const availableTemplates = templates.filter(
    (t) => !assignedTemplateIds.has(t.id)
  );

  const handleAssign = () => {
    if (!selectedTemplateId) return;

    startTransition(async () => {
      const result = await assignStandardTaskToProject(projectId, selectedTemplateId);
      if (result.success) {
        window.location.reload();
      } else {
        alert(result.error || "エラーが発生しました");
      }
    });
  };

  const handleRemove = (projectStandardTaskId: string) => {
    startTransition(async () => {
      const result = await removeStandardTaskFromProject(projectStandardTaskId, projectId);
      if (result.success) {
        setProjectTasks((prev) =>
          prev.filter((pt) => pt.id !== projectStandardTaskId)
        );
      } else {
        alert(result.error || "エラーが発生しました");
      }
    });
  };

  const handleStatusChange = (
    projectStandardTaskId: string,
    itemId: string,
    status: StandardTaskStatus
  ) => {
    // 楽観的更新
    setProjectTasks((prev) =>
      prev.map((pt) => {
        if (pt.id !== projectStandardTaskId) return pt;
        return {
          ...pt,
          progress: pt.progress.map((p) =>
            p.item.id === itemId
              ? { ...p, status, updated_at: new Date().toISOString() }
              : p
          ),
        };
      })
    );

    startTransition(async () => {
      const result = await updateStandardTaskProgress(
        projectStandardTaskId,
        itemId,
        status,
        projectId
      );
      if (result.error) {
        window.location.reload();
      }
    });
  };

  // 進捗サマリーを計算
  const getProgressSummary = (task: ProjectStandardTaskWithDetails) => {
    const progress = task.progress || [];
    const total = progress.length;
    const completed = progress.filter((p) => p.status === "完了").length;
    const notNeeded = progress.filter((p) => p.status === "不要").length;
    return { total, completed, notNeeded };
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">標準業務</CardTitle>
          {availableTemplates.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAddDialog(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              追加
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {projectTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            標準業務が割り当てられていません
          </p>
        ) : (
          projectTasks.map((task) => {
            const summary = getProgressSummary(task);
            const effectiveTotal = summary.total - summary.notNeeded;

            return (
              <div key={task.id} className="border rounded-lg p-3">
                {/* ヘッダー */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{task.template.name}</span>
                    <span className="text-sm text-muted-foreground">
                      [{summary.completed}/{effectiveTotal}]
                    </span>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>標準業務の削除</AlertDialogTitle>
                        <AlertDialogDescription>
                          「{task.template.name}」を削除しますか？
                          進捗状況も削除されます。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>キャンセル</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleRemove(task.id)}>
                          削除
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                {/* バッジ一覧 */}
                <div className="flex flex-wrap gap-1.5">
                  {(task.progress || []).map((p) => (
                    <DropdownMenu key={p.item.id}>
                      <DropdownMenuTrigger asChild>
                        <button
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border cursor-pointer transition-colors ${getStatusColor(
                            p.status
                          )}`}
                        >
                          <span>{getStatusIcon(p.status)}</span>
                          <span>{p.item.title}</span>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {(["未着手", "進行中", "完了", "不要"] as StandardTaskStatus[]).map(
                          (status) => (
                            <DropdownMenuItem
                              key={status}
                              className={p.status === status ? "bg-muted font-medium" : ""}
                              onClick={() =>
                                handleStatusChange(task.id, p.item.id, status)
                              }
                            >
                              {getStatusIcon(status)} {status}
                            </DropdownMenuItem>
                          )
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </CardContent>

      {/* 追加ダイアログ */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>標準業務を追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select
              value={selectedTemplateId}
              onValueChange={setSelectedTemplateId}
            >
              <SelectTrigger>
                <SelectValue placeholder="標準業務を選択" />
              </SelectTrigger>
              <SelectContent>
                {availableTemplates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name} ({template.items.length}項目)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedTemplateId && (
              <div className="border rounded-lg p-3">
                <p className="text-sm text-muted-foreground mb-2">項目:</p>
                <div className="flex flex-wrap gap-1">
                  {templates
                    .find((t) => t.id === selectedTemplateId)
                    ?.items.map((item) => (
                      <Badge key={item.id} variant="outline" className="text-xs">
                        {item.title}
                      </Badge>
                    ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowAddDialog(false)}
              >
                キャンセル
              </Button>
              <Button
                onClick={handleAssign}
                disabled={!selectedTemplateId || isPending}
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "追加"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
