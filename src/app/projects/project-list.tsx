"use client";

import { useState, useMemo } from "react";
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
  PROJECT_STATUS_COLORS,
  type ProjectCategory,
  type ProjectStatus,
} from "@/types/database";
import { ProjectFilters, type FilterState, NULL_MARKER } from "./project-filters";

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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return "-";
  return `¥${amount.toLocaleString()}`;
}

export function ProjectList({ projects, employees, contactDisplayMap, employeeMap }: ProjectListProps) {
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    categories: new Set(),
    statuses: new Set(["未着手", "進行中"] as ProjectStatus[]),
    managerIds: new Set(),
  });

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

  return (
    <>
      <ProjectFilters
        employees={employees}
        filters={filters}
        onFiltersChange={setFilters}
      />

      <p className="text-sm text-muted-foreground mb-2">
        {filtered.length}件 / {projects.length}件
      </p>

      {filtered.length === 0 ? (
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
                <TableHead className="w-[90px] py-1 text-xs">コード</TableHead>
                <TableHead className="w-[80px] py-1 text-xs">ステータス</TableHead>
                <TableHead className="w-[40px] py-1 text-xs text-center">重要</TableHead>
                <TableHead className="w-[40px] py-1 text-xs text-center">待機</TableHead>
                <TableHead className="py-1 text-xs">顧客</TableHead>
                <TableHead className="py-1 text-xs">業務名</TableHead>
                <TableHead className="w-[70px] py-1 text-xs">担当</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((project) => (
                <TableRow key={project.id} className="cursor-pointer hover:bg-muted/50 h-8">
                  <TableCell className="font-mono text-xs py-1">
                    <Link href={`/projects/${project.id}`} className="block">
                      {project.code}
                    </Link>
                  </TableCell>
                  <TableCell className="py-1">
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
                  <TableCell className="text-xs py-1">
                    {project.contact_id ? contactDisplayMap[project.contact_id] || "-" : "-"}
                  </TableCell>
                  <TableCell className="py-1">
                    <Link href={`/projects/${project.id}`} className="block text-sm hover:underline">
                      {project.name}
                    </Link>
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
