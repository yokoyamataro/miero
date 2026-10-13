"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

interface ManualListFiltersProps {
  categories: string[];
  activeCategory: string | null;
  keyword: string;
  showDraft: boolean;
}

export function ManualListFilters({
  categories,
  activeCategory,
  keyword,
  showDraft,
}: ManualListFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [localKeyword, setLocalKeyword] = useState(keyword);

  useEffect(() => {
    setLocalKeyword(keyword);
  }, [keyword]);

  const buildQuery = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") {
        params.delete(k);
      } else {
        params.set(k, v);
      }
    }
    return params.toString();
  };

  const applyCategory = (cat: string | null) => {
    router.push(`/manuals?${buildQuery({ category: cat })}`);
  };

  const applySearch = () => {
    router.push(`/manuals?${buildQuery({ q: localKeyword || null })}`);
  };

  const toggleDraft = () => {
    router.push(`/manuals?${buildQuery({ draft: showDraft ? null : "1" })}`);
  };

  return (
    <div className="mb-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="タイトル・本文を検索"
            value={localKeyword}
            onChange={(e) => setLocalKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applySearch();
            }}
          />
        </div>
        <Button variant="outline" size="sm" onClick={applySearch}>
          検索
        </Button>
        <Button
          variant={showDraft ? "default" : "outline"}
          size="sm"
          onClick={toggleDraft}
        >
          {showDraft ? "下書きも表示中" : "下書きを表示"}
        </Button>
      </div>

      {categories.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => applyCategory(null)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              activeCategory === null
                ? "bg-foreground text-background border-foreground"
                : "bg-background text-muted-foreground border-border hover:border-foreground/30"
            }`}
          >
            全て
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => applyCategory(cat)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                activeCategory === cat
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border hover:border-foreground/30"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
