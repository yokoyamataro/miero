"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Calendar, Briefcase, Palmtree, Monitor } from "lucide-react";

const navItems = [
  { href: "/m/calendar", label: "カレンダー", icon: Calendar },
  { href: "/m/projects", label: "業務", icon: Briefcase },
  { href: "/m/leaves", label: "休暇", icon: Palmtree },
];

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();

  // PC版へ切り替え（Cookieを設定してからリダイレクト）
  const handleSwitchToPC = () => {
    // 30日間有効なCookieを設定
    document.cookie = "view-preference=pc; path=/; max-age=2592000";
    router.push("/");
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t safe-area-pb">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-6 w-6" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
        {/* PC版へ切り替え */}
        <button
          onClick={handleSwitchToPC}
          className="flex flex-col items-center justify-center w-full h-full gap-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Monitor className="h-6 w-6" />
          <span className="text-xs font-medium">PC版</span>
        </button>
      </div>
    </nav>
  );
}
