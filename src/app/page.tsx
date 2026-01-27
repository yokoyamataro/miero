import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="container mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-primary">ダッシュボード</h1>
        <p className="text-muted-foreground mt-2">
          測量・登記・行政書士業務・ドローン事業を一元管理
        </p>
      </header>

      <section className="mt-12">
        <h2 className="text-xl font-semibold mb-4">クイックアクション</h2>
        <div className="flex gap-4 flex-wrap">
          <Link href="/projects/new">
            <Button>新規業務登録</Button>
          </Link>
          <Link href="/customers">
            <Button variant="outline">顧客管理</Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
