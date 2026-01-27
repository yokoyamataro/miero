"use client";

import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Building2, User } from "lucide-react";

interface Account {
  id: string;
  company_name: string;
  company_name_kana: string | null;
  main_phone: string | null;
  prefecture: string | null;
  city: string | null;
  contacts: {
    id: string;
    last_name: string;
    first_name: string;
    is_primary: boolean;
  }[];
}

interface Individual {
  id: string;
  last_name: string;
  first_name: string;
  last_name_kana: string | null;
  first_name_kana: string | null;
  phone: string | null;
  prefecture: string | null;
  city: string | null;
}

interface CustomerTabsProps {
  accounts: Account[];
  individuals: Individual[];
}

export function CustomerTabs({ accounts, individuals }: CustomerTabsProps) {
  return (
    <Tabs defaultValue="accounts" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="accounts" className="gap-2">
          <Building2 className="h-4 w-4" />
          法人 ({accounts.length})
        </TabsTrigger>
        <TabsTrigger value="individuals" className="gap-2">
          <User className="h-4 w-4" />
          個人 ({individuals.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="accounts">
        {accounts.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            法人顧客がまだ登録されていません
          </p>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>法人名</TableHead>
                  <TableHead>主担当者</TableHead>
                  <TableHead>電話番号</TableHead>
                  <TableHead>所在地</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => {
                  const primaryContact = account.contacts?.find(
                    (c) => c.is_primary
                  );
                  return (
                    <TableRow key={account.id}>
                      <TableCell>
                        <Link
                          href={`/accounts/${account.id}/edit`}
                          className="text-primary hover:underline font-medium"
                        >
                          {account.company_name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {primaryContact
                          ? `${primaryContact.last_name} ${primaryContact.first_name}`
                          : "-"}
                      </TableCell>
                      <TableCell>{account.main_phone || "-"}</TableCell>
                      <TableCell>
                        {account.prefecture && account.city
                          ? `${account.prefecture}${account.city}`
                          : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </TabsContent>

      <TabsContent value="individuals">
        {individuals.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            個人顧客がまだ登録されていません
          </p>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>氏名</TableHead>
                  <TableHead>フリガナ</TableHead>
                  <TableHead>電話番号</TableHead>
                  <TableHead>住所</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {individuals.map((individual) => (
                  <TableRow key={individual.id}>
                    <TableCell>
                      <Link
                        href={`/contacts/${individual.id}/edit`}
                        className="text-primary hover:underline font-medium"
                      >
                        {individual.last_name} {individual.first_name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {individual.last_name_kana && individual.first_name_kana
                        ? `${individual.last_name_kana} ${individual.first_name_kana}`
                        : "-"}
                    </TableCell>
                    <TableCell>{individual.phone || "-"}</TableCell>
                    <TableCell>
                      {individual.prefecture && individual.city
                        ? `${individual.prefecture}${individual.city}`
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
