import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Pencil } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { getManualById } from "../actions";

export default async function ManualDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const manual = await getManualById(params.id);

  if (!manual) {
    notFound();
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <Link href="/manuals">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4 mr-1" />
            一覧へ戻る
          </Button>
        </Link>
        <Link href={`/manuals/${manual.id}/edit`}>
          <Button size="sm">
            <Pencil className="h-4 w-4 mr-1" />
            編集
          </Button>
        </Link>
      </div>

      <header className="mb-6 pb-4 border-b">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          {!manual.is_published && (
            <Badge variant="secondary">下書き</Badge>
          )}
          {manual.category && (
            <Badge variant="outline">{manual.category}</Badge>
          )}
          {manual.tags.map((tag) => (
            <span key={tag} className="text-xs text-muted-foreground">
              #{tag}
            </span>
          ))}
        </div>
        <h1 className="text-2xl font-bold mb-2">{manual.title}</h1>
        <div className="text-xs text-muted-foreground">
          {manual.author?.name ? `${manual.author.name} ・ ` : ""}
          {format(new Date(manual.updated_at), "yyyy/MM/dd HH:mm", {
            locale: ja,
          })}
          {" 更新"}
        </div>
      </header>

      <article>
        {manual.body.trim() ? (
          <MarkdownRenderer source={manual.body} />
        ) : (
          <p className="text-sm text-muted-foreground">（本文がありません）</p>
        )}
      </article>
    </main>
  );
}
