import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { ManualForm } from "../manual-form";
import { getManualCategories } from "../actions";

export default async function NewManualPage() {
  const categorySuggestions = await getManualCategories();

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <Link href="/manuals">
        <Button variant="ghost" size="sm" className="mb-4">
          <ChevronLeft className="h-4 w-4 mr-1" />
          一覧へ戻る
        </Button>
      </Link>
      <h1 className="text-2xl font-bold mb-6">マニュアル新規作成</h1>
      <ManualForm categorySuggestions={categorySuggestions} />
    </main>
  );
}
