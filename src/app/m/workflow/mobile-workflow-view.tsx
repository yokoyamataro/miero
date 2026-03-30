"use client";

import { useState } from "react";
import Link from "next/link";
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
import { Card, CardContent } from "@/components/ui/card";
import type { StandardTaskItem, StandardTaskStatus } from "@/types/database";
import type { WorkflowProject } from "@/app/workflow/actions";
import {
  getWorkflowProjects,
  getTemplateItems,
  updateWorkflowStatus,
} from "@/app/workflow/actions";

interface MobileWorkflowViewProps {
  templates: { id: string; name: string }[];
  initialTemplateId: string | null;
  initialItems: StandardTaskItem[];
  initialProjects: WorkflowProject[];
}

// ステータスアイコン
const getStatusIcon = (status: StandardTaskStatus) => {
  switch (status) {
    case "完了":
      return "✓";
    case "進行中":
      return "▷";
    case "不要":
      return "−";
    default:
      return "□";
  }
};

// ステータス色
const getStatusColor = (status: StandardTaskStatus) => {
  switch (status) {
    case "完了":
      return "bg-green-100 text-green-700 border-green-300";
    case "進行中":
      return "bg-yellow-100 text-yellow-700 border-yellow-300";
    case "不要":
      return "bg-gray-100 text-gray-400 border-gray-200 line-through";
    default:
      return "bg-blue-100 text-blue-700 border-blue-300";
  }
};

export function MobileWorkflowView({
  templates,
  initialTemplateId,
  initialItems,
  initialProjects,
}: MobileWorkflowViewProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    initialTemplateId || ""
  );
  const [items, setItems] = useState(initialItems);
  const [projects, setProjects] = useState(initialProjects);

  const handleTemplateChange = async (templateId: string) => {
    setSelectedTemplateId(templateId);
    setIsLoading(true);

    try {
      const [newItems, newProjects] = await Promise.all([
        getTemplateItems(templateId),
        getWorkflowProjects(templateId),
      ]);
      setItems(newItems);
      setProjects(newProjects);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (
    projectIndex: number,
    projectStandardTaskId: string,
    itemId: string,
    status: StandardTaskStatus
  ) => {
    // 楽観的更新
    setProjects((prev) =>
      prev.map((project, idx) => {
        if (idx !== projectIndex) return project;
        return {
          ...project,
          progress: (project.progress || []).map((p) =>
            p.item_id === itemId ? { ...p, status } : p
          ),
        };
      })
    );

    const result = await updateWorkflowStatus(
      projectStandardTaskId,
      itemId,
      status
    );
    if (result.error) {
      window.location.reload();
    }
  };

  // 進捗サマリーを計算
  const getProgressSummary = (project: WorkflowProject) => {
    const progress = project.progress || [];
    const total = progress.length;
    const completed = progress.filter((p) => p.status === "完了").length;
    const notNeeded = progress.filter((p) => p.status === "不要").length;
    return { total, completed, effectiveTotal: total - notNeeded };
  };

  return (
    <div className="flex flex-col h-full">
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <h1 className="text-lg font-bold mb-2">工程管理</h1>
        <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="標準業務を選択" />
          </SelectTrigger>
          <SelectContent>
            {templates.map((template) => (
              <SelectItem key={template.id} value={template.id}>
                {template.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!selectedTemplateId ? (
          <p className="text-center text-muted-foreground py-8">
            標準業務を選択してください
          </p>
        ) : isLoading ? (
          <p className="text-center text-muted-foreground py-8">読み込み中...</p>
        ) : projects.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            この標準業務が割り当てられている
            <br />
            進行中の業務はありません
          </p>
        ) : (
          projects.map((project, projectIndex) => {
            const summary = getProgressSummary(project);

            return (
              <Card key={project.id}>
                <CardContent className="p-3">
                  {/* プロジェクト情報 */}
                  <div className="flex items-start justify-between mb-2">
                    <Link
                      href={`/m/projects/${project.id}`}
                      className="flex-1 min-w-0"
                    >
                      <div className="font-medium text-sm truncate text-primary">
                        {project.name}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {project.code && <span>{project.code}</span>}
                        {project.manager_name && (
                          <span>担当: {project.manager_name}</span>
                        )}
                      </div>
                    </Link>
                    <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap">
                      [{summary.completed}/{summary.effectiveTotal}]
                    </span>
                  </div>

                  {/* 工程バッジ */}
                  <div className="flex flex-wrap gap-1.5">
                    {(project.progress || []).map((p) => (
                      <DropdownMenu key={p.item_id}>
                        <DropdownMenuTrigger asChild>
                          <button
                            className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border cursor-pointer transition-colors ${getStatusColor(
                              p.status
                            )}`}
                            disabled={isLoading}
                          >
                            <span>{getStatusIcon(p.status)}</span>
                            <span>{p.item_title}</span>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {(
                            ["未着手", "進行中", "完了", "不要"] as StandardTaskStatus[]
                          ).map((status) => (
                            <DropdownMenuItem
                              key={status}
                              className={
                                p.status === status ? "bg-muted font-medium" : ""
                              }
                              onClick={() =>
                                handleStatusChange(
                                  projectIndex,
                                  project.project_standard_task_id,
                                  p.item_id,
                                  status
                                )
                              }
                            >
                              {getStatusIcon(status)} {status}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* 凡例 */}
      {selectedTemplateId && projects.length > 0 && (
        <div className="border-t bg-background px-4 py-2">
          <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block w-4 h-4 bg-blue-100 text-blue-700 text-center rounded text-[10px]">
                □
              </span>
              未着手
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-4 h-4 bg-yellow-100 text-yellow-700 text-center rounded text-[10px]">
                ▷
              </span>
              進行中
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-4 h-4 bg-green-100 text-green-700 text-center rounded text-[10px]">
                ✓
              </span>
              完了
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-4 h-4 bg-gray-100 text-gray-400 text-center rounded text-[10px]">
                −
              </span>
              不要
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
