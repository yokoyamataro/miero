import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getIdentityVerifications } from "./actions";
import { VerificationList } from "./list-view";

export default async function IdentityVerificationsPage() {
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

  // 当面は管理者のみ利用可能
  if ((me as { role: string } | null)?.role !== "admin") {
    redirect("/");
  }

  const verifications = await getIdentityVerifications();

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">本人確認シート</h1>
        <Link href="/identity-verifications/new">
          <Button>
            <Plus className="h-4 w-4 mr-1" />
            新規作成
          </Button>
        </Link>
      </div>

      <VerificationList verifications={verifications} />
    </main>
  );
}
