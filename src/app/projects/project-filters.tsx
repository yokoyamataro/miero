"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Search } from "lucide-react";
import {
  PROJECT_CATEGORY_LABELS,
  type ProjectCategory,
} from "@/types/database";

export const NULL_MARKER = "__null__";
export const ALL_MARKER = "__all__";
export const WORKFLOW_VIEW = "__workflow__";

export interface FilterState {
  search: string;
  category: ProjectCategory | typeof NULL_MARKER | typeof ALL_MARKER;
  includeCompleted: boolean;
  workflowTemplateId: string | null; // null = 業務一覧表示, string = 工程表表示
}

interface WorkflowTemplate {
  id: string;
  name: string;
}

interface ProjectFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  workflowTemplates: WorkflowTemplate[];
}

const ALL_CATEGORIES = Object.keys(PROJECT_CATEGORY_LABELS) as ProjectCategory[];

const BTN_ACTIVE = "bg-foreground text-background border-foreground";
const BTN_INACTIVE = "bg-background text-muted-foreground border-border hover:border-foreground/30";

export function ProjectFilters({ filters, onFiltersChange, workflowTemplates }: ProjectFiltersProps) {
  // カテゴリ（単一選択）
  const selectCategory = (cat: ProjectCategory | typeof NULL_MARKER | typeof ALL_MARKER) => {
    onFiltersChange({ ...filters, category: cat, workflowTemplateId: null });
  };

  // 工程別選択
  const selectWorkflow = (templateId: string) => {
    onFiltersChange({ ...filters, workflowTemplateId: templateId });
  };

  // 完了を含める切り替え
  const toggleIncludeCompleted = (checked: boolean) => {
    onFiltersChange({ ...filters, includeCompleted: checked });
  };

  const setSearch = (search: string) => {
    onFiltersChange({ ...filters, search });
  };

  const isWorkflowView = filters.workflowTemplateId !== null;

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
              !isWorkflowView && filters.category === ALL_MARKER ? BTN_ACTIVE : BTN_INACTIVE
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
                !isWorkflowView && filters.category === cat ? BTN_ACTIVE : BTN_INACTIVE
              }`}
            >
              {PROJECT_CATEGORY_LABELS[cat]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => selectCategory(NULL_MARKER)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              !isWorkflowView && filters.category === NULL_MARKER ? BTN_ACTIVE : BTN_INACTIVE
            }`}
          >
            指定なし
          </button>
        </div>

        {/* 工程別 */}
        {workflowTemplates.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground mr-1">工程別</span>
            {workflowTemplates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => selectWorkflow(template.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  filters.workflowTemplateId === template.id ? BTN_ACTIVE : BTN_INACTIVE
                }`}
              >
                {template.name}
              </button>
            ))}
          </div>
        )}

        {/* ステータス（完了を含めるチェック） */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="include-completed"
            checked={filters.includeCompleted}
            onCheckedChange={(checked) => toggleIncludeCompleted(checked as boolean)}
          />
          <Label htmlFor="include-completed" className="text-sm cursor-pointer">
            完了を含める
          </Label>
        </div>

      </CardContent>
    </Card>
  );
}
