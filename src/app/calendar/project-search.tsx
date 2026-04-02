"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Briefcase, Search, X, Loader2 } from "lucide-react";
import { searchProjects, getActiveProjects, type ProjectForLink } from "./actions";

interface ProjectSearchProps {
  linkedProjectId: string | null;
  linkedProjectCode: string | null;
  linkedProjectName: string | null;
  onSelect: (project: ProjectForLink) => void;
  onClear: () => void;
  compact?: boolean;
}

export function ProjectSearch({
  linkedProjectId,
  linkedProjectCode,
  linkedProjectName,
  onSelect,
  onClear,
  compact = false,
}: ProjectSearchProps) {
  const [showSelector, setShowSelector] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [projects, setProjects] = useState<ProjectForLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialProjects, setInitialProjects] = useState<ProjectForLink[]>([]);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 初回表示時に進行中業務を取得
  useEffect(() => {
    if (showSelector && initialProjects.length === 0) {
      loadInitialProjects();
    }
  }, [showSelector, initialProjects.length]);

  // 検索クエリが変更されたらリアルタイム検索
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchQuery.trim()) {
      setProjects(initialProjects);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchProjects(searchQuery);
        setProjects(results);
      } catch (err) {
        console.error("Error searching projects:", err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, initialProjects]);

  const loadInitialProjects = async () => {
    setLoading(true);
    try {
      const data = await getActiveProjects();
      setInitialProjects(data);
      setProjects(data);
    } catch (err) {
      console.error("Error loading projects:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelector = () => {
    setShowSelector(!showSelector);
    if (!showSelector) {
      setSearchQuery("");
    }
  };

  const handleSelectProject = (project: ProjectForLink) => {
    onSelect(project);
    setShowSelector(false);
    setSearchQuery("");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size={compact ? "sm" : "default"}
          onClick={handleToggleSelector}
          disabled={loading && !showSelector}
        >
          <Briefcase className={`${compact ? "h-3 w-3" : "h-4 w-4"} mr-1`} />
          {loading && !showSelector ? "読込中..." : "業務をリンク"}
        </Button>

        {/* リンク済みの業務表示 */}
        {linkedProjectId && (
          <div className={`flex items-center gap-2 ${compact ? "text-xs" : "text-sm"} bg-blue-50 text-blue-700 ${compact ? "px-2 py-1" : "px-3 py-1.5"} rounded-md`}>
            <Briefcase className={`${compact ? "h-3 w-3" : "h-4 w-4"} flex-shrink-0`} />
            <span className="truncate">【{linkedProjectCode}】{linkedProjectName}</span>
            <button
              type="button"
              onClick={onClear}
              className={`${compact ? "p-0.5" : "p-0.5"} hover:bg-blue-100 rounded flex-shrink-0`}
            >
              <X className={`${compact ? "h-3 w-3" : "h-4 w-4"}`} />
            </button>
          </div>
        )}
      </div>

      {/* 業務選択パネル */}
      {showSelector && (
        <div className="border rounded-md bg-muted/30 overflow-hidden">
          {/* 検索入力 */}
          <div className="p-2 border-b bg-background">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="業務名・顧客名で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8"
                autoFocus
              />
              {loading && (
                <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>

          {/* 業務リスト */}
          <div className="max-h-48 overflow-y-auto p-2">
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">
                {searchQuery ? "該当する業務がありません" : "進行中の業務がありません"}
              </p>
            ) : (
              <div className="space-y-1">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center gap-1 p-1 rounded hover:bg-muted cursor-pointer text-sm"
                    onClick={() => handleSelectProject(project)}
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {project.code}
                    </span>
                    <span className="truncate flex-1">{project.name}</span>
                    {project.customer_name && (
                      <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                        ({project.customer_name})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
