"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import {
  PROJECT_CATEGORY_LABELS,
  PROJECT_STATUS_COLORS,
  type ProjectCategory,
  type ProjectStatus,
} from "@/types/database";

interface Employee {
  id: string;
  name: string;
}

export interface FilterState {
  search: string;
  categories: Set<ProjectCategory>;
  statuses: Set<ProjectStatus>;
  managerIds: Set<string>;
}

interface ProjectFiltersProps {
  employees: Employee[];
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

const ALL_CATEGORIES = Object.keys(PROJECT_CATEGORY_LABELS) as ProjectCategory[];
const ALL_STATUSES = Object.keys(PROJECT_STATUS_COLORS) as ProjectStatus[];

export function ProjectFilters({ employees, filters, onFiltersChange }: ProjectFiltersProps) {
  const toggleCategory = (cat: ProjectCategory) => {
    const next = new Set(filters.categories);
    if (next.has(cat)) {
      next.delete(cat);
    } else {
      next.add(cat);
    }
    onFiltersChange({ ...filters, categories: next });
  };

  const toggleStatus = (status: ProjectStatus) => {
    const next = new Set(filters.statuses);
    if (next.has(status)) {
      next.delete(status);
    } else {
      next.add(status);
    }
    onFiltersChange({ ...filters, statuses: next });
  };

  const toggleManager = (id: string) => {
    const next = new Set(filters.managerIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onFiltersChange({ ...filters, managerIds: next });
  };

  const setSearch = (search: string) => {
    onFiltersChange({ ...filters, search });
  };

  return (
    <Card className="mb-6">
      <CardContent className="pt-6 space-y-4">
        {/* 検索 */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="業務名・コードで検索..."
            className="pl-9"
            value={filters.search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* カテゴリ */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">カテゴリ</p>
          <div className="flex flex-wrap gap-1.5">
            {ALL_CATEGORIES.map((cat) => {
              const active = filters.categories.has(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    active
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-background text-muted-foreground border-border hover:border-foreground/30"
                  }`}
                >
                  {PROJECT_CATEGORY_LABELS[cat]}
                </button>
              );
            })}
          </div>
        </div>

        {/* ステータス */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">ステータス</p>
          <div className="flex flex-wrap gap-1.5">
            {ALL_STATUSES.map((status) => {
              const active = filters.statuses.has(status);
              const colorClass = PROJECT_STATUS_COLORS[status];
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => toggleStatus(status)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    active
                      ? `${colorClass} border-transparent`
                      : "bg-background text-muted-foreground border-border hover:border-foreground/30"
                  }`}
                >
                  {status}
                </button>
              );
            })}
          </div>
        </div>

        {/* 担当者 */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">担当者</p>
          <div className="flex flex-wrap gap-1.5">
            {employees.map((emp) => {
              const active = filters.managerIds.has(emp.id);
              return (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => toggleManager(emp.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    active
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background text-muted-foreground border-border hover:border-foreground/30"
                  }`}
                >
                  {emp.name}
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
