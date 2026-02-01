import { CategorySettings } from "./category-settings";
import { getEventCategories } from "../actions";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default async function CalendarSettingsPage() {
  const categories = await getEventCategories();

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <header className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <Link href="/calendar">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              カレンダーに戻る
            </Button>
          </Link>
        </div>
        <h1 className="text-2xl font-bold">カレンダー設定</h1>
        <p className="text-muted-foreground">イベント区分の管理</p>
      </header>

      <CategorySettings initialCategories={categories} />
    </main>
  );
}
