import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import {
  FolderKanban,
  UserCircle,
  Users,
  Menu,
  RefreshCw,
  Home,
  Receipt,
} from "lucide-react";
import { format, addHours } from "date-fns";
import { ja } from "date-fns/locale";
import { LogoutButton } from "./logout-button";
// import { HeaderAttendance } from "./header-attendance"; // 一時的に非表示
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/projects", label: "業務", icon: FolderKanban },
  { href: "/customers", label: "顧客", icon: UserCircle },
  { href: "/employees", label: "社員", icon: Users },
  { href: "/invoices", label: "請求", icon: Receipt },
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
  // 一時的に非表示
  // let employeeId: string | null = null;
  // let attendance: { id: string; clock_in: string | null; clock_out: string | null; date: string } | null = null;

  // ビルド時刻を取得（UTC→日本時間+9時間）
  const buildTimeUtc = process.env.NEXT_PUBLIC_BUILD_TIME
    ? new Date(process.env.NEXT_PUBLIC_BUILD_TIME)
    : new Date();
  const buildTime = addHours(buildTimeUtc, 9);
  if (user) {
    // RLSをバイパスして社員情報を取得
    const adminClient = createAdminClient();
    const { data: employee } = await adminClient
      .from("employees")
      .select("id, name")
      .eq("auth_id", user.id)
      .single();
    employeeName = employee?.name || "";
    // employeeId = employee?.id || null; // 一時的に非表示

    // 今日の勤怠データを取得 - 一時的に非表示
    // if (employeeId) {
    //   const today = format(new Date(), "yyyy-MM-dd");
    //   const { data: attendanceData } = await supabase
    //     .from("attendances")
    //     .select("id, clock_in, clock_out, date")
    //     .eq("employee_id", employeeId)
    //     .eq("date", today)
    //     .single();
    //   attendance = attendanceData;
    // }
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

          {/* 右側：出勤・ユーザー情報 */}
          <div className="flex items-center gap-4">
            {/* 出勤UI（デスクトップ）- 一時的に非表示 */}
            {/* {user && employeeId && (
              <div className="hidden md:block">
                <HeaderAttendance
                  initialAttendance={attendance}
                  employeeId={employeeId}
                />
              </div>
            )} */}

            {/* デスクトップ表示 */}
            {user && (
              <div className="hidden sm:flex items-center gap-4">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" />
                  {format(buildTime, "M/d HH:mm", { locale: ja })}
                </span>
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
                      <div className="px-2 py-1.5 text-xs text-muted-foreground flex items-center gap-1">
                        <RefreshCw className="h-3 w-3" />
                        {format(buildTime, "M/d HH:mm", { locale: ja })}
                      </div>
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
