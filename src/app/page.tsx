import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderKanban, Users, Building2, User, Calendar } from "lucide-react";

export default function Home() {
  return (
    <main className="container mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-primary">ダッシュボード</h1>
        <p className="text-muted-foreground mt-2">
          測量・登記・行政書士業務・ドローン事業を一元管理
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/projects">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">業務一覧</CardTitle>
              <FolderKanban className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <CardDescription>
                全業務の検索・閲覧・登録
              </CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link href="/accounts">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">法人管理</CardTitle>
              <Building2 className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <CardDescription>
                法人・組織情報と担当者の管理
              </CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link href="/contacts">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">個人顧客</CardTitle>
              <User className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <CardDescription>
                個人顧客情報の管理
              </CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link href="/employees">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">社員管理</CardTitle>
              <Users className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <CardDescription>
                社員情報・権限の管理
              </CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link href="/calendar">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">カレンダー</CardTitle>
              <Calendar className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <CardDescription>
                スケジュール・期限管理
              </CardDescription>
            </CardContent>
          </Card>
        </Link>
      </div>

      <section className="mt-12">
        <h2 className="text-xl font-semibold mb-4">クイックアクション</h2>
        <div className="flex gap-4 flex-wrap">
          <Link href="/projects/new">
            <Button>新規業務登録</Button>
          </Link>
          <Link href="/accounts/new">
            <Button variant="outline">新規法人登録</Button>
          </Link>
          <Link href="/contacts/new">
            <Button variant="outline">新規個人顧客登録</Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
