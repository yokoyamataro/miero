import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Contact } from "@/types/database";

export default async function ContactsPage() {
  const supabase = await createClient();

  // 個人顧客のみ取得（account_id が null のもの）
  const { data: contacts, error } = await supabase
    .from("contacts" as never)
    .select("*")
    .is("account_id", null)
    .is("deleted_at", null)
    .order("last_name_kana", { ascending: true, nullsFirst: false })
    .order("first_name_kana", { ascending: true, nullsFirst: false })
    .order("last_name")
    .order("first_name");

  if (error) {
    console.error("Error fetching contacts:", error);
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold">個人顧客</h1>
          <p className="text-muted-foreground">個人顧客情報の管理</p>
        </div>
        <Link href="/contacts/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            新規登録
          </Button>
        </Link>
      </header>

      {error && (
        <Card className="mb-6 border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">
              データの取得に失敗しました: {error.message}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>氏名</TableHead>
                <TableHead>電話番号</TableHead>
                <TableHead>メール</TableHead>
                <TableHead>住所</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts && (contacts as Contact[]).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    個人顧客データがありません。新規登録してください。
                  </TableCell>
                </TableRow>
              )}
              {contacts &&
                (contacts as Contact[]).map((contact) => {
                  const fullName = `${contact.last_name} ${contact.first_name}`;
                  const fullNameKana =
                    contact.last_name_kana && contact.first_name_kana
                      ? `${contact.last_name_kana} ${contact.first_name_kana}`
                      : null;
                  const initial = contact.last_name_kana
                    ? contact.last_name_kana.charAt(0)
                    : contact.last_name.charAt(0);

                  const addressParts = [
                    contact.prefecture,
                    contact.city,
                    contact.street,
                  ].filter(Boolean);
                  const address = addressParts.join("");

                  return (
                    <TableRow key={contact.id}>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {initial}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div>{fullName}</div>
                        {fullNameKana && (
                          <div className="text-xs text-muted-foreground">
                            {fullNameKana}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {contact.phone || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <span className="truncate block max-w-[200px]">
                          {contact.email || "-"}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <span className="truncate block max-w-[200px]">
                          {address || "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Link href={`/contacts/${contact.id}/edit`}>
                          <Button variant="ghost" size="sm">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
