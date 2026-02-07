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
import { ProjectFilters, type FilterState, NULL_MARKER } from "./project-filters";

// ソート用の型
type SortKey = "code" | "status" | "is_urgent" | "is_on_hold" | "customer" | "name" | "location" | "manager";

interface SortState {
  key: SortKey | null;
  order: "asc" | "desc";
}

// LocalStorage キー
const FILTER_STORAGE_KEY = "projectListFilters";
const SORT_STORAGE_KEY = "projectListSort";

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
}

// フィルター状態をlocalStorageから読み込む
function loadFiltersFromStorage(): FilterState {
  if (typeof window === "undefined") {
    return {
      search: "",
      categories: new Set(),
      statuses: new Set(["未着手", "進行中"] as ProjectStatus[]),
      managerIds: new Set(),
    };
  }
  try {
    const saved = localStorage.getItem(FILTER_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        search: parsed.search || "",
        categories: new Set(parsed.categories || []),
        statuses: new Set(parsed.statuses || ["未着手", "進行中"]),
        managerIds: new Set(parsed.managerIds || []),
      };
    }
  } catch {
    // ignore
  }
  return {
    search: "",
    categories: new Set(),
    statuses: new Set(["未着手", "進行中"] as ProjectStatus[]),
    managerIds: new Set(),
  };
}

// ソート状態をlocalStorageから読み込む
function loadSortFromStorage(): SortState {
  if (typeof window === "undefined") {
    return { key: null, order: "asc" };
  }
  try {
    const saved = localStorage.getItem(SORT_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // ignore
  }
  return { key: null, order: "asc" };
}

export function ProjectList({ projects, employees, contactDisplayMap, employeeMap }: ProjectListProps) {
  const [filters, setFilters] = useState<FilterState>(loadFiltersFromStorage);
  const [sort, setSort] = useState<SortState>(loadSortFromStorage);

  // フィルター変更時にlocalStorageに保存
  useEffect(() => {
    const toSave = {
      search: filters.search,
      categories: Array.from(filters.categories),
      statuses: Array.from(filters.statuses),
      managerIds: Array.from(filters.managerIds),
    };
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(toSave));
  }, [filters]);

  // ソート変更時にlocalStorageに保存
  useEffect(() => {
    localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(sort));
  }, [sort]);

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

      // カテゴリフィルタ（何も選択されていなければ全表示）
      if (filters.categories.size > 0) {
        const matchCategory = filters.categories.has(p.category as ProjectCategory);
        const matchNull = !p.category && filters.categories.has(NULL_MARKER);
        if (!matchCategory && !matchNull) return false;
      }

      // ステータスフィルタ（何も選択されていなければ全表示）
      if (filters.statuses.size > 0) {
        const matchStatus = filters.statuses.has(p.status as ProjectStatus);
        const matchNull = !p.status && filters.statuses.has(NULL_MARKER);
        if (!matchStatus && !matchNull) return false;
      }

      // 担当者フィルタ（何も選択されていなければ全表示）
      if (filters.managerIds.size > 0) {
        const matchManager = p.manager_id && filters.managerIds.has(p.manager_id);
        const matchNull = !p.manager_id && filters.managerIds.has(NULL_MARKER);
        if (!matchManager && !matchNull) return false;
      }

      return true;
    });
  }, [projects, filters]);

  // ソート処理
  const sorted = useMemo(() => {
    if (!sort.key) return filtered;

    const getCustomerName = (p: ProjectData) =>
      p.contact_id ? contactDisplayMap[p.contact_id] || "" : "";
    const getManagerName = (p: ProjectData) =>
      p.manager_id ? employeeMap[p.manager_id] || "" : "";
    const getLocation = (p: ProjectData) =>
      [p.location, p.location_detail].filter(Boolean).join(" ");

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sort.key) {
        case "code":
          cmp = a.code.localeCompare(b.code);
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "is_urgent":
          cmp = (a.is_urgent ? 1 : 0) - (b.is_urgent ? 1 : 0);
          break;
        case "is_on_hold":
          cmp = (a.is_on_hold ? 1 : 0) - (b.is_on_hold ? 1 : 0);
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
      }
      return sort.order === "asc" ? cmp : -cmp;
    });
  }, [filtered, sort, contactDisplayMap, employeeMap]);

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
                <TableHead className="w-[32px] py-1 text-xs text-center cursor-pointer hover:bg-muted/50" onClick={() => handleSort("is_urgent")}>
                  重要<SortIcon columnKey="is_urgent" />
                </TableHead>
                <TableHead className="w-[32px] py-1 text-xs text-center cursor-pointer hover:bg-muted/50" onClick={() => handleSort("is_on_hold")}>
                  待機<SortIcon columnKey="is_on_hold" />
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((project) => (
                <TableRow key={project.id} className="cursor-pointer hover:bg-muted/50 h-8">
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
                  <TableCell className="text-xs py-1 text-center">
                    {project.is_urgent ? "⚠️" : ""}
                  </TableCell>
                  <TableCell className="text-xs py-1 text-center">
                    {project.is_on_hold ? "⏸" : ""}
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
