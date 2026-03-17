"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search,
  FileText,
  X,
  Trash2,
  Plus,
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
  deleteInvoice,
  createInvoice,
  uploadInvoicePdf,
  getProjectCustomerInfo,
} from "./actions";

interface ProjectForInvoice {
  id: string;
  code: string;
  name: string;
  contact_id: string | null;
}

interface InvoiceListProps {
  invoices: InvoiceWithDetails[];
  businessEntities: BusinessEntity[];
  employees: Employee[];
  projects: ProjectForInvoice[];
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

// 年の選択肢を生成（前年～来年）
function generateYearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  return [currentYear - 1, currentYear, currentYear + 1];
}

// 事業主体コードに応じた色を返す
function getEntityBadgeClass(code: string): string {
  if (code === "T" || code === "L") {
    return "bg-blue-100 text-blue-800 border-blue-300";
  }
  if (code === "S") {
    return "bg-green-100 text-green-800 border-green-300";
  }
  return "";
}

export function InvoiceList({
  invoices,
  businessEntities,
  employees,
  projects,
}: InvoiceListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // フィルタ状態
  const [searchQuery, setSearchQuery] = useState("");
  const [filterEntity, setFilterEntity] = useState<string>("all");
  const [filterAccounting, setFilterAccounting] = useState<string>("all");
  const [filterPayment, setFilterPayment] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<number | null>(null);

  // 削除確認ダイアログ
  const [deleteTarget, setDeleteTarget] = useState<InvoiceWithDetails | null>(null);

  // 請求書追加モーダル
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    project_id: "",
    business_entity_id: "",
    invoice_date: new Date().toISOString().split("T")[0],
    recipient_contact_id: "",
    person_in_charge_id: "",
    fee_tax_excluded: 0,
    expenses: 0,
    total_amount: 0,
    notes: "",
  });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [customerInfo, setCustomerInfo] = useState<{
    contacts: { id: string; name: string; accountName: string | null }[];
  } | null>(null);

  // 年の選択肢
  const yearOptions = useMemo(() => generateYearOptions(), []);

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

      // 年・月フィルタ
      if (filterYear !== "all" || filterMonth !== null) {
        const invoiceDate = new Date(invoice.invoice_date);
        const invoiceYear = invoiceDate.getFullYear();
        const invoiceMonth = invoiceDate.getMonth() + 1;

        if (filterYear !== "all" && invoiceYear !== parseInt(filterYear)) {
          return false;
        }
        if (filterMonth !== null && invoiceMonth !== filterMonth) {
          return false;
        }
      }

      return true;
    });
  }, [invoices, searchQuery, filterEntity, filterAccounting, filterPayment, filterYear, filterMonth]);

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

  const handleDeleteClick = (invoice: InvoiceWithDetails) => {
    setDeleteTarget(invoice);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      const { error } = await deleteInvoice(deleteTarget.id);
      if (error) {
        alert(error);
      }
      setDeleteTarget(null);
      router.refresh();
    });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setFilterEntity("all");
    setFilterAccounting("all");
    setFilterPayment("all");
    setFilterYear("all");
    setFilterMonth(null);
  };

  const hasActiveFilters =
    searchQuery || filterEntity !== "all" || filterAccounting !== "all" || filterPayment !== "all" || filterYear !== "all" || filterMonth !== null;

  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  // 請求書追加関連
  const resetForm = () => {
    setFormData({
      project_id: "",
      business_entity_id: "",
      invoice_date: new Date().toISOString().split("T")[0],
      recipient_contact_id: "",
      person_in_charge_id: "",
      fee_tax_excluded: 0,
      expenses: 0,
      total_amount: 0,
      notes: "",
    });
    setPdfFile(null);
    setCustomerInfo(null);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleCloseAddModal = () => {
    setShowAddModal(false);
    resetForm();
  };

  const handleProjectChange = async (projectId: string) => {
    setFormData({ ...formData, project_id: projectId, recipient_contact_id: "" });
    if (projectId) {
      const info = await getProjectCustomerInfo(projectId);
      setCustomerInfo(info);
      // 自動で最初の連絡先を選択
      if (info?.contacts?.length === 1) {
        setFormData((prev) => ({ ...prev, project_id: projectId, recipient_contact_id: info.contacts[0].id }));
      }
    } else {
      setCustomerInfo(null);
    }
  };

  // 請求金額を自動計算（税抜報酬 × 1.1 + 立替金）
  const calculateTotal = (feeTaxExcluded: number, expenses: number) => {
    const taxIncluded = Math.floor(feeTaxExcluded * 1.1);
    return taxIncluded + expenses;
  };

  const handleFeeChange = (value: number) => {
    const total = calculateTotal(value, formData.expenses);
    setFormData({ ...formData, fee_tax_excluded: value, total_amount: total });
  };

  const handleExpensesChange = (value: number) => {
    const total = calculateTotal(formData.fee_tax_excluded, value);
    setFormData({ ...formData, expenses: value, total_amount: total });
  };

  const handleSubmit = async () => {
    if (!formData.project_id || !formData.business_entity_id) return;

    const project = projects.find((p) => p.id === formData.project_id);
    const entity = businessEntities.find((e) => e.id === formData.business_entity_id);
    if (!project || !entity) return;

    startTransition(async () => {
      const result = await createInvoice({
        project_id: formData.project_id,
        project_code: project.code,
        business_entity_id: formData.business_entity_id,
        business_entity_code: entity.code,
        invoice_date: formData.invoice_date,
        recipient_contact_id: formData.recipient_contact_id || null,
        person_in_charge_id: formData.person_in_charge_id || null,
        fee_tax_excluded: formData.fee_tax_excluded,
        expenses: formData.expenses,
        total_amount: formData.total_amount,
        pdf_path: null,
        notes: formData.notes || null,
      });

      if (result.error) {
        alert(result.error);
        return;
      }

      // PDFがあればアップロード
      if (pdfFile && result.invoice) {
        const pdfFormData = new FormData();
        pdfFormData.append("file", pdfFile);
        const uploadResult = await uploadInvoicePdf(result.invoice.id, pdfFormData);
        if (uploadResult.error) {
          alert(uploadResult.error);
        }
      }

      handleCloseAddModal();
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {/* フィルタ */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* 1行目: 検索と基本フィルタ */}
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

            {/* 請求書追加ボタン */}
            <Button onClick={handleOpenAddModal} disabled={isPending}>
              <Plus className="h-4 w-4 mr-1" />
              請求書を追加
            </Button>

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

          {/* 2行目: 請求月フィルタ（年プルダウン + 月ボタン） */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">請求月:</span>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="年" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}年
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-1 flex-wrap">
              {months.map((month) => (
                <Button
                  key={month}
                  variant={filterMonth === month ? "default" : "outline"}
                  size="sm"
                  className="w-10 h-8"
                  onClick={() => setFilterMonth(filterMonth === month ? null : month)}
                >
                  {month}
                </Button>
              ))}
            </div>
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
                    <TableHead className="w-[180px]">請求書番号</TableHead>
                    <TableHead className="w-[100px]">請求日</TableHead>
                    <TableHead className="w-[150px]">入金日</TableHead>
                    <TableHead>相手先</TableHead>
                    <TableHead>業務名</TableHead>
                    <TableHead className="text-right">請求金額</TableHead>
                    <TableHead className="w-[80px]">事業主体</TableHead>
                    <TableHead className="text-center w-[60px]">会計</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id} className={invoice.payment_received_date ? "bg-green-50" : ""}>
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-1 whitespace-nowrap">
                          {invoice.pdf_path && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 flex-shrink-0"
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
                          type="text"
                          placeholder="YYYY-MM-DD"
                          value={invoice.payment_received_date || ""}
                          onChange={(e) => handlePaymentDateChange(invoice.id, e.target.value)}
                          disabled={isPending}
                          className="h-8 w-[120px] text-sm font-mono"
                        />
                      </TableCell>
                      <TableCell className="text-sm">
                        {invoice.recipientAccount?.company_name ? (
                          <div className="font-medium">{invoice.recipientAccount.company_name}</div>
                        ) : invoice.recipientContact ? (
                          <div>
                            {invoice.recipientContact.last_name} {invoice.recipientContact.first_name}
                          </div>
                        ) : (
                          "-"
                        )}
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
                        <Badge
                          variant="outline"
                          className={`font-normal ${getEntityBadgeClass(invoice.businessEntity?.code || "")}`}
                        >
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
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          title="削除"
                          onClick={() => handleDeleteClick(invoice)}
                          disabled={isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 削除確認ダイアログ */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>請求書を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              請求書「{deleteTarget?.invoice_number}」を削除します。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 請求書追加モーダル */}
      <Dialog open={showAddModal} onOpenChange={handleCloseAddModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>請求書を追加</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* 業務選択 */}
            <div className="space-y-2">
              <Label>業務 *</Label>
              <Select
                value={formData.project_id}
                onValueChange={handleProjectChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="業務を選択" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.code} - {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 事業主体 */}
            <div className="space-y-2">
              <Label>事業主体 *</Label>
              <Select
                value={formData.business_entity_id}
                onValueChange={(v) => setFormData({ ...formData, business_entity_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="事業主体を選択" />
                </SelectTrigger>
                <SelectContent>
                  {businessEntities.map((entity) => (
                    <SelectItem key={entity.id} value={entity.id}>
                      {entity.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 請求日 */}
            <div className="space-y-2">
              <Label>請求日 *</Label>
              <Input
                type="date"
                value={formData.invoice_date}
                onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
              />
            </div>

            {/* 相手先 */}
            {customerInfo && customerInfo.contacts.length > 0 && (
              <div className="space-y-2">
                <Label>相手先</Label>
                <Select
                  value={formData.recipient_contact_id || "__none__"}
                  onValueChange={(v) => setFormData({ ...formData, recipient_contact_id: v === "__none__" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="相手先を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">未選択</SelectItem>
                    {customerInfo.contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.accountName || contact.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* 請求担当者 */}
            <div className="space-y-2">
              <Label>請求担当者</Label>
              <Select
                value={formData.person_in_charge_id || "__none__"}
                onValueChange={(v) => setFormData({ ...formData, person_in_charge_id: v === "__none__" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="担当者を選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">未選択</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 金額入力 */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>税抜報酬</Label>
                <Input
                  type="number"
                  value={formData.fee_tax_excluded || ""}
                  onChange={(e) => handleFeeChange(Number(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>立替金</Label>
                <Input
                  type="number"
                  value={formData.expenses || ""}
                  onChange={(e) => handleExpensesChange(Number(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>請求金額</Label>
                <Input
                  type="number"
                  value={formData.total_amount || ""}
                  onChange={(e) => setFormData({ ...formData, total_amount: Number(e.target.value) || 0 })}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">
                  自動計算: 税抜×1.1+立替
                </p>
              </div>
            </div>

            {/* PDFアップロード */}
            <div className="space-y-2">
              <Label>PDF</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                  className="flex-1"
                />
              </div>
            </div>

            {/* 備考 */}
            <div className="space-y-2">
              <Label>備考</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>

            {/* ボタン */}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleCloseAddModal} disabled={isPending}>
                キャンセル
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isPending || !formData.project_id || !formData.business_entity_id}
              >
                追加
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
