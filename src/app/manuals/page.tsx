import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, BookOpen, FileText } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { getManuals, getManualCategories } from "./actions";
import { ManualListFilters } from "./manual-list-filters";

interface SearchParams {
  category?: string;
  q?: string;
  draft?: string;
}

export default async function ManualsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const category = searchParams.category || undefined;
  const keyword = searchParams.q || undefined;
  const showDraft = searchParams.draft === "1";

  const [manuals, categories] = await Promise.all([
    getManuals({
      category,
      keyword,
      publishedOnly: !showDraft,
    }),
    getManualCategories(),
  ]);

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          <h1 className="text-2xl font-bold">業務マニュアル</h1>
        </div>
        <Link href="/manuals/new">
          <Button>
            <Plus className="h-4 w-4 mr-1" />
            新規作成
          </Button>
        </Link>
      </div>

      <ManualListFilters
        categories={categories}
        activeCategory={category || null}
        keyword={keyword || ""}
        showDraft={showDraft}
      />

      {manuals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-2 opacity-40" />
            <p>マニュアルがありません</p>
            <p className="text-sm">右上の「新規作成」から追加してください</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {manuals.map((m) => (
            <Link key={m.id} href={`/manuals/${m.id}`}>
              <Card className="hover:border-foreground/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h2 className="font-semibold truncate">{m.title}</h2>
                        {!m.is_published && (
                          <Badge variant="secondary" className="text-xs">
                            下書き
                          </Badge>
                        )}
                        {m.category && (
                          <Badge variant="outline" className="text-xs">
                            {m.category}
                          </Badge>
                        )}
                      </div>
                      {m.tags.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap mb-1">
                          {m.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-xs text-muted-foreground"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {m.author?.name ? `${m.author.name} ・ ` : ""}
                        {format(new Date(m.updated_at), "yyyy/MM/dd HH:mm", {
                          locale: ja,
                        })}
                        {" 更新"}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
