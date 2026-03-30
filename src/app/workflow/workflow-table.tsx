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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      return "bg-orange-100 text-orange-700";
    case "進行中":
      return "bg-yellow-100 text-yellow-700";
    case "不要":
      return "bg-gray-100 text-gray-400 line-through";
    default:
      return "bg-blue-100 text-blue-700";
  }
};

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

    const result = await updateWorkflowStatus(projectStandardTaskId, itemId, status);
    if (result.error) {
      // エラー時はリロード
      window.location.reload();
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>工程表</CardTitle>
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
      </CardHeader>
      <CardContent>
        {!selectedTemplateId ? (
          <p className="text-center text-muted-foreground py-8">
            標準業務を選択してください
          </p>
        ) : projects.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            この標準業務が割り当てられている進行中の業務はありません
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10 min-w-[200px]">
                    業務
                  </TableHead>
                  {items.map((item) => (
                    <TableHead
                      key={item.id}
                      className="text-center min-w-[60px] text-xs"
                    >
                      {item.title}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project, projectIndex) => (
                  <TableRow key={project.id}>
                    <TableCell className="sticky left-0 bg-background z-10">
                      <Link
                        href={`/projects/${project.id}`}
                        className="text-primary hover:underline"
                      >
                        <span className="font-medium">
                          {project.code && <span className="text-muted-foreground mr-1">{project.code}</span>}
                          {project.name}
                        </span>
                      </Link>
                    </TableCell>
                    {items.map((item) => {
                      const progressItem = (project.progress || []).find(
                        (p) => p.item_id === item.id
                      );
                      const status = progressItem?.status || "未着手";

                      return (
                        <TableCell
                          key={item.id}
                          className={`text-center p-0 ${getStatusCellClass(status)}`}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="w-full h-full py-2 px-1 cursor-pointer hover:opacity-80 transition-opacity"
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
                                        projectIndex,
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
          <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block w-5 h-5 bg-blue-100 text-blue-700 text-center rounded">□</span>
              未着手
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-5 h-5 bg-yellow-100 text-yellow-700 text-center rounded">▷</span>
              進行中
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-5 h-5 bg-orange-100 text-orange-700 text-center rounded">✓</span>
              完了
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-5 h-5 bg-gray-100 text-gray-400 text-center rounded">−</span>
              不要
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
