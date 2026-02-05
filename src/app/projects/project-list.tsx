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
              <TableRow>
                <TableHead className="w-[100px]">コード</TableHead>
                <TableHead>業務名</TableHead>
                <TableHead className="w-[80px]">ステータス</TableHead>
                <TableHead>顧客</TableHead>
                <TableHead className="w-[80px]">担当</TableHead>
                <TableHead className="w-[100px]">着手</TableHead>
                <TableHead className="w-[100px] text-right">報酬</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((project) => (
                <TableRow key={project.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-mono text-sm">
                    <Link href={`/projects/${project.id}`} className="block">
                      {project.code}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/projects/${project.id}`} className="block font-medium hover:underline">
                      {project.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${PROJECT_STATUS_COLORS[project.status as ProjectStatus]} text-xs`}>
                      {project.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {project.contact_id ? contactDisplayMap[project.contact_id] || "-" : "-"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {project.manager_id ? employeeMap[project.manager_id] || "-" : "-"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(project.start_date)}
                  </TableCell>
                  <TableCell className="text-sm text-right">
                    {formatCurrency(project.fee_tax_excluded)}
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
