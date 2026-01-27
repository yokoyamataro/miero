import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Pencil, Phone, MapPin, Mail, User } from "lucide-react";
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {contacts && (contacts as Contact[]).length === 0 && (
          <Card className="md:col-span-2 lg:col-span-3">
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground py-8">
                個人顧客データがありません。新規登録してください。
              </p>
            </CardContent>
          </Card>
        )}

        {contacts &&
          (contacts as Contact[]).map((contact) => {
            const fullName = `${contact.last_name} ${contact.first_name}`;
            const fullNameKana =
              contact.last_name_kana && contact.first_name_kana
                ? `${contact.last_name_kana} ${contact.first_name_kana}`
                : null;

            const addressParts = [
              contact.prefecture,
              contact.city,
              contact.street,
            ].filter(Boolean);
            const address = addressParts.join("");

            return (
              <Card
                key={contact.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-lg">{fullName}</CardTitle>
                      {fullNameKana && (
                        <p className="text-xs text-muted-foreground">
                          {fullNameKana}
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm text-muted-foreground mb-4">
                    {contact.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <span>{contact.phone}</span>
                      </div>
                    )}
                    {contact.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        <span className="truncate">{contact.email}</span>
                      </div>
                    )}
                    {address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span className="truncate">{address}</span>
                      </div>
                    )}
                  </div>
                  {contact.notes && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {contact.notes}
                    </p>
                  )}
                  <div className="flex justify-end">
                    <Link href={`/contacts/${contact.id}/edit`}>
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
