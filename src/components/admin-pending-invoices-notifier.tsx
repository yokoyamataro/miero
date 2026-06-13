import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAllInvoices } from "@/app/invoices/actions";
import { AdminPendingInvoicesModal } from "./admin-pending-invoices-modal";

export async function AdminPendingInvoicesNotifier() {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "";

  // ログインページでは表示しない
  if (pathname.startsWith("/login")) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const adminClient = createAdminClient();
  const { data: employee } = await adminClient
    .from("employees")
    .select("role")
    .eq("auth_id", user.id)
    .single();

  if (employee?.role !== "admin") return null;

  // 直近30日以内の未登録請求書のみ対象
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const startDate = thirtyDaysAgo.toISOString().slice(0, 10);

  const pending = await getAllInvoices({
    isAccountingRegistered: false,
    startDate,
  });
  if (pending.length === 0) return null;

  return <AdminPendingInvoicesModal invoices={pending} />;
}
