"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GripVertical } from "lucide-react";
import type { StandardTaskItem, StandardTaskStatus } from "@/types/database";
import type { WorkflowProject } from "./actions";
import { getWorkflowProjects, getTemplateItems, updateWorkflowStatus } from "./actions";

interface WorkflowTableProps {
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

// ステータス色（セル用）
const getStatusCellClass = (status: StandardTaskStatus) => {
  switch (status) {
    case "完了":
      return "bg-green-100 text-green-700";
    case "進行中":
      return "bg-yellow-100 text-yellow-700";
    case "不要":
      return "bg-gray-100 text-gray-400 line-through";
    default:
      return "bg-blue-100 text-blue-700";
  }
};

// localStorage キー
const getStorageKey = (templateId: string) => `workflowProjectOrder_${templateId}`;

export function WorkflowTable({
  templates,
  initialTemplateId,
  initialItems,
  initialProjects,
}: WorkflowTableProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(initialTemplateId || "");
  const [items, setItems] = useState(initialItems);
  const [projects, setProjects] = useState(initialProjects);
  const [projectOrder, setProjectOrder] = useState<string[]>([]);
  const [draggingProjectId, setDraggingProjectId] = useState<string | null>(null);

  // localStorageから順序を読み込み
  useEffect(() => {
    if (!selectedTemplateId) return;
    const saved = localStorage.getItem(getStorageKey(selectedTemplateId));
    if (saved) {
      try {
        setProjectOrder(JSON.parse(saved));
      } catch {
        setProjectOrder([]);
      }
    } else {
      setProjectOrder([]);
    }
  }, [selectedTemplateId]);

  // 順序を保存
  const saveProjectOrder = useCallback((order: string[]) => {
    if (!selectedTemplateId) return;
    setProjectOrder(order);
    localStorage.setItem(getStorageKey(selectedTemplateId), JSON.stringify(order));
  }, [selectedTemplateId]);

  // ソートされた業務リスト
  const sortedProjects = useMemo(() => {
    if (projectOrder.length === 0) return projects;
    return [...projects].sort((a, b) => {
      const indexA = projectOrder.indexOf(a.id);
      const indexB = projectOrder.indexOf(b.id);
      // 順序に含まれない業務は末尾に
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [projects, projectOrder]);

  // ドラッグ開始
  const handleDragStart = useCallback((projectId: string) => {
    setDraggingProjectId(projectId);
  }, []);

  // ドロップ
  const handleDrop = useCallback((targetProjectId: string) => {
    if (!draggingProjectId || draggingProjectId === targetProjectId) {
      setDraggingProjectId(null);
      return;
    }

    const currentOrder = projectOrder.length > 0
      ? [...projectOrder]
      : sortedProjects.map(p => p.id);

    const dragIndex = currentOrder.indexOf(draggingProjectId);
    const dropIndex = currentOrder.indexOf(targetProjectId);

    if (dragIndex === -1 || dropIndex === -1) {
      setDraggingProjectId(null);
      return;
    }

    // 並び替え
    currentOrder.splice(dragIndex, 1);
    currentOrder.splice(dropIndex, 0, draggingProjectId);

    saveProjectOrder(currentOrder);
    setDraggingProjectId(null);
  }, [draggingProjectId, projectOrder, sortedProjects, saveProjectOrder]);

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
    projectId: string,
    projectStandardTaskId: string,
    itemId: string,
    status: StandardTaskStatus
  ) => {
    // 楽観的更新
    setProjects((prev) =>
      prev.map((project) => {
        if (project.id !== projectId) return project;
        return {
          ...project,
          progress: (project.progress || []).map((p) =>
            p.item_id === itemId ? { ...p, status } : p
          ),
        };
      })
    );

    const result = await updateWorkflowStatus(projectStandardTaskId, itemId, status);
    if (result.error) {
      // エラー時はリロード
      window.location.reload();
    }
  };

  return (
    <div className="space-y-4">
      {/* ヘッダー：タイトルとプルダウン */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">工程表</h1>
        <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
          <SelectTrigger className="w-[200px]">
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
      </div>

      {/* テーブル */}
      {!selectedTemplateId ? (
        <p className="text-center text-muted-foreground py-8">
          標準業務を選択してください
        </p>
      ) : projects.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          この標準業務が割り当てられている進行中の業務はありません
        </p>
      ) : (
        <div className="overflow-auto border rounded-lg">
          <Table>
            <TableHeader className="sticky top-0 bg-muted z-20">
              <TableRow className="h-8">
                <TableHead className="sticky left-0 bg-muted z-30 min-w-[200px] py-1 text-xs whitespace-nowrap">
                  業務
                </TableHead>
                {items.map((item) => (
                  <TableHead
                    key={item.id}
                    className="text-center min-w-[40px] text-[10px] bg-muted py-1 px-1 whitespace-nowrap"
                  >
                    {item.title}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedProjects.map((project) => (
                <TableRow
                  key={project.id}
                  draggable
                  onDragStart={() => handleDragStart(project.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(project.id)}
                  className={`h-7 ${draggingProjectId === project.id ? "opacity-50 bg-primary/10" : ""}`}
                >
                  <TableCell className="sticky left-0 bg-background z-10 py-0 px-1 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <GripVertical className="h-3 w-3 text-muted-foreground cursor-grab flex-shrink-0" />
                      <Link
                        href={`/projects/${project.id}`}
                        className="text-primary hover:underline text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {project.code && <span className="text-muted-foreground mr-1">{project.code}</span>}
                        {project.name}
                      </Link>
                    </div>
                  </TableCell>
                  {items.map((item) => {
                    const progressItem = (project.progress || []).find(
                      (p) => p.item_id === item.id
                    );
                    const status = progressItem?.status || "未着手";

                    return (
                      <TableCell
                        key={item.id}
                        className={`text-center p-0 text-xs ${getStatusCellClass(status)}`}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="w-full h-full py-1 px-1 cursor-pointer hover:opacity-80 transition-opacity"
                              disabled={isLoading}
                            >
                              {getStatusIcon(status)}
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="center">
                          {(["未着手", "進行中", "完了", "不要"] as StandardTaskStatus[]).map(
                            (s) => (
                              <DropdownMenuItem
                                key={s}
                                className={status === s ? "bg-muted font-medium" : ""}
                                onClick={() =>
                                  handleStatusChange(
                                    project.id,
                                    project.project_standard_task_id,
                                    item.id,
                                    s
                                  )
                                }
                              >
                                {getStatusIcon(s)} {s}
                              </DropdownMenuItem>
                            )
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
            </Table>
          </div>
        )}

        {/* 凡例 */}
        {selectedTemplateId && projects.length > 0 && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block w-4 h-4 bg-blue-100 text-blue-700 text-center rounded text-[10px]">□</span>
              未着手
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-4 h-4 bg-yellow-100 text-yellow-700 text-center rounded text-[10px]">▷</span>
              進行中
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-4 h-4 bg-green-100 text-green-700 text-center rounded text-[10px]">✓</span>
              完了
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-4 h-4 bg-gray-100 text-gray-400 text-center rounded text-[10px]">−</span>
              不要
            </span>
          </div>
        )}
    </div>
  );
}
