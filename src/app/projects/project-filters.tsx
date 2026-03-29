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

export const NULL_MARKER = "__null__";
export const ALL_MARKER = "__all__";

export interface FilterState {
  search: string;
  category: ProjectCategory | typeof NULL_MARKER | typeof ALL_MARKER;
  status: ProjectStatus | typeof ALL_MARKER;
}

interface ProjectFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

const ALL_CATEGORIES = Object.keys(PROJECT_CATEGORY_LABELS) as ProjectCategory[];
// ステータスの順番: 進行中、完了
const ALL_STATUSES: ProjectStatus[] = ["進行中", "完了"];

const BTN_ACTIVE = "bg-foreground text-background border-foreground";
const BTN_INACTIVE = "bg-background text-muted-foreground border-border hover:border-foreground/30";

export function ProjectFilters({ filters, onFiltersChange }: ProjectFiltersProps) {
  // カテゴリ（単一選択）
  const selectCategory = (cat: ProjectCategory | typeof NULL_MARKER | typeof ALL_MARKER) => {
    onFiltersChange({ ...filters, category: cat });
  };

  // ステータス（単一選択）
  const selectStatus = (status: ProjectStatus | typeof ALL_MARKER) => {
    onFiltersChange({ ...filters, status });
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
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-1">カテゴリ</span>
          <button
            type="button"
            onClick={() => selectCategory(ALL_MARKER)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              filters.category === ALL_MARKER ? BTN_ACTIVE : BTN_INACTIVE
            }`}
          >
            全て
          </button>
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => selectCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                filters.category === cat ? BTN_ACTIVE : BTN_INACTIVE
              }`}
            >
              {PROJECT_CATEGORY_LABELS[cat]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => selectCategory(NULL_MARKER)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              filters.category === NULL_MARKER ? BTN_ACTIVE : BTN_INACTIVE
            }`}
          >
            指定なし
          </button>
        </div>

        {/* ステータス */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-1">ステータス</span>
          <button
            type="button"
            onClick={() => selectStatus(ALL_MARKER)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              filters.status === ALL_MARKER ? BTN_ACTIVE : BTN_INACTIVE
            }`}
          >
            全て
          </button>
          {ALL_STATUSES.map((status) => {
            const active = filters.status === status;
            const statusColor = active ? PROJECT_STATUS_COLORS[status] : "";
            return (
              <button
                key={status}
                type="button"
                onClick={() => selectStatus(status)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  active ? `${statusColor} border-transparent` : BTN_INACTIVE
                }`}
              >
                {status}
              </button>
            );
          })}
        </div>

      </CardContent>
    </Card>
  );
}
