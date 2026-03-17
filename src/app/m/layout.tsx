import { MobileNav } from "./components/mobile-nav";

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* メインコンテンツ */}
      <main className="flex-1 pb-16">
        {children}
      </main>

      {/* 下部ナビゲーション */}
      <MobileNav />
    </div>
  );
}
