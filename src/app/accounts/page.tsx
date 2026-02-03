import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import type { Account, Contact } from "@/types/database";

export default async function AccountsPage() {
  const supabase = await createClient();

  const { data: accounts, error } = await supabase
    .from("accounts" as never)
    .select("*")
    .is("deleted_at", null)
    .order("company_name");

  const { data: allContacts } = await supabase
    .from("contacts" as never)
    .select("*")
    .not("account_id", "is", null)
    .is("deleted_at", null)
    .order("is_primary", { ascending: false })
    .order("last_name");

  const contactsByAccount = ((allContacts as Contact[]) || []).reduce(
    (acc, contact) => {
      if (contact.account_id) {
        if (!acc[contact.account_id]) {
          acc[contact.account_id] = [];
        }
        acc[contact.account_id].push(contact);
      }
      return acc;
    },
    {} as Record<string, Contact[]>
  );

  if (error) {
    console.error("Error fetching accounts:", error);
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold">法人管理</h1>
          <p className="text-muted-foreground">法人・組織情報の管理</p>
        </div>
        <Link href="/accounts/new">
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
                <TableHead>法人名</TableHead>
                <TableHead>業種</TableHead>
                <TableHead>主担当者</TableHead>
                <TableHead>電話番号</TableHead>
                <TableHead>担当者数</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts && (accounts as Account[]).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    法人データがありません。新規登録してください。
                  </TableCell>
                </TableRow>
              )}
              {accounts &&
                (accounts as Account[]).map((account) => {
                  const contacts = contactsByAccount[account.id] || [];
                  const primaryContact = contacts.find((c) => c.is_primary);
                  const contactCount = contacts.length;

                  return (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">
                        {account.company_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {account.industry || "-"}
                      </TableCell>
                      <TableCell>
                        {primaryContact ? (
                          <span>
                            {primaryContact.last_name} {primaryContact.first_name}
                            {primaryContact.department && (
                              <span className="text-xs text-muted-foreground ml-1">
                                ({primaryContact.department})
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {primaryContact?.phone || account.main_phone || "-"}
                      </TableCell>
                      <TableCell>
                        {contactCount > 0 ? (
                          <Badge variant="secondary" className="text-xs">
                            {contactCount}名
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Link href={`/accounts/${account.id}/edit`}>
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
