"use client";

import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, User, FileText, UserMinus, Merge, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocumentTab } from "./document-tab";
import { convertAccountToIndividual, mergeAccounts } from "@/app/accounts/actions";
import type { Account, Contact, Employee, DocumentTemplate, Branch } from "@/types/database";

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

interface AccountLocal {
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

interface IndividualLocal {
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
  individuals: Contact[];
  allContacts: Contact[];
  employees: Employee[];
  templates: DocumentTemplate[];
  branches: Branch[];
  currentEmployeeId: string | null;
}

export function CustomerTabs({
  accounts,
  individuals,
  allContacts,
  employees,
  templates,
  branches,
  currentEmployeeId,
}: CustomerTabsProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"accounts" | "individuals" | "documents">("accounts");
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // 検索クエリ
  const [accountSearch, setAccountSearch] = useState("");
  const [individualSearch, setIndividualSearch] = useState("");

  // 個人移行ダイアログ
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [convertTarget, setConvertTarget] = useState<AccountLocal | null>(null);
  const [convertLastName, setConvertLastName] = useState("");
  const [convertFirstName, setConvertFirstName] = useState("");
  const [convertLastNameKana, setConvertLastNameKana] = useState("");
  const [convertFirstNameKana, setConvertFirstNameKana] = useState("");
  const [isConverting, setIsConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);

  // 統合ダイアログ
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeSource, setMergeSource] = useState<AccountLocal | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [isMerging, setIsMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);

  // 個人移行ダイアログを開く
  const openConvertDialog = (account: AccountLocal) => {
    setConvertTarget(account);
    // 主担当者がいればその名前をデフォルト値として設定
    const primaryContact = account.contacts?.find((c) => c.is_primary);
    if (primaryContact) {
      setConvertLastName(primaryContact.last_name);
      setConvertFirstName(primaryContact.first_name);
    } else {
      setConvertLastName("");
      setConvertFirstName("");
    }
    setConvertLastNameKana("");
    setConvertFirstNameKana("");
    setConvertError(null);
    setConvertDialogOpen(true);
  };

  // 個人移行を実行
  const handleConvert = async () => {
    if (!convertTarget || !convertLastName.trim() || !convertFirstName.trim()) {
      setConvertError("氏名は必須です");
      return;
    }

    setIsConverting(true);
    setConvertError(null);

    const result = await convertAccountToIndividual({
      accountId: convertTarget.id,
      lastName: convertLastName.trim(),
      firstName: convertFirstName.trim(),
      lastNameKana: convertLastNameKana.trim() || null,
      firstNameKana: convertFirstNameKana.trim() || null,
    });

    if (result.error) {
      setConvertError(result.error);
      setIsConverting(false);
      return;
    }

    setIsConverting(false);
    setConvertDialogOpen(false);
    router.refresh();
  };

  // 統合ダイアログを開く
  const openMergeDialog = (account: AccountLocal) => {
    setMergeSource(account);
    setMergeTargetId("");
    setMergeError(null);
    setMergeDialogOpen(true);
  };

  // 統合を実行
  const handleMerge = async () => {
    if (!mergeSource || !mergeTargetId) {
      setMergeError("統合先を選択してください");
      return;
    }

    setIsMerging(true);
    setMergeError(null);

    const result = await mergeAccounts({
      sourceAccountId: mergeSource.id,
      targetAccountId: mergeTargetId,
    });

    if (result.error) {
      setMergeError(result.error);
      setIsMerging(false);
      return;
    }

    setIsMerging(false);
    setMergeDialogOpen(false);
    router.refresh();
  };

  // 型変換（contacts付きの法人データ用）
  const accountsLocal = accounts as unknown as AccountLocal[];
  const individualsLocal = individuals as unknown as IndividualLocal[];

  // 法人を検索でフィルタリング
  const filteredAccounts = useMemo(() => {
    if (!accountSearch.trim()) return accountsLocal;
    const q = accountSearch.toLowerCase();
    return accountsLocal.filter((account) => {
      const companyName = account.company_name?.toLowerCase() || "";
      const companyNameKana = account.company_name_kana?.toLowerCase() || "";
      const phone = account.main_phone?.toLowerCase() || "";
      const location = `${account.prefecture || ""}${account.city || ""}`.toLowerCase();
      const primaryContact = account.contacts?.find((c) => c.is_primary);
      const contactName = primaryContact
        ? `${primaryContact.last_name} ${primaryContact.first_name}`.toLowerCase()
        : "";
      return (
        companyName.includes(q) ||
        companyNameKana.includes(q) ||
        phone.includes(q) ||
        location.includes(q) ||
        contactName.includes(q)
      );
    });
  }, [accountsLocal, accountSearch]);

