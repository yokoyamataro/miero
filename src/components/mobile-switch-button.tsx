"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Smartphone } from "lucide-react";

export function MobileSwitchButton() {
  const router = useRouter();

  const handleSwitchToMobile = () => {
    // 30日間有効なCookieを設定
    document.cookie = "view-preference=mobile; path=/; max-age=2592000";
    router.push("/m/calendar");
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleSwitchToMobile}
      className="gap-2"
      title="モバイル版へ切り替え"
    >
      <Smartphone className="h-4 w-4" />
      <span className="hidden lg:inline">モバイル版</span>
    </Button>
  );
}
