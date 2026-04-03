"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Trash2, GripVertical } from "lucide-react";
import {
  type InvoiceDocumentType,
  type InvoiceTemplateWithCategories,
  type BusinessEntity,
  type Employee,
  INVOICE_DOCUMENT_TYPE_LABELS,
} from "@/types/database";
import {
  createInvoiceWithItems,
  getProjectCustomerInfo,
  getInvoiceTemplates,
} from "./actions";
import { InvoiceItemSelector, type SelectedItem } from "./invoice-item-selector";

interface ProjectForInvoice {
  id: string;
  code: string;
  name: string;
  contact_id: string | null;
}

interface InvoiceLineItem {
  id: string;
  item_template_id: string | null;
  category_name: string | null;
  name: string;
  description: string | null;
  unit: string | null;
  quantity: number;
  unit_price: number;
  amount: number;
}

interface InvoiceCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessEntities: BusinessEntity[];
  employees: Employee[];
  projects: ProjectForInvoice[];
}

export function InvoiceCreateDialog({
  open,
  onOpenChange,
  businessEntities,
  employees,
  projects,
}: InvoiceCreateDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // テンプレート
  const [templates, setTemplates] = useState<InvoiceTemplateWithCategories[]>([]);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);

  // 基本情報
  const [documentType, setDocumentType] = useState<InvoiceDocumentType>("invoice");
  const [projectId, setProjectId] = useState("");
  const [businessEntityId, setBusinessEntityId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [recipientContactId, setRecipientContactId] = useState("");
  const [personInChargeId, setPersonInChargeId] = useState("");
  const [expenses, setExpenses] = useState(0);
  const [taxRate, setTaxRate] = useState(0.1);
  const [notes, setNotes] = useState("");

  // 顧客情報
  const [customerInfo, setCustomerInfo] = useState<{
    contacts: { id: string; name: string; accountName: string | null }[];
  } | null>(null);

  // 明細項目
  const [items, setItems] = useState<InvoiceLineItem[]>([]);

  // テンプレートを読み込み
  useEffect(() => {
    if (open && !templatesLoaded) {
      getInvoiceTemplates().then((data) => {
        setTemplates(data);
        setTemplatesLoaded(true);
      });
    }
  }, [open, templatesLoaded]);

  // フォームリセット
  const resetForm = () => {
    setDocumentType("invoice");
    setProjectId("");
    setBusinessEntityId("");
    setInvoiceDate(new Date().toISOString().split("T")[0]);
    setRecipientContactId("");
    setPersonInChargeId("");
    setExpenses(0);
    setTaxRate(0.1);
    setNotes("");
    setCustomerInfo(null);
    setItems([]);
  };

  // ダイアログを閉じる
  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  // 業務変更時
  const handleProjectChange = async (newProjectId: string) => {
    setProjectId(newProjectId);
    setRecipientContactId("");
    if (newProjectId) {
      const info = await getProjectCustomerInfo(newProjectId);
      setCustomerInfo(info);
      if (info?.contacts?.length === 1) {
        setRecipientContactId(info.contacts[0].id);
      }
    } else {
      setCustomerInfo(null);
    }
  };

  // テンプレートから項目追加
  const handleAddItemsFromTemplate = (selectedItems: SelectedItem[]) => {
    const newItems: InvoiceLineItem[] = selectedItems.map((item, index) => ({
      id: crypto.randomUUID(),
      item_template_id: item.item_template_id,
      category_name: item.category_name,
      name: item.name,
      description: item.description,
      unit: item.unit,
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: item.amount,
    }));
    setItems([...items, ...newItems]);
  };

  // 手動で項目追加
  const handleAddManualItem = () => {
    setItems([
      ...items,
      {
        id: crypto.randomUUID(),
        item_template_id: null,
        category_name: null,
        name: "",
        description: null,
        unit: "式",
        quantity: 1,
        unit_price: 0,
        amount: 0,
      },
    ]);
  };

  // 項目削除
  const handleRemoveItem = (itemId: string) => {
    setItems(items.filter((item) => item.id !== itemId));
  };

  // 項目更新
  const handleUpdateItem = (
    itemId: string,
    field: keyof InvoiceLineItem,
    value: string | number | null
  ) => {
    setItems(
      items.map((item) => {
        if (item.id !== itemId) return item;

        const updated = { ...item, [field]: value };

        // 数量・単価が変更された場合は金額を再計算
        if (field === "quantity" || field === "unit_price") {
          updated.amount = Math.floor(
            (updated.quantity || 0) * (updated.unit_price || 0)
          );
        }

        return updated;
      })
    );
  };

  // 金額計算
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const taxAmount = Math.floor(subtotal * taxRate);
  const totalAmount = subtotal + taxAmount + expenses;

  // 送信
  const handleSubmit = async () => {
    if (!projectId || !businessEntityId) return;

    const project = projects.find((p) => p.id === projectId);
    const entity = businessEntities.find((e) => e.id === businessEntityId);
    if (!project || !entity) return;

    startTransition(async () => {
      const result = await createInvoiceWithItems({
        project_id: projectId,
        project_code: project.code,
        business_entity_id: businessEntityId,
        business_entity_code: entity.code,
        invoice_date: invoiceDate,
        recipient_contact_id: recipientContactId || null,
        person_in_charge_id: personInChargeId || null,
        document_type: documentType,
        expenses,
        notes: notes || null,
        tax_rate: taxRate,
        items: items.map((item, index) => ({
          item_template_id: item.item_template_id,
          category_name: item.category_name,
          name: item.name,
          description: item.description,
          unit: item.unit,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.amount,
          sort_order: index,
        })),
      });

      if (result.error) {
        alert(result.error);
        return;
      }

      handleClose();
      router.refresh();
    });
  };

  // 金額フォーマット
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ja-JP").format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {documentType === "invoice" ? "請求書" : "見積書"}を作成
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 書類タイプ選択 */}
          <div className="space-y-2">
            <Label>タイプ</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={documentType === "invoice" ? "default" : "outline"}
                size="sm"
                onClick={() => setDocumentType("invoice")}
              >
                {INVOICE_DOCUMENT_TYPE_LABELS.invoice}
              </Button>
              <Button
                type="button"
                variant={documentType === "estimate" ? "default" : "outline"}
                size="sm"
                onClick={() => setDocumentType("estimate")}
              >
                {INVOICE_DOCUMENT_TYPE_LABELS.estimate}
              </Button>
            </div>
          </div>

          {/* 基本情報 */}
          <div className="grid grid-cols-2 gap-4">
            {/* 業務 */}
            <div className="space-y-2">
              <Label>業務 *</Label>
              <Select value={projectId} onValueChange={handleProjectChange}>
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
                value={businessEntityId}
                onValueChange={setBusinessEntityId}
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
              <Label>{documentType === "invoice" ? "請求日" : "見積日"} *</Label>
              <Input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>

            {/* 相手先 */}
            <div className="space-y-2">
              <Label>相手先</Label>
              <Select
                value={recipientContactId || "__none__"}
                onValueChange={(v) =>
                  setRecipientContactId(v === "__none__" ? "" : v)
                }
                disabled={!customerInfo || customerInfo.contacts.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="相手先を選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">未選択</SelectItem>
                  {customerInfo?.contacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.accountName || contact.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* テンプレートから追加 */}
          <div className="space-y-2">
            <Label>テンプレートから追加</Label>
            <InvoiceItemSelector
              templates={templates}
              onAddItems={handleAddItemsFromTemplate}
            />
          </div>

          {/* 明細項目テーブル */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>明細項目</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddManualItem}
              >
                <Plus className="h-4 w-4 mr-1" />
                手動追加
              </Button>
            </div>

            {items.length === 0 ? (
              <div className="text-center text-muted-foreground py-8 border rounded-md">
                明細項目がありません。テンプレートから追加するか、手動で追加してください。
              </div>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[30px]"></TableHead>
                      <TableHead>項目名</TableHead>
                      <TableHead className="w-[80px]">数量</TableHead>
                      <TableHead className="w-[70px]">単位</TableHead>
                      <TableHead className="w-[120px]">単価</TableHead>
                      <TableHead className="w-[120px] text-right">金額</TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="px-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.name}
                            onChange={(e) =>
                              handleUpdateItem(item.id, "name", e.target.value)
                            }
                            placeholder="項目名"
                            className="h-8"
                          />
                          {item.category_name && (
                            <span className="text-xs text-muted-foreground">
                              {item.category_name}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) =>
                              handleUpdateItem(
                                item.id,
                                "quantity",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="h-8 text-right"
                            min={0}
                            step={0.01}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.unit || ""}
                            onChange={(e) =>
                              handleUpdateItem(item.id, "unit", e.target.value)
                            }
                            className="h-8"
                            placeholder="式"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.unit_price}
                            onChange={(e) =>
                              handleUpdateItem(
                                item.id,
                                "unit_price",
                                parseInt(e.target.value) || 0
                              )
                            }
                            className="h-8 text-right"
                            min={0}
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.amount)}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleRemoveItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* 金額サマリ */}
          <div className="flex justify-end">
            <div className="w-[300px] space-y-2 text-sm">
              <div className="flex justify-between">
                <span>小計（税抜）</span>
                <span className="font-medium">{formatCurrency(subtotal)}円</span>
              </div>
              <div className="flex justify-between items-center">
                <span>消費税</span>
                <div className="flex items-center gap-2">
                  <Select
                    value={String(taxRate)}
                    onValueChange={(v) => setTaxRate(parseFloat(v))}
                  >
                    <SelectTrigger className="w-[80px] h-7">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.1">10%</SelectItem>
                      <SelectItem value="0.08">8%</SelectItem>
                      <SelectItem value="0">0%</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="font-medium w-[100px] text-right">
                    {formatCurrency(taxAmount)}円
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span>立替金</span>
                <Input
                  type="number"
                  value={expenses || ""}
                  onChange={(e) => setExpenses(parseInt(e.target.value) || 0)}
                  className="w-[100px] h-7 text-right"
                  min={0}
                />
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span className="font-medium">合計金額</span>
                <span className="text-lg font-bold">
                  {formatCurrency(totalAmount)}円
                </span>
              </div>
            </div>
          </div>

          {/* 備考 */}
          <div className="space-y-2">
            <Label>備考</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="備考を入力..."
            />
          </div>

          {/* ボタン */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleClose} disabled={isPending}>
              キャンセル
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending || !projectId || !businessEntityId}
            >
              作成
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
