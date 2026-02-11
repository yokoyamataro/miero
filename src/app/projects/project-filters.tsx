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

export const NULL_MARKER = "__null__";

export interface FilterState {
  search: string;
  categories: Set<ProjectCategory | typeof NULL_MARKER>;
  statuses: Set<ProjectStatus | typeof NULL_MARKER>;
  managerIds: Set<string>;
}

interface ProjectFiltersProps {
  employees: Employee[];
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

const ALL_CATEGORIES = Object.keys(PROJECT_CATEGORY_LABELS) as ProjectCategory[];
const ALL_STATUSES = Object.keys(PROJECT_STATUS_COLORS) as ProjectStatus[];

const BTN_ACTIVE = "bg-foreground text-background border-foreground";
const BTN_INACTIVE = "bg-background text-muted-foreground border-border hover:border-foreground/30";

export function ProjectFilters({ employees, filters, onFiltersChange }: ProjectFiltersProps) {
  // カテゴリ
  const toggleCategory = (cat: ProjectCategory | typeof NULL_MARKER) => {
    const next = new Set(filters.categories);
    if (next.has(cat)) {
      next.delete(cat);
    } else {
      next.add(cat);
    }
    onFiltersChange({ ...filters, categories: next });
  };

  const toggleAllCategories = () => {
    const allItems = [...ALL_CATEGORIES, NULL_MARKER] as (ProjectCategory | typeof NULL_MARKER)[];
    if (filters.categories.size === allItems.length) {
      onFiltersChange({ ...filters, categories: new Set() });
    } else {
      onFiltersChange({ ...filters, categories: new Set(allItems) });
    }
  };

  // ステータス
  const toggleStatus = (status: ProjectStatus | typeof NULL_MARKER) => {
    const next = new Set(filters.statuses);
    if (next.has(status)) {
      next.delete(status);
    } else {
      next.add(status);
    }
    onFiltersChange({ ...filters, statuses: next });
  };


  // 担当者
  const toggleManager = (id: string) => {
    const next = new Set(filters.managerIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onFiltersChange({ ...filters, managerIds: next });
  };

  const toggleAllManagers = () => {
    const allIds = [...employees.map((e) => e.id), NULL_MARKER];
    if (filters.managerIds.size === allIds.length) {
      onFiltersChange({ ...filters, managerIds: new Set() });
    } else {
      onFiltersChange({ ...filters, managerIds: new Set(allIds) });
    }
  };

  const setSearch = (search: string) => {
    onFiltersChange({ ...filters, search });
  };

  const allCategoriesSelected = filters.categories.size === ALL_CATEGORIES.length + 1;
  const allManagersSelected = filters.managerIds.size === employees.length + 1;

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
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-1">カテゴリ</span>
          <button
              type="button"
              onClick={toggleAllCategories}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                allCategoriesSelected ? BTN_ACTIVE : BTN_INACTIVE
              }`}
            >
              全て
            </button>
            {ALL_CATEGORIES.map((cat) => {
              const active = filters.categories.has(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    active ? BTN_ACTIVE : BTN_INACTIVE
                  }`}
                >
                  {PROJECT_CATEGORY_LABELS[cat]}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => toggleCategory(NULL_MARKER)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                filters.categories.has(NULL_MARKER) ? BTN_ACTIVE : BTN_INACTIVE
              }`}
            >
              指定なし
            </button>
        </div>

        {/* ステータス */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-1">ステータス</span>
            {ALL_STATUSES.map((status) => {
              const active = filters.statuses.has(status);
              const statusColor = active ? PROJECT_STATUS_COLORS[status] : "";
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => toggleStatus(status)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    active ? `${statusColor} border-transparent` : BTN_INACTIVE
                  }`}
                >
                  {status}
                </button>
              );
            })}
        </div>

        {/* 担当者 */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-1">担当者</span>
          <button
            type="button"
            onClick={toggleAllManagers}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                allManagersSelected ? BTN_ACTIVE : BTN_INACTIVE
              }`}
            >
              全て
            </button>
            {employees.map((emp) => {
              const active = filters.managerIds.has(emp.id);
              return (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => toggleManager(emp.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    active ? BTN_ACTIVE : BTN_INACTIVE
                  }`}
                >
                  {emp.name}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => toggleManager(NULL_MARKER)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                filters.managerIds.has(NULL_MARKER) ? BTN_ACTIVE : BTN_INACTIVE
              }`}
            >
              指定なし
            </button>
        </div>
      </CardContent>
    </Card>
  );
}
