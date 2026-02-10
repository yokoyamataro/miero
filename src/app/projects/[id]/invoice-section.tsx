"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Receipt,
  Plus,
  Upload,
  FileText,
  Check,
  X,
  Pencil,
  Trash2,
  ExternalLink,
} from "lucide-react";
import {
  type InvoiceWithDetails,
  type BusinessEntity,
  type Employee,
  type Contact,
} from "@/types/database";
import {
  createInvoice,
  updateInvoice,
  deleteInvoice,
  toggleAccountingRegistered,
  togglePaymentReceived,
} from "@/app/invoices/actions";
import type { CustomerData } from "./project-info";

interface InvoiceSectionProps {
  projectId: string;
  projectCode: string;
  invoices: InvoiceWithDetails[];
  businessEntities: BusinessEntity[];
  employees: Employee[];
  customerData: CustomerData;
  defaultRecipientContactId: string | null;
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

export function InvoiceSection({
  projectId,
  projectCode,
  invoices,
  businessEntities,
  employees,
  customerData,
  defaultRecipientContactId,
}: InvoiceSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceWithDetails | null>(null);

  // フォーム状態
  const [formData, setFormData] = useState({
    business_entity_id: "",
    invoice_date: new Date().toISOString().split("T")[0],
    recipient_contact_id: defaultRecipientContactId || "",
    person_in_charge_id: "",
    fee_tax_excluded: 0,
    expenses: 0,
    total_amount: 0,
    notes: "",
  });

  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const resetForm = () => {
    setFormData({
      business_entity_id: "",
      invoice_date: new Date().toISOString().split("T")[0],
      recipient_contact_id: defaultRecipientContactId || "",
      person_in_charge_id: "",
      fee_tax_excluded: 0,
      expenses: 0,
      total_amount: 0,
      notes: "",
    });
    setPdfFile(null);
    setEditingInvoice(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleOpenEdit = (invoice: InvoiceWithDetails) => {
    setFormData({
      business_entity_id: invoice.business_entity_id,
      invoice_date: invoice.invoice_date,
      recipient_contact_id: invoice.recipient_contact_id || "",
      person_in_charge_id: invoice.person_in_charge_id || "",
      fee_tax_excluded: invoice.fee_tax_excluded,
      expenses: invoice.expenses,
      total_amount: invoice.total_amount,
      notes: invoice.notes || "",
    });
    setEditingInvoice(invoice);
    setShowAddModal(true);
  };

  const handleClose = () => {
    setShowAddModal(false);
    resetForm();
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
    if (!formData.business_entity_id) return;

    const entity = businessEntities.find((e) => e.id === formData.business_entity_id);
    if (!entity) return;

    startTransition(async () => {
      // TODO: PDFアップロード処理（Supabase Storage）
      const pdfPath = null;

      if (editingInvoice) {
        // 更新
        await updateInvoice(editingInvoice.id, {
          invoice_date: formData.invoice_date,
          recipient_contact_id: formData.recipient_contact_id || null,
          person_in_charge_id: formData.person_in_charge_id || null,
          fee_tax_excluded: formData.fee_tax_excluded,
          expenses: formData.expenses,
          total_amount: formData.total_amount,
          notes: formData.notes || null,
        });
      } else {
        // 新規作成
        await createInvoice({
          project_id: projectId,
          project_code: projectCode,
          business_entity_id: formData.business_entity_id,
          business_entity_code: entity.code,
          invoice_date: formData.invoice_date,
          recipient_contact_id: formData.recipient_contact_id || null,
          person_in_charge_id: formData.person_in_charge_id || null,
          fee_tax_excluded: formData.fee_tax_excluded,
          expenses: formData.expenses,
          total_amount: formData.total_amount,
          pdf_path: pdfPath,
          notes: formData.notes || null,
        });
      }

      handleClose();
      router.refresh();
    });
  };

  const handleDelete = async (invoiceId: string) => {
    if (!confirm("この請求書を削除しますか？")) return;

    startTransition(async () => {
      await deleteInvoice(invoiceId);
      router.refresh();
    });
  };

  const handleToggleAccounting = async (invoiceId: string, current: boolean) => {
    startTransition(async () => {
      await toggleAccountingRegistered(invoiceId, !current);
      router.refresh();
    });
  };

  const handleTogglePayment = async (invoiceId: string, current: boolean) => {
    startTransition(async () => {
      await togglePaymentReceived(invoiceId, !current);
      router.refresh();
    });
  };

  // 相手先の選択肢を作成
  const recipientOptions: { id: string; label: string }[] = [];
  customerData.accounts.forEach((acc) => {
    acc.contacts.forEach((c) => {
      recipientOptions.push({
        id: c.id,
        label: `${acc.companyName} - ${c.name}`,
      });
    });
  });
  customerData.individuals.forEach((ind) => {
    recipientOptions.push({
      id: ind.id,
      label: ind.name,
    });
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            請求管理
          </CardTitle>
          <Button size="sm" onClick={handleOpenAdd} disabled={isPending}>
            <Plus className="h-4 w-4 mr-1" />
            請求書を追加
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            請求書がありません
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">請求書番号</TableHead>
                  <TableHead>事業主体</TableHead>
                  <TableHead>請求日</TableHead>
                  <TableHead className="text-right">請求金額</TableHead>
                  <TableHead className="text-center w-[60px]">会計</TableHead>
                  <TableHead className="text-center w-[60px]">入金</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono text-sm">
                      {invoice.invoice_number}
                    </TableCell>
                    <TableCell className="text-sm">
                      {invoice.businessEntity.name}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(invoice.invoice_date)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(invoice.total_amount)}
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
                    <TableCell className="text-center">
                      <Checkbox
                        checked={invoice.is_payment_received}
                        onCheckedChange={() =>
                          handleTogglePayment(invoice.id, invoice.is_payment_received)
                        }
                        disabled={isPending}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {invoice.pdf_path && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            title="PDFを開く"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => handleOpenEdit(invoice)}
                          disabled={isPending}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive"
                          onClick={() => handleDelete(invoice.id)}
                          disabled={isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* 合計表示 */}
        {invoices.length > 0 && (
          <div className="mt-4 flex justify-end gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">税抜報酬計: </span>
              <span className="font-medium">
                {formatCurrency(invoices.reduce((sum, i) => sum + i.fee_tax_excluded, 0))}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">立替金計: </span>
              <span className="font-medium">
                {formatCurrency(invoices.reduce((sum, i) => sum + i.expenses, 0))}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">請求金額計: </span>
              <span className="font-bold">
                {formatCurrency(invoices.reduce((sum, i) => sum + i.total_amount, 0))}
              </span>
            </div>
          </div>
        )}
      </CardContent>

      {/* 請求書追加/編集モーダル */}
      <Dialog open={showAddModal} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingInvoice ? "請求書を編集" : "請求書を追加"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* 事業主体 */}
            <div className="space-y-2">
              <Label>事業主体 *</Label>
              <Select
                value={formData.business_entity_id}
                onValueChange={(v) => setFormData({ ...formData, business_entity_id: v })}
                disabled={!!editingInvoice}
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
                  {recipientOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
                {pdfFile && (
                  <span className="text-sm text-muted-foreground">
                    {pdfFile.name}
                  </span>
                )}
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
              <Button variant="outline" onClick={handleClose} disabled={isPending}>
                キャンセル
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isPending || !formData.business_entity_id}
              >
                {editingInvoice ? "更新" : "追加"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
