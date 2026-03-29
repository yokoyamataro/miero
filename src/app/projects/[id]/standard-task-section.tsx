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
import { Plus, Trash2, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import {
  type StandardTaskTemplateWithItems,
  type ProjectStandardTaskWithDetails,
  type StandardTaskStatus,
  STANDARD_TASK_STATUS_COLORS,
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

export function StandardTaskSection({
  projectId,
  templates,
  projectTasks: initialProjectTasks,
}: StandardTaskSectionProps) {
  const [isPending, startTransition] = useTransition();
  const [projectTasks, setProjectTasks] = useState(initialProjectTasks);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(
    new Set(initialProjectTasks.map((t) => t.id))
  );

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
        // ページをリロードして最新データを取得
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
        // エラー時はリロードして正しい状態に戻す
        window.location.reload();
      }
    });
  };

  const toggleExpand = (taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  // 進捗サマリーを計算
  const getProgressSummary = (task: ProjectStandardTaskWithDetails) => {
    const total = task.progress.length;
    const completed = task.progress.filter((p) => p.status === "完了").length;
    const inProgress = task.progress.filter((p) => p.status === "進行中").length;
    const notNeeded = task.progress.filter((p) => p.status === "不要").length;
    return { total, completed, inProgress, notNeeded };
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
            const isExpanded = expandedTasks.has(task.id);
            const summary = getProgressSummary(task);

            return (
              <div key={task.id} className="border rounded-lg">
                {/* ヘッダー */}
                <div
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50"
                  onClick={() => toggleExpand(task.id)}
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-medium">{task.template.name}</span>
                    <span className="text-sm text-muted-foreground">
                      ({summary.completed}/{summary.total - summary.notNeeded})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* 進捗バー */}
                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 transition-all"
                        style={{
                          width: `${
                            summary.total - summary.notNeeded > 0
                              ? (summary.completed /
                                  (summary.total - summary.notNeeded)) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
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
                          <AlertDialogAction
                            onClick={() => handleRemove(task.id)}
                          >
                            削除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                {/* 項目一覧 */}
                {isExpanded && (
                  <div className="border-t px-3 py-2 space-y-2">
                    {task.progress.map((p) => (
                      <div
                        key={p.item.id}
                        className="flex items-center justify-between gap-2 py-1"
                      >
                        <span
                          className={`text-sm ${
                            p.status === "完了"
                              ? "text-muted-foreground line-through"
                              : p.status === "不要"
                              ? "text-muted-foreground"
                              : ""
                          }`}
                        >
                          {p.item.title}
                        </span>
                        <Select
                          value={p.status}
                          onValueChange={(value) =>
                            handleStatusChange(
                              task.id,
                              p.item.id,
                              value as StandardTaskStatus
                            )
                          }
                        >
                          <SelectTrigger className="w-24 h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="未着手">未着手</SelectItem>
                            <SelectItem value="進行中">進行中</SelectItem>
                            <SelectItem value="完了">完了</SelectItem>
                            <SelectItem value="不要">不要</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                )}
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
