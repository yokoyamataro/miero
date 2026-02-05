"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PROJECT_CATEGORY_LABELS,
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
    statuses: new Set(["未着手", "作業中"] as ProjectStatus[]),
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

      <div className="space-y-4">
        {filtered.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground py-8">
                該当する業務がありません。
              </p>
            </CardContent>
          </Card>
        )}

        <p className="text-sm text-muted-foreground">
          {filtered.length}件 / {projects.length}件
        </p>

        {filtered.map((project) => (
          <Link key={project.id} href={`/projects/${project.id}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-muted-foreground">
                      {project.code}
                    </span>
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                  </div>
                  <div className="flex gap-2">
                    <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                      {PROJECT_CATEGORY_LABELS[project.category as ProjectCategory]}
                    </Badge>
                    <Badge className={PROJECT_STATUS_COLORS[project.status as ProjectStatus]}>
                      {project.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 text-sm md:grid-cols-4">
                  <div>
                    <span className="text-muted-foreground">顧客: </span>
                    {project.contact_id ? contactDisplayMap[project.contact_id] || "-" : "-"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">担当: </span>
                    {project.manager_id ? employeeMap[project.manager_id] || "-" : "-"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">期間: </span>
                    {formatDate(project.start_date)}
                    {project.end_date && ` 〜 ${formatDate(project.end_date)}`}
                  </div>
                  <div>
                    <span className="text-muted-foreground">報酬: </span>
                    {formatCurrency(project.fee_tax_excluded)}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