  // 個人を検索でフィルタリング
  const filteredIndividuals = useMemo(() => {
    if (!individualSearch.trim()) return individualsLocal;
    const q = individualSearch.toLowerCase();
    return individualsLocal.filter((individual) => {
      const fullName = `${individual.last_name} ${individual.first_name}`.toLowerCase();
      const fullNameKana = `${individual.last_name_kana || ""} ${individual.first_name_kana || ""}`.toLowerCase();
      const phone = individual.phone?.toLowerCase() || "";
      const location = `${individual.prefecture || ""}${individual.city || ""}`.toLowerCase();
      return (
        fullName.includes(q) ||
        fullNameKana.includes(q) ||
        phone.includes(q) ||
        location.includes(q)
      );
    });
  }, [individualsLocal, individualSearch]);

  // 法人を五十音行ごとにグループ化
  const accountsByRow = useMemo(() => {
    const grouped: Record<string, AccountLocal[]> = {};
    for (const account of filteredAccounts) {
      const row = getKanaRow(account.company_name_kana) || "他";
      if (!grouped[row]) grouped[row] = [];
      grouped[row].push(account);
    }
    return grouped;
  }, [filteredAccounts]);

  // 個人を五十音行ごとにグループ化
  const individualsByRow = useMemo(() => {
    const grouped: Record<string, IndividualLocal[]> = {};
    for (const individual of filteredIndividuals) {
      const row = getKanaRow(individual.last_name_kana) || "他";
      if (!grouped[row]) grouped[row] = [];
      grouped[row].push(individual);
    }
    return grouped;
  }, [filteredIndividuals]);

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
    <Tabs defaultValue="accounts" className="w-full" onValueChange={(v) => setActiveTab(v as "accounts" | "individuals" | "documents")}>
      <TabsList className="mb-4">
        <TabsTrigger value="accounts" className="gap-2">
          <Building2 className="h-4 w-4" />
          法人 ({accounts.length})
        </TabsTrigger>
        <TabsTrigger value="individuals" className="gap-2">
          <User className="h-4 w-4" />
          個人 ({individuals.length})
        </TabsTrigger>
        <TabsTrigger value="documents" className="gap-2">
          <FileText className="h-4 w-4" />
          文書
        </TabsTrigger>
      </TabsList>

