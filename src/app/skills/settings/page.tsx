import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSkillCategoriesWithItems } from "../actions";
import { SkillSettingsManager } from "./skill-settings-manager";

export default async function SkillSettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: employee } = await supabase
    .from("employees")
    .select("role")
    .eq("auth_id", user.id)
    .maybeSingle();

  if ((employee as { role: string } | null)?.role !== "admin") {
    redirect("/skills");
  }

  const categories = await getSkillCategoriesWithItems();

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <Link href="/skills">
        <Button variant="ghost" size="sm" className="mb-4">
          <ChevronLeft className="h-4 w-4 mr-1" />
          スキルマップへ戻る
        </Button>
      </Link>
      <h1 className="text-2xl font-bold mb-2">スキル項目の管理</h1>
      <p className="text-sm text-muted-foreground mb-6">
        カテゴリ（例: 測量、登記）と、その中の工程（評価対象）を登録します。
      </p>
      <SkillSettingsManager initialCategories={categories} />
    </main>
  );
}
