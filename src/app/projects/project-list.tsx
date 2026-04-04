"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { ArrowUp, ArrowDown, GripVertical } from "lucide-react";
import {
  PROJECT_STATUS_COLORS,
  type ProjectCategory,
  type ProjectStatus,
  type StandardTaskItem,
  type StandardTaskStatus,
} from "@/types/database";
import { ProjectFilters, type FilterState, NULL_MARKER, ALL_MARKER } from "./project-filters";
import type { WorkflowProject } from "@/app/workflow/actions";

// ソート用の型
type SortKey = "code" | "status" | "customer" | "name" | "location" | "manager" | "start_date" | "end_date";

// 日付フォーマット（YYYY/MM/DD形式）
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

interface SortState {
  key: SortKey | null;
  order: "asc" | "desc";
}

// LocalStorage キー
const FILTER_STORAGE_KEY = "projectListFilters";
// ソート状態はセッション限定（ページリロードでリセット）

interface ProjectData {
  id: string;
  code: string;
  category: string;
  name: string;
  status: string;
  is_urgent: boolean;
  is_on_hold: boolean;
  contact_id: string | null;
  account_id: string | null;
  manager_id: string | null;
  start_date: string | null;
  end_date: string | null;
  fee_tax_excluded: number | null;
  location: string | null;
  location_detail: string | null;
}

interface WorkflowTemplate {
  id: string;
  name: string;
}

interface ProjectListProps {
  projects: ProjectData[];
  contactDisplayMap: Record<string, string>;
  accountDisplayMap: Record<string, string>;
  employeeMap: Record<string, string>;
  recentProjectIds: string[]; // 2週間以内の閲覧履歴（最新順）
  standardTasksMap: Record<string, string[]>; // project_id → テンプレート名の配列
  workflowTemplates: WorkflowTemplate[];
  onLoadWorkflowData?: (templateId: string) => Promise<{
    items: StandardTaskItem[];
    projects: WorkflowProject[];
  }>;
  onUpdateWorkflowStatus?: (
    projectStandardTaskId: string,
    itemId: string,
    status: StandardTaskStatus
  ) => Promise<{ success?: boolean; error?: string }>;
}

// デフォルトのフィルター状態
const DEFAULT_FILTERS: FilterState = {
  search: "",
  category: ALL_MARKER,
  includeCompleted: false,
  workflowTemplateId: null,
};

// フィルター状態をlocalStorageから読み込む
function loadFiltersFromStorage(): FilterState {
  if (typeof window === "undefined") {
    return DEFAULT_FILTERS;
  }
  try {
    const saved = localStorage.getItem(FILTER_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        search: parsed.search || "",
        category: parsed.category || ALL_MARKER,
        includeCompleted: parsed.includeCompleted || false,
        workflowTemplateId: parsed.workflowTemplateId || null,
      };
    }
  } catch {
    // ignore
  }
  return DEFAULT_FILTERS;
}


// 工程表用のヘルパー関数
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

const getLocationWithoutLotNumber = (location: string | null): string => {
  if (!location) return "";
  const lastSpaceIndex = location.lastIndexOf(" ");
  if (lastSpaceIndex === -1) return location;
  return location.substring(0, lastSpaceIndex);
};

const calculateProgress = (progress: { status: StandardTaskStatus }[]): number => {
  const validItems = progress.filter(p => p.status !== "不要");
  if (validItems.length === 0) return 0;
  const completedItems = validItems.filter(p => p.status === "完了");
  return Math.round((completedItems.length / validItems.length) * 100);
};

// 工程表のソート種別
type WorkflowSortType = "manual" | "location" | "progress";

// localStorage キー（工程表の順序用）
const getWorkflowStorageKey = (templateId: string) => `workflowProjectOrder_${templateId}`;

