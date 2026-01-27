import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import {
  FolderKanban,
  Building2,
  User,
  Users,
  Calendar,
  Menu,
} from "lucide-react";
import { LogoutButton } from "./logout-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { href: "/projects", label: "業務", icon: FolderKanban },
  { href: "/accounts", label: "法人", icon: Building2 },
  { href: "/contacts", label: "個人", icon: User },
  { href: "/employees", label: "社員", icon: Users },
  { href: "/calendar", label: "カレンダー", icon: Calendar },
];

export async function Header() {
  // ログインページではヘッダーを表示しない
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "";

  if (pathname.startsWith("/login")) {
    return null;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let employeeName = "";
  if (user) {
    // RLSをバイパスして社員名を取得
    const adminClient = createAdminClient();
    const { data: employee } = await adminClient
      .from("employees")
      .select("name")
      .eq("auth_id", user.id)
      .single();
    employeeName = employee?.name || "";
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-14 items-center justify-between">
          {/* ロゴ・タイトル */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded bg-primary">
                <FolderKanban className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg hidden sm:inline">業務管理</span>
            </Link>

            {/* デスクトップナビ */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              ))}
            </nav>
          </div>

          {/* 右側：ユーザー情報 */}
          <div className="flex items-center gap-4">
            {/* デスクトップ表示 */}
            {user && (
              <div className="hidden sm:flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  {employeeName}さん
                </span>
                <LogoutButton />
              </div>
            )}

            {/* モバイルメニュー */}
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Menu className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {navItems.map((item) => (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link href={item.href} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                  {user && (
                    <>
                      <DropdownMenuSeparator />
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        {employeeName}さん
                      </div>
                      <DropdownMenuItem asChild>
                        <LogoutButton />
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
