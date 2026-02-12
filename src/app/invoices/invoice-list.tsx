"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  ExternalLink,
  FileText,
  X,
} from "lucide-react";
import {
  type InvoiceWithDetails,
  type BusinessEntity,
  type Employee,
} from "@/types/database";
import {
  toggleAccountingRegistered,
  updatePaymentDate,
  getInvoicePdfUrl,
} from "./actions";

interface InvoiceListProps {
  invoices: InvoiceWithDetails[];
  businessEntities: BusinessEntity[];
  employees: Employee[];
}

// 金額フォーマット
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
  }).format(amount);
}

// 日付フォーマット
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("ja-JP");
}

// 請求月の選択肢を生成（過去12ヶ月 + 未来3ヶ月）
function generateMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();

  for (let i = -12; i <= 3; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = `${date.getFullYear()}年${date.getMonth() + 1}月`;
    options.push({ value, label });
  }

  return options.reverse(); // 新しい月が上に
}

export function InvoiceList({
  invoices,
  businessEntities,
  employees,
}: InvoiceListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // フィルタ状態
  const [searchQuery, setSearchQuery] = useState("");
  const [filterEntity, setFilterEntity] = useState<string>("all");
  const [filterAccounting, setFilterAccounting] = useState<string>("all");
  const [filterPayment, setFilterPayment] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>("all");

  // 月の選択肢
  const monthOptions = useMemo(() => generateMonthOptions(), []);

  // フィルタリング
  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      // 検索クエリ
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesNumber = invoice.invoice_number.toLowerCase().includes(query);
        const matchesProject = invoice.project?.name?.toLowerCase().includes(query);
        const matchesRecipient = invoice.recipientContact
          ? `${invoice.recipientContact.last_name} ${invoice.recipientContact.first_name}`.toLowerCase().includes(query)
          : false;
        const matchesAccount = invoice.recipientAccount?.company_name?.toLowerCase().includes(query);
        if (!matchesNumber && !matchesProject && !matchesRecipient && !matchesAccount) {
          return false;
        }
      }

      // 事業主体フィルタ
      if (filterEntity !== "all" && invoice.business_entity_id !== filterEntity) {
        return false;
      }

      // 会計登録フィルタ
      if (filterAccounting === "registered" && !invoice.is_accounting_registered) {
        return false;
      }
      if (filterAccounting === "unregistered" && invoice.is_accounting_registered) {
        return false;
      }

      // 入金フィルタ（入金日があれば入金済み）
      const isPaid = !!invoice.payment_received_date;
      if (filterPayment === "received" && !isPaid) {
        return false;
      }
      if (filterPayment === "unreceived" && isPaid) {
        return false;
      }

      // 請求月フィルタ
      if (filterMonth !== "all") {
        const invoiceMonth = invoice.invoice_date.substring(0, 7); // yyyy-MM
        if (invoiceMonth !== filterMonth) {
          return false;
        }
      }

      return true;
    });
  }, [invoices, searchQuery, filterEntity, filterAccounting, filterPayment, filterMonth]);

  // 集計
  const totals = useMemo(() => {
    const paid = filteredInvoices.filter((i) => !!i.payment_received_date);
    return {
      feeTaxExcluded: filteredInvoices.reduce((sum, i) => sum + i.fee_tax_excluded, 0),
      expenses: filteredInvoices.reduce((sum, i) => sum + i.expenses, 0),
      totalAmount: filteredInvoices.reduce((sum, i) => sum + i.total_amount, 0),
      accountingRegistered: filteredInvoices.filter((i) => i.is_accounting_registered).length,
      paymentReceived: paid.length,
    };
  }, [filteredInvoices]);

  const handleToggleAccounting = async (invoiceId: string, current: boolean) => {
    startTransition(async () => {
      await toggleAccountingRegistered(invoiceId, !current);
      router.refresh();
    });
  };

  const handlePaymentDateChange = async (invoiceId: string, date: string) => {
    startTransition(async () => {
      await updatePaymentDate(invoiceId, date || null);
      router.refresh();
    });
  };

  const handleOpenPdf = async (pdfPath: string) => {
    const { url, error } = await getInvoicePdfUrl(pdfPath);
    if (error || !url) {
      alert("PDFを開けませんでした");
      return;
    }
    window.open(url, "_blank");
  };

  const clearFilters = () => {
    setSearchQuery("");
    setFilterEntity("all");
    setFilterAccounting("all");
    setFilterPayment("all");
    setFilterMonth("all");
  };

  const hasActiveFilters =
    searchQuery || filterEntity !== "all" || filterAccounting !== "all" || filterPayment !== "all" || filterMonth !== "all";

  return (
    <div className="space-y-6">
      {/* フィルタ */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            {/* 検索 */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="請求書番号、業務名、相手先で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* 請求月フィルタ */}
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="請求月" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべての月</SelectItem>
                {monthOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* 事業主体フィルタ */}
            <Select value={filterEntity} onValueChange={setFilterEntity}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="事業主体" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべての事業主体</SelectItem>
                {businessEntities.map((entity) => (
                  <SelectItem key={entity.id} value={entity.id}>
                    {entity.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* 入金フィルタ */}
            <Select value={filterPayment} onValueChange={setFilterPayment}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="入金状況" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                <SelectItem value="received">入金済</SelectItem>
                <SelectItem value="unreceived">未入金</SelectItem>
              </SelectContent>
            </Select>

            {/* 会計登録フィルタ */}
            <Select value={filterAccounting} onValueChange={setFilterAccounting}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="会計登録" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                <SelectItem value="registered">登録済</SelectItem>
                <SelectItem value="unregistered">未登録</SelectItem>
              </SelectContent>
            </Select>

            {/* フィルタクリア */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                クリア
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 集計サマリ */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-sm text-muted-foreground">件数</div>
            <div className="text-2xl font-bold">{filteredInvoices.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-sm text-muted-foreground">税抜報酬計</div>
            <div className="text-lg font-bold">{formatCurrency(totals.feeTaxExcluded)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-sm text-muted-foreground">立替金計</div>
            <div className="text-lg font-bold">{formatCurrency(totals.expenses)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-sm text-muted-foreground">請求金額計</div>
            <div className="text-xl font-bold">{formatCurrency(totals.totalAmount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-sm text-muted-foreground">入金済 / 会計登録済</div>
            <div className="text-lg font-bold">
              {totals.paymentReceived} / {totals.accountingRegistered}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 一覧テーブル */}
      <Card>
        <CardContent className="pt-6">
          {filteredInvoices.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              {hasActiveFilters
                ? "条件に一致する請求書がありません"
                : "請求書がありません"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">請求書番号</TableHead>
                    <TableHead className="w-[100px]">請求日</TableHead>
                    <TableHead className="w-[130px]">入金日</TableHead>
                    <TableHead>相手先</TableHead>
                    <TableHead>業務名</TableHead>
                    <TableHead className="text-right">請求金額</TableHead>
                    <TableHead className="w-[80px]">事業主体</TableHead>
                    <TableHead className="text-center w-[60px]">会計</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id} className={invoice.payment_received_date ? "bg-green-50" : ""}>
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-1">
                          {invoice.pdf_path && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              title="PDFを開く"
                              onClick={() => handleOpenPdf(invoice.pdf_path!)}
                            >
                              <FileText className="h-4 w-4 text-primary" />
                            </Button>
                          )}
                          <span>{invoice.invoice_number}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(invoice.invoice_date)}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={invoice.payment_received_date || ""}
                          onChange={(e) => handlePaymentDateChange(invoice.id, e.target.value)}
                          disabled={isPending}
                          className="h-8 w-[120px] text-sm"
                        />
                      </TableCell>
                      <TableCell className="text-sm">
                        {invoice.recipientAccount?.company_name && (
                          <div className="font-medium">{invoice.recipientAccount.company_name}</div>
                        )}
                        {invoice.recipientContact && (
                          <div className={invoice.recipientAccount ? "text-xs text-muted-foreground" : ""}>
                            {invoice.recipientContact.last_name} {invoice.recipientContact.first_name}
                          </div>
                        )}
                        {!invoice.recipientContact && !invoice.recipientAccount && "-"}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/projects/${invoice.project_id}`}
                          className="hover:underline text-primary"
                        >
                          {invoice.project?.name || "-"}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {invoice.project?.code}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(invoice.total_amount)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <Badge variant="outline" className="font-normal">
                          {invoice.businessEntity?.code}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={invoice.is_accounting_registered}
                          onCheckedChange={() =>
                            handleToggleAccounting(invoice.id, invoice.is_accounting_registered)
                          }
                          disabled={isPending}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