export function ProjectList({
  projects,
  contactDisplayMap,
  accountDisplayMap,
  employeeMap,
  recentProjectIds,
  standardTasksMap,
  workflowTemplates,
  onLoadWorkflowData,
  onUpdateWorkflowStatus,
}: ProjectListProps) {
  const [filters, setFilters] = useState<FilterState>(loadFiltersFromStorage);
  // ソートは常に閲覧履歴順をデフォルトに（セッション中のみ維持）
  const [sort, setSort] = useState<SortState>({ key: null, order: "asc" });

  // 工程表用の状態
  const [workflowItems, setWorkflowItems] = useState<StandardTaskItem[]>([]);
  const [workflowProjects, setWorkflowProjects] = useState<WorkflowProject[]>([]);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowSortType, setWorkflowSortType] = useState<WorkflowSortType>("manual");
  const [workflowProjectOrder, setWorkflowProjectOrder] = useState<string[]>([]);
  const [draggingProjectId, setDraggingProjectId] = useState<string | null>(null);

  // フィルター変更時にlocalStorageに保存
  useEffect(() => {
    const toSave = {
      search: filters.search,
      category: filters.category,
      includeCompleted: filters.includeCompleted,
      workflowTemplateId: filters.workflowTemplateId,
    };
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(toSave));
  }, [filters]);

  // 工程表データの読み込み
  useEffect(() => {
    if (filters.workflowTemplateId && onLoadWorkflowData) {
      setWorkflowLoading(true);
      onLoadWorkflowData(filters.workflowTemplateId).then((data) => {
        setWorkflowItems(data.items);
        setWorkflowProjects(data.projects);
        setWorkflowLoading(false);
      });

      // 順序を読み込み
      const saved = localStorage.getItem(getWorkflowStorageKey(filters.workflowTemplateId));
      if (saved) {
        try {
          setWorkflowProjectOrder(JSON.parse(saved));
        } catch {
          setWorkflowProjectOrder([]);
        }
      } else {
        setWorkflowProjectOrder([]);
      }
    }
  }, [filters.workflowTemplateId, onLoadWorkflowData]);

  // 工程表の順序保存
  const saveWorkflowProjectOrder = useCallback((order: string[]) => {
    if (!filters.workflowTemplateId) return;
    setWorkflowProjectOrder(order);
    localStorage.setItem(getWorkflowStorageKey(filters.workflowTemplateId), JSON.stringify(order));
  }, [filters.workflowTemplateId]);

  // ヘッダークリック時のソート切り替え
  const handleSort = (key: SortKey) => {
    setSort((prev) => {
      if (prev.key === key) {
        return { key, order: prev.order === "asc" ? "desc" : "asc" };
      }
      return { key, order: "asc" };
    });
  };

  // ソートアイコンを表示
  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sort.key !== columnKey) return null;
    return sort.order === "asc" ? (
      <ArrowUp className="h-3 w-3 inline ml-1" />
    ) : (
      <ArrowDown className="h-3 w-3 inline ml-1" />
    );
  };

  // 工程表のドラッグ＆ドロップ
  const handleWorkflowDragStart = useCallback((projectId: string) => {
    setDraggingProjectId(projectId);
  }, []);

  const sortedWorkflowProjects = useMemo(() => {
    if (workflowSortType === "location") {
      return [...workflowProjects].sort((a, b) => {
        const locA = getLocationWithoutLotNumber(a.location);
        const locB = getLocationWithoutLotNumber(b.location);
        return locA.localeCompare(locB, "ja");
      });
    }
    if (workflowSortType === "progress") {
      return [...workflowProjects].sort((a, b) => {
        const progA = calculateProgress(a.progress || []);
        const progB = calculateProgress(b.progress || []);
        return progB - progA;
      });
    }
    if (workflowProjectOrder.length === 0) return workflowProjects;
    return [...workflowProjects].sort((a, b) => {
      const indexA = workflowProjectOrder.indexOf(a.id);
      const indexB = workflowProjectOrder.indexOf(b.id);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [workflowProjects, workflowProjectOrder, workflowSortType]);

  const handleWorkflowDrop = useCallback((targetProjectId: string) => {
    if (!draggingProjectId || draggingProjectId === targetProjectId) {
      setDraggingProjectId(null);
      return;
    }

    const currentOrder = workflowProjectOrder.length > 0
      ? [...workflowProjectOrder]
      : sortedWorkflowProjects.map(p => p.id);

    const dragIndex = currentOrder.indexOf(draggingProjectId);
    const dropIndex = currentOrder.indexOf(targetProjectId);

    if (dragIndex === -1 || dropIndex === -1) {
      setDraggingProjectId(null);
      return;
    }

    currentOrder.splice(dragIndex, 1);
    currentOrder.splice(dropIndex, 0, draggingProjectId);

    saveWorkflowProjectOrder(currentOrder);
    setDraggingProjectId(null);
  }, [draggingProjectId, workflowProjectOrder, sortedWorkflowProjects, saveWorkflowProjectOrder]);

  const handleWorkflowStatusChange = async (
    projectId: string,
    projectStandardTaskId: string,
    itemId: string,
    status: StandardTaskStatus
  ) => {
    // 楽観的更新
    setWorkflowProjects((prev) =>
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

    if (onUpdateWorkflowStatus) {
      const result = await onUpdateWorkflowStatus(projectStandardTaskId, itemId, status);
      if (result.error) {
        window.location.reload();
      }
    }
  };

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      // 検索フィルタ（業務名、コード、顧客名）
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchCode = p.code.toLowerCase().includes(q);
        // 顧客名で検索
        const customerName = p.account_id
          ? accountDisplayMap[p.account_id] || ""
          : p.contact_id
            ? contactDisplayMap[p.contact_id] || ""
            : "";
        const matchCustomer = customerName.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchCustomer) return false;
      }

      // カテゴリフィルタ（単一選択、ALL_MARKERなら全表示）
      if (filters.category !== ALL_MARKER) {
        if (filters.category === NULL_MARKER) {
          if (p.category) return false;
        } else {
          if (p.category !== filters.category) return false;
        }
      }

      // ステータスフィルタ（完了を含めるかどうか）
      if (!filters.includeCompleted) {
        if (p.status === "完了") return false;
      }

      return true;
    });
  }, [projects, filters, accountDisplayMap, contactDisplayMap]);

  // ソート処理（デフォルトは閲覧履歴順）
  const sorted = useMemo(() => {
    const getCustomerName = (p: ProjectData) => {
      if (p.account_id) return accountDisplayMap[p.account_id] || "";
      if (p.contact_id) return contactDisplayMap[p.contact_id] || "";
      return "";
    };
    const getManagerName = (p: ProjectData) =>
      p.manager_id ? employeeMap[p.manager_id] || "" : "";
    const getLocation = (p: ProjectData) =>
      [p.location, p.location_detail].filter(Boolean).join(" ");

    // ソートキーが指定されていない場合は閲覧履歴順
    if (!sort.key) {
      // 最近閲覧した業務を上に、それ以外は元の順序（作成日時降順）
      return [...filtered].sort((a, b) => {
        const aIndex = recentProjectIds.indexOf(a.id);
        const bIndex = recentProjectIds.indexOf(b.id);

        // 両方とも閲覧履歴にある場合は閲覧順
        if (aIndex !== -1 && bIndex !== -1) {
          return aIndex - bIndex;
        }
        // aのみ閲覧履歴にある場合はaを上に
        if (aIndex !== -1) return -1;
        // bのみ閲覧履歴にある場合はbを上に
        if (bIndex !== -1) return 1;
        // どちらも閲覧履歴にない場合は元の順序を維持
        return 0;
      });
    }

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sort.key) {
        case "code":
          cmp = a.code.localeCompare(b.code);
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "customer":
          cmp = getCustomerName(a).localeCompare(getCustomerName(b));
          break;
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "location":
          cmp = getLocation(a).localeCompare(getLocation(b));
          break;
        case "manager":
          cmp = getManagerName(a).localeCompare(getManagerName(b));
          break;
        case "start_date":
          cmp = (a.start_date || "").localeCompare(b.start_date || "");
          break;
        case "end_date":
          cmp = (a.end_date || "").localeCompare(b.end_date || "");
          break;
      }
      return sort.order === "asc" ? cmp : -cmp;
    });
  }, [filtered, sort, contactDisplayMap, employeeMap, recentProjectIds]);

  const isWorkflowView = filters.workflowTemplateId !== null;

  return (
    <>
      <ProjectFilters
        filters={filters}
        onFiltersChange={setFilters}
        workflowTemplates={workflowTemplates}
      />

      {isWorkflowView ? (
        // 工程表ビュー
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {workflowProjects.length}件
            </p>
            {workflowProjects.length > 0 && (
              <Select value={workflowSortType} onValueChange={(v) => setWorkflowSortType(v as WorkflowSortType)}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">手動順</SelectItem>
                  <SelectItem value="location">所在地順</SelectItem>
                  <SelectItem value="progress">進捗率順</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {workflowLoading ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground py-8">
                  読み込み中...
                </p>
              </CardContent>
            </Card>
          ) : workflowProjects.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground py-8">
                  この標準業務が割り当てられている進行中の業務はありません
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="overflow-auto border rounded-lg">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted z-20">
                    <TableRow className="h-8">
                      <TableHead className="sticky left-0 bg-muted z-30 min-w-[180px] py-1 text-xs whitespace-nowrap">
                        業務
                      </TableHead>
                      <TableHead className="bg-muted py-1 text-xs whitespace-nowrap min-w-[120px]">
                        所在地
                      </TableHead>
                      <TableHead className="bg-muted py-1 text-xs whitespace-nowrap text-center min-w-[50px]">
                        進捗
                      </TableHead>
                      {workflowItems.map((item) => (
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
                    {sortedWorkflowProjects.map((project) => (
                      <TableRow
                        key={project.id}
                        draggable={workflowSortType === "manual"}
                        onDragStart={workflowSortType === "manual" ? () => handleWorkflowDragStart(project.id) : undefined}
                        onDragOver={workflowSortType === "manual" ? (e) => e.preventDefault() : undefined}
                        onDrop={workflowSortType === "manual" ? () => handleWorkflowDrop(project.id) : undefined}
                        className={`h-7 ${draggingProjectId === project.id ? "opacity-50 bg-primary/10" : ""}`}
                      >
                        <TableCell className="sticky left-0 bg-background z-10 py-0 px-1 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            {workflowSortType === "manual" && (
                              <GripVertical className="h-3 w-3 text-muted-foreground cursor-grab flex-shrink-0" />
                            )}
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
                        <TableCell className="py-0 px-1 text-xs text-muted-foreground whitespace-nowrap">
                          {getLocationWithoutLotNumber(project.location)}
                        </TableCell>
                        <TableCell className="py-0 px-1 text-xs text-center whitespace-nowrap">
                          {calculateProgress(project.progress || [])}%
                        </TableCell>
                        {workflowItems.map((item) => {
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
                                    disabled={workflowLoading}
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
                                          handleWorkflowStatusChange(
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

              {/* 凡例 */}
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
            </>
          )}
        </div>
      ) : (
        // 通常の業務一覧ビュー
        <>
          <p className="text-sm text-muted-foreground mb-2">
            {sorted.length}件 / {projects.length}件
          </p>

          {sorted.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground py-8">
                  該当する業務がありません。
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow className="h-8">
                    <TableHead className="w-[90px] py-1 text-xs cursor-pointer hover:bg-muted/50" onClick={() => handleSort("code")}>
                      コード<SortIcon columnKey="code" />
                    </TableHead>
                    <TableHead className="w-[70px] py-1 text-xs whitespace-nowrap cursor-pointer hover:bg-muted/50" onClick={() => handleSort("status")}>
                      ステータス<SortIcon columnKey="status" />
                    </TableHead>
                    <TableHead className="w-[140px] py-1 text-xs cursor-pointer hover:bg-muted/50" onClick={() => handleSort("customer")}>
                      顧客<SortIcon columnKey="customer" />
                    </TableHead>
                    <TableHead className="w-[200px] py-1 text-xs cursor-pointer hover:bg-muted/50" onClick={() => handleSort("name")}>
                      業務名<SortIcon columnKey="name" />
                    </TableHead>
                    <TableHead className="w-[100px] py-1 text-xs cursor-pointer hover:bg-muted/50" onClick={() => handleSort("location")}>
                      所在地<SortIcon columnKey="location" />
                    </TableHead>
                    <TableHead className="w-[120px] py-1 text-xs cursor-pointer hover:bg-muted/50" onClick={() => handleSort("manager")}>
                      担当<SortIcon columnKey="manager" />
                    </TableHead>
                    <TableHead className="w-[90px] py-1 text-xs cursor-pointer hover:bg-muted/50" onClick={() => handleSort("start_date")}>
                      開始<SortIcon columnKey="start_date" />
                    </TableHead>
                    <TableHead className="w-[90px] py-1 text-xs cursor-pointer hover:bg-muted/50" onClick={() => handleSort("end_date")}>
                      完了<SortIcon columnKey="end_date" />
                    </TableHead>
                    <TableHead className="w-[120px] py-1 text-xs">
                      標準フロー
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((project) => {
                    // 背景色: 緊急=赤系、待機=グレー系
                    const rowBgClass = project.is_urgent
                      ? "bg-red-50 hover:bg-red-100"
                      : project.is_on_hold
                      ? "bg-gray-100 hover:bg-gray-200"
                      : "hover:bg-muted/50";
                    return (
                    <TableRow key={project.id} className={`cursor-pointer h-8 ${rowBgClass}`}>
                      <TableCell className="font-mono text-xs py-1">
                        <Link href={`/projects/${project.id}`} className="block">
                          {project.code}
                        </Link>
                      </TableCell>
                      <TableCell className="py-1 whitespace-nowrap">
                        <Badge className={`${PROJECT_STATUS_COLORS[project.status as ProjectStatus]} text-xs`}>
                          {project.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs py-1 truncate max-w-[140px]">
                        {(project.account_id
                          ? accountDisplayMap[project.account_id] || "-"
                          : project.contact_id
                            ? contactDisplayMap[project.contact_id] || "-"
                            : "-"
                        ).slice(0, 16)}
                      </TableCell>
                      <TableCell className="py-1 max-w-[200px]">
                        <Link href={`/projects/${project.id}`} className="block text-sm hover:underline truncate">
                          {(project.name || "").slice(0, 16)}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs py-1 truncate max-w-[100px]">
                        {[project.location, project.location_detail].filter(Boolean).join(" ") || "-"}
                      </TableCell>
                      <TableCell className="text-xs py-1 max-w-[120px]">
                        {project.manager_id ? employeeMap[project.manager_id] || "-" : "-"}
                      </TableCell>
                      <TableCell className="text-xs py-1 text-muted-foreground">
                        {formatDate(project.start_date)}
                      </TableCell>
                      <TableCell className="text-xs py-1 text-muted-foreground">
                        {formatDate(project.end_date)}
                      </TableCell>
                      <TableCell className="text-xs py-1 truncate max-w-[120px]">
                        {(standardTasksMap[project.id] || []).join(", ") || "-"}
                      </TableCell>
                    </TableRow>
                  );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}
    </>
  );
}
