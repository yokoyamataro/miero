"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, Trash2, KeyRound } from "lucide-react";
import type { Employee, EmployeeRole } from "@/types/database";
import {
  createEmployeeWithAuth,
  updateEmployee,
  deleteEmployee,
  resetEmployeePassword,
  type EmployeeData,
} from "./actions";

interface EmployeeFormProps {
  employee?: Employee & { auth_id?: string | null };
  isEdit?: boolean;
}

export function EmployeeForm({ employee, isEdit = false }: EmployeeFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [role, setRole] = useState<EmployeeRole>(employee?.role || "staff");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const formData = new FormData(e.currentTarget);

    const data: EmployeeData = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      role: role,
    };

    const password = formData.get("password") as string;

    startTransition(async () => {
      let result;
      if (isEdit && employee) {
        result = await updateEmployee(employee.id, data);
      } else {
        // 新規作成時は認証ユーザーも同時に作成
        if (!password || password.length < 6) {
          setError("パスワードは6文字以上で入力してください");
          return;
        }
        result = await createEmployeeWithAuth(data, password);
      }

      if (result.error) {
        setError(result.error);
      } else {
        router.push("/employees");
      }
    });
  };

  const handleDelete = async () => {
    if (!employee) return;
    if (!confirm("この社員を削除してもよろしいですか？\n※ログインアカウントも削除されます")) return;

    startTransition(async () => {
      const result = await deleteEmployee(employee.id);
      if (result.error) {
        setError(result.error);
      } else {
        router.push("/employees");
      }
    });
  };

  const handleResetPassword = async () => {
    if (!employee) return;
    const newPassword = prompt("新しいパスワードを入力してください（6文字以上）");
    if (!newPassword) return;
    if (newPassword.length < 6) {
      setError("パスワードは6文字以上で入力してください");
      return;
    }

    startTransition(async () => {
      const result = await resetEmployeePassword(employee.id, newPassword);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess("パスワードをリセットしました");
      }
    });
  };

  return (
    <>
      <header className="mb-8">
        <Link
          href="/employees"
          className="flex items-center text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          社員一覧に戻る
        </Link>
        <h1 className="text-2xl font-bold">
          {isEdit ? "社員編集" : "新規社員登録"}
        </h1>
      </header>

      {error && (
        <Card className="mb-6 border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {success && (
        <Card className="mb-6 border-green-500">
          <CardContent className="pt-6">
            <p className="text-green-600">{success}</p>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>社員情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">氏名 *</Label>
              <Input
                id="name"
                name="name"
                placeholder="例: 山田 太郎"
                defaultValue={employee?.name || ""}
                required
              />
            </div>

            <div>
              <Label htmlFor="email">メールアドレス *</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="例: yamada@example.com"
                defaultValue={employee?.email || ""}
                required
                disabled={isEdit} // 編集時はメール変更不可（認証と紐づいているため）
              />
              {isEdit && (
                <p className="text-xs text-muted-foreground mt-1">
                  メールアドレスは変更できません
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="role">権限 *</Label>
              <Select value={role} onValueChange={(val) => setRole(val as EmployeeRole)}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">管理者</SelectItem>
                  <SelectItem value="manager">マネージャー</SelectItem>
                  <SelectItem value="staff">スタッフ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* 新規作成時のみパスワード入力 */}
        {!isEdit && (
          <Card>
            <CardHeader>
              <CardTitle>ログイン設定</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="password">初期パスワード *</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="6文字以上"
                  required
                  minLength={6}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  このパスワードでシステムにログインできます
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 編集時のパスワードリセット */}
        {isEdit && employee?.auth_id && (
          <Card>
            <CardHeader>
              <CardTitle>ログイン設定</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                variant="outline"
                onClick={handleResetPassword}
                disabled={isPending}
              >
                <KeyRound className="h-4 w-4 mr-2" />
                パスワードをリセット
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-between">
          <div>
            {isEdit && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isPending}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                削除
              </Button>
            )}
          </div>
          <div className="flex gap-4">
            <Link href="/employees">
              <Button type="button" variant="outline">
                キャンセル
              </Button>
            </Link>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? "更新する" : "登録する"}
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}