      <TabsContent value="accounts">
        {/* 検索バー */}
        <div className="mb-4 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="法人名、担当者、電話番号、住所で検索..."
            value={accountSearch}
            onChange={(e) => setAccountSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {filteredAccounts.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            {accountsLocal.length === 0
              ? "法人顧客がまだ登録されていません"
              : "検索結果がありません"}
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
                  <TableRow className="h-8">
                    <TableHead className="w-12 py-1 text-xs"></TableHead>
                    <TableHead className="py-1 text-xs">法人名</TableHead>
                    <TableHead className="py-1 text-xs">主担当者</TableHead>
                    <TableHead className="py-1 text-xs">電話番号</TableHead>
                    <TableHead className="py-1 text-xs">所在地</TableHead>
                    <TableHead className="w-20 py-1 text-xs">操作</TableHead>
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
                        <TableRow key={account.id} id={idx === 0 ? `row-accounts-${row}` : undefined} className="h-8">
                          <TableCell className="py-1 font-bold text-sm text-muted-foreground">
                            {idx === 0 ? row : ""}
                          </TableCell>
                          <TableCell className="py-1 text-sm">
                            <Link
                              href={`/accounts/${account.id}/edit`}
                              className="text-primary hover:underline font-medium"
                            >
                              {account.company_name}
                            </Link>
                          </TableCell>
                          <TableCell className="py-1 text-sm">
                            {primaryContact
                              ? `${primaryContact.last_name} ${primaryContact.first_name}`
                              : "-"}
                          </TableCell>
                          <TableCell className="py-1 text-sm">{account.main_phone || "-"}</TableCell>
                          <TableCell className="py-1 text-sm">
                            {account.prefecture && account.city
                              ? `${account.prefecture}${account.city}`
                              : "-"}
                          </TableCell>
                          <TableCell className="py-1">
                            <div className="flex gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="個人に移行"
                                onClick={() => openConvertDialog(account)}
                              >
                                <UserMinus className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="統合"
                                onClick={() => openMergeDialog(account)}
                              >
                                <Merge className="h-3.5 w-3.5" />
                              </Button>
                            </div>
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
        {/* 検索バー */}
        <div className="mb-4 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="氏名、フリガナ、電話番号、住所で検索..."
            value={individualSearch}
            onChange={(e) => setIndividualSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {filteredIndividuals.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            {individualsLocal.length === 0
              ? "個人顧客がまだ登録されていません"
              : "検索結果がありません"}
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
                  <TableRow className="h-8">
                    <TableHead className="w-12 py-1 text-xs"></TableHead>
                    <TableHead className="py-1 text-xs">氏名</TableHead>
                    <TableHead className="py-1 text-xs">フリガナ</TableHead>
                    <TableHead className="py-1 text-xs">電話番号</TableHead>
                    <TableHead className="py-1 text-xs">住所</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...AIUEO_INDEX, "他"].map((row) => {
                    const rowIndividuals = individualsByRow[row];
                    if (!rowIndividuals || rowIndividuals.length === 0) return null;

                    return rowIndividuals.map((individual, idx) => (
                      <TableRow key={individual.id} id={idx === 0 ? `row-individuals-${row}` : undefined} className="h-8">
                        <TableCell className="py-1 font-bold text-sm text-muted-foreground">
                          {idx === 0 ? row : ""}
                        </TableCell>
                        <TableCell className="py-1 text-sm">
                          <Link
                            href={`/contacts/${individual.id}/edit`}
                            className="text-primary hover:underline font-medium"
                          >
                            {individual.last_name} {individual.first_name}
                          </Link>
                        </TableCell>
                        <TableCell className="py-1 text-sm">
                          {individual.last_name_kana && individual.first_name_kana
                            ? `${individual.last_name_kana} ${individual.first_name_kana}`
                            : "-"}
                        </TableCell>
                        <TableCell className="py-1 text-sm">{individual.phone || "-"}</TableCell>
                        <TableCell className="py-1 text-sm">
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

      <TabsContent value="documents">
        <DocumentTab
          templates={templates}
          accounts={accounts}
          allContacts={allContacts}
          individuals={individuals}
          employees={employees}
          branches={branches}
          currentEmployeeId={currentEmployeeId}
        />
      </TabsContent>

      {/* 個人移行ダイアログ */}
      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>個人に移行</DialogTitle>
            <DialogDescription>
              「{convertTarget?.company_name}」を個人顧客に移行します。
              関連する業務は新しい個人に引き継がれます。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>姓 *</Label>
                <Input
                  value={convertLastName}
                  onChange={(e) => setConvertLastName(e.target.value)}
                  placeholder="山田"
                />
              </div>
              <div className="space-y-2">
                <Label>名 *</Label>
                <Input
                  value={convertFirstName}
                  onChange={(e) => setConvertFirstName(e.target.value)}
                  placeholder="太郎"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>セイ</Label>
                <Input
                  value={convertLastNameKana}
                  onChange={(e) => setConvertLastNameKana(e.target.value)}
                  placeholder="ヤマダ"
                />
              </div>
              <div className="space-y-2">
                <Label>メイ</Label>
                <Input
                  value={convertFirstNameKana}
                  onChange={(e) => setConvertFirstNameKana(e.target.value)}
                  placeholder="タロウ"
                />
              </div>
            </div>
            {convertError && (
              <p className="text-sm text-destructive">{convertError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleConvert} disabled={isConverting}>
              {isConverting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  移行中...
                </>
              ) : (
                "移行"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 統合ダイアログ */}
      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>法人を統合</DialogTitle>
            <DialogDescription>
              「{mergeSource?.company_name}」を別の法人に統合します。
              連絡先と業務は統合先に引き継がれます。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>統合先 *</Label>
              <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
                <SelectTrigger>
                  <SelectValue placeholder="統合先を選択" />
                </SelectTrigger>
                <SelectContent>
                  {accountsLocal
                    .filter((a) => a.id !== mergeSource?.id)
                    .map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.company_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {mergeError && (
              <p className="text-sm text-destructive">{mergeError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleMerge} disabled={isMerging}>
              {isMerging ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  統合中...
                </>
              ) : (
                "統合"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
