"use client";

import { useState, useMemo, useRef } from "react";
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
import { Button } from "@/components/ui/button";

// 五十音インデックス
const AIUEO_INDEX = [
  "ア", "カ", "サ", "タ", "ナ", "ハ", "マ", "ヤ", "ラ", "ワ"
];

// カタカナの行を判定
function getKanaRow(kana: string | null): string | null {
  if (!kana) return null;
  const firstChar = kana.charAt(0);

  if (/^[アイウエオ]/.test(firstChar)) return "ア";
  if (/^[カキクケコガギグゲゴ]/.test(firstChar)) return "カ";
  if (/^[サシスセソザジズゼゾ]/.test(firstChar)) return "サ";
  if (/^[タチツテトダヂヅデド]/.test(firstChar)) return "タ";
  if (/^[ナニヌネノ]/.test(firstChar)) return "ナ";
  if (/^[ハヒフヘホバビブベボパピプペポ]/.test(firstChar)) return "ハ";
  if (/^[マミムメモ]/.test(firstChar)) return "マ";
  if (/^[ヤユヨ]/.test(firstChar)) return "ヤ";
  if (/^[ラリルレロ]/.test(firstChar)) return "ラ";
  if (/^[ワヲン]/.test(firstChar)) return "ワ";

  return null;
}

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
  const [activeTab, setActiveTab] = useState<"accounts" | "individuals">("accounts");
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // 法人を五十音行ごとにグループ化
  const accountsByRow = useMemo(() => {
    const grouped: Record<string, Account[]> = {};
    for (const account of accounts) {
      const row = getKanaRow(account.company_name_kana) || "他";
      if (!grouped[row]) grouped[row] = [];
      grouped[row].push(account);
    }
    return grouped;
  }, [accounts]);

  // 個人を五十音行ごとにグループ化
  const individualsByRow = useMemo(() => {
    const grouped: Record<string, Individual[]> = {};
    for (const individual of individuals) {
      const row = getKanaRow(individual.last_name_kana) || "他";
      if (!grouped[row]) grouped[row] = [];
      grouped[row].push(individual);
    }
    return grouped;
  }, [individuals]);

  // 該当行へスクロール
  const scrollToRow = (row: string) => {
    const element = document.getElementById(`row-${activeTab}-${row}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // 現在のタブで存在する行
  const availableRows = activeTab === "accounts"
    ? Object.keys(accountsByRow)
    : Object.keys(individualsByRow);

  return (
    <Tabs defaultValue="accounts" className="w-full" onValueChange={(v) => setActiveTab(v as "accounts" | "individuals")}>
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
          <div className="flex gap-4">
            {/* 五十音インデックス */}
            <div className="flex flex-col gap-1 sticky top-4 h-fit">
              {AIUEO_INDEX.map((row) => (
                <Button
                  key={row}
                  variant={availableRows.includes(row) ? "outline" : "ghost"}
                  size="sm"
                  className="w-10 h-8 text-sm"
                  disabled={!availableRows.includes(row)}
                  onClick={() => scrollToRow(row)}
                >
                  {row}
                </Button>
              ))}
              {availableRows.includes("他") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-10 h-8 text-sm"
                  onClick={() => scrollToRow("他")}
                >
                  他
                </Button>
              )}
            </div>

            {/* テーブル */}
            <div className="flex-1 border rounded-lg" ref={tableContainerRef}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>法人名</TableHead>
                    <TableHead>主担当者</TableHead>
                    <TableHead>電話番号</TableHead>
                    <TableHead>所在地</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...AIUEO_INDEX, "他"].map((row) => {
                    const rowAccounts = accountsByRow[row];
                    if (!rowAccounts || rowAccounts.length === 0) return null;

                    return rowAccounts.map((account, idx) => {
                      const primaryContact = account.contacts?.find(
                        (c) => c.is_primary
                      );
                      return (
                        <TableRow key={account.id} id={idx === 0 ? `row-accounts-${row}` : undefined}>
                          <TableCell className="font-bold text-lg text-muted-foreground">
                            {idx === 0 ? row : ""}
                          </TableCell>
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
                    });
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </TabsContent>

      <TabsContent value="individuals">
        {individuals.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            個人顧客がまだ登録されていません
          </p>
        ) : (
          <div className="flex gap-4">
            {/* 五十音インデックス */}
            <div className="flex flex-col gap-1 sticky top-4 h-fit">
              {AIUEO_INDEX.map((row) => (
                <Button
                  key={row}
                  variant={availableRows.includes(row) ? "outline" : "ghost"}
                  size="sm"
                  className="w-10 h-8 text-sm"
                  disabled={!availableRows.includes(row)}
                  onClick={() => scrollToRow(row)}
                >
                  {row}
                </Button>
              ))}
              {availableRows.includes("他") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-10 h-8 text-sm"
                  onClick={() => scrollToRow("他")}
                >
                  他
                </Button>
              )}
            </div>

            {/* テーブル */}
            <div className="flex-1 border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>氏名</TableHead>
                    <TableHead>フリガナ</TableHead>
                    <TableHead>電話番号</TableHead>
                    <TableHead>住所</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...AIUEO_INDEX, "他"].map((row) => {
                    const rowIndividuals = individualsByRow[row];
                    if (!rowIndividuals || rowIndividuals.length === 0) return null;

                    return rowIndividuals.map((individual, idx) => (
                      <TableRow key={individual.id} id={idx === 0 ? `row-individuals-${row}` : undefined}>
                        <TableCell className="font-bold text-lg text-muted-foreground">
                          {idx === 0 ? row : ""}
                        </TableCell>
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
                    ));
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
