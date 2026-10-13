import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { ManualForm } from "../../manual-form";
import { getManualById, getManualCategories } from "../../actions";

export default async function EditManualPage({
  params,
}: {
  params: { id: string };
}) {
  const [manual, categorySuggestions] = await Promise.all([
    getManualById(params.id),
    getManualCategories(),
  ]);

  if (!manual) {
    notFound();
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <Link href={`/manuals/${params.id}`}>
        <Button variant="ghost" size="sm" className="mb-4">
          <ChevronLeft className="h-4 w-4 mr-1" />
          詳細へ戻る
        </Button>
      </Link>
      <h1 className="text-2xl font-bold mb-6">マニュアル編集</h1>
      <ManualForm manual={manual} categorySuggestions={categorySuggestions} />
    </main>
  );
}
