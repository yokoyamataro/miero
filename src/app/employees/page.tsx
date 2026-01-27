import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { EmployeeRole } from "@/types/database";

const ROLE_LABELS: Record<EmployeeRole, string> = {
  admin: "管理者",
  manager: "マネージャー",
  staff: "スタッフ",
};

const ROLE_COLORS: Record<EmployeeRole, string> = {
  admin: "bg-red-100 text-red-800",
  manager: "bg-blue-100 text-blue-800",
  staff: "bg-gray-100 text-gray-800",
};

export default async function EmployeesPage() {
  const supabase = await createClient();

  const { data: employees, error } = await supabase
    .from("employees")
    .select("*")
    .order("name");

  if (error) {
    console.error("Error fetching employees:", error);
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold">社員管理</h1>
          <p className="text-muted-foreground">社員情報・権限の管理</p>
        </div>
        <Link href="/employees/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            新規登録
          </Button>
        </Link>
      </header>

      {error && (
        <Card className="mb-6 border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">データの取得に失敗しました: {error.message}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {employees && employees.length === 0 && (
          <Card className="md:col-span-2 lg:col-span-3">
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground py-8">
                社員データがありません。新規登録してください。
              </p>
            </CardContent>
          </Card>
        )}

        {employees &&
          employees.map((employee) => (
            <Card key={employee.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{employee.name}</CardTitle>
                  <Badge className={ROLE_COLORS[employee.role as EmployeeRole]}>
                    {ROLE_LABELS[employee.role as EmployeeRole]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {employee.email}
                </p>
                <div className="flex justify-end">
                  <Link href={`/employees/${employee.id}/edit`}>
                    <Button variant="outline" size="sm">
                      <Pencil className="h-4 w-4 mr-2" />
                      編集
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
      </div>
    </main>
  );
}
