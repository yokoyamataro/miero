"use client";

import { useState, useMemo, useEffect } from "react";
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
import { ArrowUp, ArrowDown } from "lucide-react";
import {
  PROJECT_STATUS_COLORS,
  type ProjectCategory,
  type ProjectStatus,
} from "@/types/database";
import { ProjectFilters, type FilterState, NULL_MARKER, ALL_MARKER } from "./project-filters";

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
  manager_id: string | null;
  start_date: string | null;
  end_date: string | null;
  fee_tax_excluded: number | null;
  location: string | null;
  location_detail: string | null;
}

interface Employee {
  id: string;
  name: string;
}

interface ProjectListProps {
  projects: ProjectData[];
  employees: Employee[];
  contactDisplayMap: Record<string, string>;
  employeeMap: Record<string, string>;
  recentProjectIds: string[]; // 2週間以内の閲覧履歴（最新順）
}

// デフォルトのフィルター状態
const DEFAULT_FILTERS: FilterState = {
  search: "",
  category: ALL_MARKER,
  status: "進行中",
  managerId: ALL_MARKER,
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
        status: parsed.status || "進行中",
        managerId: parsed.managerId || ALL_MARKER,
      };
    }
  } catch {
    // ignore
  }
  return DEFAULT_FILTERS;
}


export function ProjectList({ projects, employees, contactDisplayMap, employeeMap, recentProjectIds }: ProjectListProps) {
  const [filters, setFilters] = useState<FilterState>(loadFiltersFromStorage);
  // ソートは常に閲覧履歴順をデフォルトに（セッション中のみ維持）
  const [sort, setSort] = useState<SortState>({ key: null, order: "asc" });

  // フィルター変更時にlocalStorageに保存
  useEffect(() => {
    const toSave = {
      search: filters.search,
      category: filters.category,
      status: filters.status,
      managerId: filters.managerId,
    };
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(toSave));
  }, [filters]);

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

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      // 検索フィルタ
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchCode = p.code.toLowerCase().includes(q);
        if (!matchName && !matchCode) return false;
      }

      // カテゴリフィルタ（単一選択、ALL_MARKERなら全表示）
      if (filters.category !== ALL_MARKER) {
        if (filters.category === NULL_MARKER) {
          if (p.category) return false;
        } else {
          if (p.category !== filters.category) return false;
        }
      }

      // ステータスフィルタ（単一選択、ALL_MARKERなら全表示）
      if (filters.status !== ALL_MARKER) {
        if (p.status !== filters.status) return false;
      }

      // 担当者フィルタ（単一選択、ALL_MARKERなら全表示）
      if (filters.managerId !== ALL_MARKER) {
        if (filters.managerId === NULL_MARKER) {
          if (p.manager_id) return false;
        } else {
          if (p.manager_id !== filters.managerId) return false;
        }
      }

      return true;
    });
  }, [projects, filters]);

  // ソート処理（デフォルトは閲覧履歴順）
  const sorted = useMemo(() => {
    const getCustomerName = (p: ProjectData) =>
      p.contact_id ? contactDisplayMap[p.contact_id] || "" : "";
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

  return (
    <>
      <ProjectFilters
        employees={employees}
        filters={filters}
        onFiltersChange={setFilters}
      />

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
                <TableHead className="py-1 text-xs cursor-pointer hover:bg-muted/50" onClick={() => handleSort("location")}>
                  所在地<SortIcon columnKey="location" />
                </TableHead>
                <TableHead className="w-[100px] py-1 text-xs cursor-pointer hover:bg-muted/50" onClick={() => handleSort("manager")}>
                  担当<SortIcon columnKey="manager" />
                </TableHead>
                <TableHead className="w-[90px] py-1 text-xs cursor-pointer hover:bg-muted/50" onClick={() => handleSort("start_date")}>
                  開始<SortIcon columnKey="start_date" />
                </TableHead>
                <TableHead className="w-[90px] py-1 text-xs cursor-pointer hover:bg-muted/50" onClick={() => handleSort("end_date")}>
                  完了<SortIcon columnKey="end_date" />
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
                    {project.contact_id ? (contactDisplayMap[project.contact_id] || "-").slice(0, 16) : "-"}
                  </TableCell>
                  <TableCell className="py-1 max-w-[200px]">
                    <Link href={`/projects/${project.id}`} className="block text-sm hover:underline truncate">
                      {project.name.slice(0, 16)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs py-1 truncate">
                    {[project.location, project.location_detail].filter(Boolean).join(" ") || "-"}
                  </TableCell>
                  <TableCell className="text-xs py-1">
                    {project.manager_id ? employeeMap[project.manager_id] || "-" : "-"}
                  </TableCell>
                  <TableCell className="text-xs py-1 text-muted-foreground">
                    {formatDate(project.start_date)}
                  </TableCell>
                  <TableCell className="text-xs py-1 text-muted-foreground">
                    {formatDate(project.end_date)}
                  </TableCell>
                </TableRow>
              );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
