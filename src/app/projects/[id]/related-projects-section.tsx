"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, X, Loader2, Search } from "lucide-react";
import {
  type RelatedProjectWithDetails,
  type ProjectCategory,
} from "@/types/database";
import {
  addRelatedProject,
  removeRelatedProject,
  searchProjectsForRelation,
} from "./actions";

interface RelatedProjectsSectionProps {
  projectId: string;
  projectCode: string;
  relatedProjects: RelatedProjectWithDetails[];
}

export function RelatedProjectsSection({
  projectId,
  projectCode,
  relatedProjects,
}: RelatedProjectsSectionProps) {
  const [isPending, startTransition] = useTransition();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    { id: string; code: string; name: string; category: ProjectCategory | null }[]
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // 検索実行
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const results = await searchProjectsForRelation(searchQuery, projectId);
      // 既に関連付けられている業務を除外
      const existingIds = new Set(relatedProjects.map((r) => r.project.id));
      setSearchResults(results.filter((r) => !existingIds.has(r.id)));
    } finally {
      setIsSearching(false);
    }
  };

  // 関連業務を追加
  const handleAdd = (relatedProjectId: string) => {
    startTransition(async () => {
      const result = await addRelatedProject(projectId, relatedProjectId);
      if (!result.error) {
        setIsDialogOpen(false);
        setSearchQuery("");
        setSearchResults([]);
      }
    });
  };

  // 関連業務を削除
  const handleRemove = (relationId: string) => {
    setRemovingId(relationId);
    startTransition(async () => {
      await removeRelatedProject(relationId, projectId);
      setRemovingId(null);
    });
  };

  // 関連業務がない場合は表示しない
  if (relatedProjects.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">関連業務:</span>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 px-2">
              <Plus className="h-3 w-3 mr-1" />
              追加
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>関連業務を追加</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="業務コードまたは業務名で検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSearch();
                    }
                  }}
                />
                <Button onClick={handleSearch} disabled={isSearching}>
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="border rounded-md max-h-64 overflow-y-auto">
                  {searchResults.map((project) => (
                    <div
                      key={project.id}
                      className="flex items-center justify-between p-2 hover:bg-muted border-b last:border-b-0"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {project.code}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {project.name}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleAdd(project.id)}
                        disabled={isPending}
                      >
                        {isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {searchQuery && searchResults.length === 0 && !isSearching && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  該当する業務が見つかりません
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm flex-wrap">
      <span className="text-muted-foreground">関連業務:</span>
      {/* 本業務（●マーカー付き） */}
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
        <span className="text-xs">●</span>
        {projectCode}
      </span>
      {/* 関連業務 */}
      {relatedProjects.map((relation) => (
        <span
          key={relation.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted hover:bg-muted/80 group"
        >
          <Link
            href={`/projects/${relation.project.id}`}
            className="hover:underline"
          >
            {relation.project.code}
          </Link>
          <button
            onClick={() => handleRemove(relation.id)}
            disabled={removingId === relation.id}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive ml-0.5"
          >
            {removingId === relation.id ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <X className="h-3 w-3" />
            )}
          </button>
        </span>
      ))}
      {/* 追加ボタン */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 px-2">
            <Plus className="h-3 w-3" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>関連業務を追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="業務コードまたは業務名で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
              />
              <Button onClick={handleSearch} disabled={isSearching}>
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="border rounded-md max-h-64 overflow-y-auto">
                {searchResults.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between p-2 hover:bg-muted border-b last:border-b-0"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {project.code}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {project.name}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleAdd(project.id)}
                      disabled={isPending}
                    >
                      {isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {searchQuery && searchResults.length === 0 && !isSearching && (
              <p className="text-sm text-muted-foreground text-center py-4">
                該当する業務が見つかりません
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
