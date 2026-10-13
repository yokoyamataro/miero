import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Settings, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  getSkillCategoriesWithItems,
  getAllEmployeeSkills,
  getEmployees,
} from "./actions";
import { SkillMatrix } from "./skill-matrix";

export default async function SkillsPage({
  searchParams,
}: {
  searchParams: { category?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("employees")
    .select("role")
    .eq("auth_id", user.id)
    .maybeSingle();

  const isAdmin = (me as { role: string } | null)?.role === "admin";

  // 当面は管理者のみ利用可能
  if (!isAdmin) {
    redirect("/");
  }

  const [categories, employees, allSkills] = await Promise.all([
    getSkillCategoriesWithItems(),
    getEmployees(),
    getAllEmployeeSkills(),
  ]);

  const activeCategoryId = searchParams.category || categories[0]?.id || null;

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-6">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6" />
          <h1 className="text-2xl font-bold">スキルマップ</h1>
        </div>
        {isAdmin && (
          <Link href="/skills/settings">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-1" />
              スキル項目を管理
            </Button>
          </Link>
        )}
      </div>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>スキルカテゴリが未登録です</p>
            {isAdmin ? (
              <p className="text-sm mt-2">
                「スキル項目を管理」からカテゴリと工程を登録してください
              </p>
            ) : (
              <p className="text-sm mt-2">管理者が設定するまでお待ちください</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* カテゴリタブ */}
          <div className="flex items-center gap-1 flex-wrap mb-4 border-b">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/skills?category=${cat.id}`}
                scroll={false}
              >
                <button
                  type="button"
                  className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
                    activeCategoryId === cat.id
                      ? "border-foreground text-foreground font-semibold"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                  }`}
                >
                  {cat.name}
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    ({cat.items.length})
                  </span>
                </button>
              </Link>
            ))}
          </div>

          {/* マトリックス */}
          {(() => {
            const activeCategory = categories.find(
              (c) => c.id === activeCategoryId
            );
            if (!activeCategory) {
              return (
                <div className="text-sm text-muted-foreground py-8 text-center">
                  カテゴリを選択してください
                </div>
              );
            }
            if (activeCategory.items.length === 0) {
              return (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <p>このカテゴリにはスキル項目がありません</p>
                    {isAdmin && (
                      <p className="text-sm mt-2">
                        「スキル項目を管理」から追加してください
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            }
            if (employees.length === 0) {
              return (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    社員が登録されていません
                  </CardContent>
                </Card>
              );
            }
            return (
              <SkillMatrix
                category={activeCategory}
                employees={employees}
                skills={allSkills}
                canEdit={isAdmin}
              />
            );
          })()}

          {/* 凡例 */}
          <LegendCard />
        </>
      )}
    </main>
  );
}

function LegendCard() {
  const items = [
    { level: 0, label: "0: 未経験", bg: "bg-gray-100", text: "text-gray-500" },
    {
      level: 1,
      label: "1: 指導付でできる",
      bg: "bg-red-100",
      text: "text-red-700",
    },
    {
      level: 2,
      label: "2: 一人でできる",
      bg: "bg-yellow-100",
      text: "text-yellow-800",
    },
    {
      level: 3,
      label: "3: 複雑・例外も一人で",
      bg: "bg-green-100",
      text: "text-green-800",
    },
    {
      level: 4,
      label: "4: 指導・改善可",
      bg: "bg-blue-100",
      text: "text-blue-800",
    },
  ];
  return (
    <div className="mt-6 flex items-center gap-2 flex-wrap text-xs">
      <span className="text-muted-foreground">凡例:</span>
      {items.map((it) => (
        <span
          key={it.level}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded ${it.bg} ${it.text}`}
        >
          {it.label}
        </span>
      ))}
    </div>
  );
}
