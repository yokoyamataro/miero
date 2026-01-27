import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Phone, MapPin, User, Users, Building2 } from "lucide-react";
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {accounts && (accounts as Account[]).length === 0 && (
          <Card className="md:col-span-2 lg:col-span-3">
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground py-8">
                法人データがありません。新規登録してください。
              </p>
            </CardContent>
          </Card>
        )}

        {accounts &&
          (accounts as Account[]).map((account) => {
            const contacts = contactsByAccount[account.id] || [];
            const primaryContact = contacts.find((c) => c.is_primary);
            const contactCount = contacts.length;

            const addressParts = [
              account.prefecture,
              account.city,
              account.street,
            ].filter(Boolean);
            const address = addressParts.join("");

            return (
              <Card
                key={account.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-lg">
                        {account.company_name}
                      </CardTitle>
                    </div>
                    {contactCount > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        <Users className="h-3 w-3 mr-1" />
                        {contactCount}名
                      </Badge>
                    )}
                  </div>
                  {account.industry && (
                    <p className="text-xs text-muted-foreground">
                      {account.industry}
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm text-muted-foreground mb-4">
                    {primaryContact && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>
                          {primaryContact.last_name} {primaryContact.first_name}
                          {primaryContact.department && (
                            <span className="text-xs ml-1">
                              ({primaryContact.department})
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                    {(primaryContact?.phone || account.main_phone) && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <span>{primaryContact?.phone || account.main_phone}</span>
                      </div>
                    )}
                    {address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span className="truncate">{address}</span>
                      </div>
                    )}
                  </div>
                  {account.notes && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {account.notes}
                    </p>
                  )}
                  <div className="flex justify-end">
                    <Link href={`/accounts/${account.id}/edit`}>
                      <Button variant="outline" size="sm">
                        <Pencil className="h-4 w-4 mr-2" />
                        編集
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
      </div>
    </main>
  );
}
