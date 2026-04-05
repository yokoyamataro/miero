"use client";

import React, { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Plus, Trash2, GripVertical, Download, Search, X } from "lucide-react";
import * as XLSX from "xlsx";
import {
  type InvoiceDocumentType,
  type InvoiceTemplateWithCategories,
  type BusinessEntity,
  type Employee,
  type InvoiceWithDetails,
  INVOICE_DOCUMENT_TYPE_LABELS,
} from "@/types/database";
import {
  createInvoiceWithItems,
  getProjectCustomerInfo,
  getInvoiceTemplates,
  getInvoiceItems,
  updateInvoiceItems,
  updateInvoice,
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
  editingInvoice?: InvoiceWithDetails | null;
}

export function InvoiceCreateDialog({
  open,
  onOpenChange,
  businessEntities,
  employees,
  projects,
  editingInvoice,
}: InvoiceCreateDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEditMode = !!editingInvoice;

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

  // Excel出力オプション
  const [excludeZeroQuantity, setExcludeZeroQuantity] = useState(true);

  // 業務検索用
  const [projectSearchQuery, setProjectSearchQuery] = useState("");
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const projectSearchRef = useRef<HTMLDivElement>(null);

  // テンプレートを読み込み
  useEffect(() => {
    if (open && !templatesLoaded) {
      getInvoiceTemplates().then((data) => {
        setTemplates(data);
        setTemplatesLoaded(true);
      });
    }
  }, [open, templatesLoaded]);

  // 編集モード時に既存データを読み込み
  useEffect(() => {
    if (open && editingInvoice) {
      // 基本情報をセット
      setDocumentType((editingInvoice.document_type as InvoiceDocumentType) || "invoice");
      setProjectId(editingInvoice.project_id);
      setBusinessEntityId(editingInvoice.business_entity_id);
      setInvoiceDate(editingInvoice.invoice_date);
      setRecipientContactId(editingInvoice.recipient_contact_id || "");
      setPersonInChargeId(editingInvoice.person_in_charge_id || "");
      setExpenses(editingInvoice.expenses || 0);
      setTaxRate(editingInvoice.tax_rate || 0.1);
      setNotes(editingInvoice.notes || "");

      // 業務検索フィールドにセット
      const project = projects.find((p) => p.id === editingInvoice.project_id);
      if (project) {
        setProjectSearchQuery(`${project.code} - ${project.name}`);
      }

      // 顧客情報を取得
      getProjectCustomerInfo(editingInvoice.project_id).then((info) => {
        setCustomerInfo(info);
      });

      // 明細項目を取得
      getInvoiceItems(editingInvoice.id).then((invoiceItems) => {
        const loadedItems: InvoiceLineItem[] = invoiceItems.map((item) => ({
          id: item.id,
          item_template_id: item.item_template_id,
          category_name: item.category_name,
          name: item.name,
          description: item.description,
          unit: item.unit,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.amount,
        }));
        setItems(loadedItems);
      });
    } else if (open && !editingInvoice) {
      // 新規作成モードの場合はフォームをリセット
      resetForm();
    }
  }, [open, editingInvoice, projects]);

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
    setProjectSearchQuery("");
    setShowProjectDropdown(false);
  };

  // クリック外で検索ドロップダウンを閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (projectSearchRef.current && !projectSearchRef.current.contains(event.target as Node)) {
        setShowProjectDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 業務検索結果のフィルタリング
  const filteredProjects = projects.filter((project) => {
    if (!projectSearchQuery) return true;
    const q = projectSearchQuery.toLowerCase();
    return (
      project.name.toLowerCase().includes(q) ||
      project.code.toLowerCase().includes(q)
    );
  }).slice(0, 10); // 最大10件表示

  // ダイアログを閉じる
  const handleClose = () => {
    onOpenChange(false);
    // リセットは次回openするときのuseEffectで行う
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

  // 業務選択時
  const handleProjectSelect = async (project: ProjectForInvoice) => {
    setProjectId(project.id);
    setProjectSearchQuery(`${project.code} - ${project.name}`);
    setShowProjectDropdown(false);
    const info = await getProjectCustomerInfo(project.id);
    setCustomerInfo(info);
    if (info?.contacts?.length === 1) {
      setRecipientContactId(info.contacts[0].id);
    }
  };

  // 業務選択クリア
  const handleClearProject = () => {
    setProjectId("");
    setProjectSearchQuery("");
    setCustomerInfo(null);
    setRecipientContactId("");
  };

  // テンプレートから項目追加
  const handleAddItemsFromTemplate = (selectedItems: SelectedItem[]) => {
    console.log("handleAddItemsFromTemplate called with:", selectedItems.length, "items");
    console.log("handleAddItemsFromTemplate - selectedItems:", selectedItems);

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
    console.log("handleAddItemsFromTemplate - newItems created:", newItems.length);

    // コールバック形式で更新して、最新のitemsを参照する
    setItems((prevItems) => {
      console.log("handleAddItemsFromTemplate - prevItems:", prevItems.length);
      const updated = [...prevItems, ...newItems];
      console.log("handleAddItemsFromTemplate - updated items:", updated.length);
      return updated;
    });
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

    // デバッグ: 送信される明細項目数
    console.log("handleSubmit - items count:", items.length);
    console.log("handleSubmit - items:", items);

    startTransition(async () => {
      if (isEditMode && editingInvoice) {
        // 編集モード: 明細と基本情報を更新
        const itemsResult = await updateInvoiceItems(
          editingInvoice.id,
          items.map((item, index) => ({
            id: item.id,
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
          taxRate,
          expenses
        );

        if (itemsResult.error) {
          alert(itemsResult.error);
          return;
        }

        // 基本情報も更新
        const updateResult = await updateInvoice(editingInvoice.id, {
          invoice_date: invoiceDate,
          recipient_contact_id: recipientContactId || null,
          person_in_charge_id: personInChargeId || null,
          notes: notes || null,
        });

        if (updateResult.error) {
          alert(updateResult.error);
          return;
        }
      } else {
        // 新規作成モード
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
      }

      handleClose();
      router.refresh();
    });
  };

  // 金額フォーマット
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ja-JP").format(amount);
  };

  // Excel出力
  const handleExportExcel = () => {
    const project = projects.find((p) => p.id === projectId);
    const entity = businessEntities.find((e) => e.id === businessEntityId);

    // ヘッダー情報
    const headerRows = [
      [documentType === "invoice" ? "請求書" : "見積書"],
      [],
      ["業務", project ? `${project.code} - ${project.name}` : ""],
      ["事業主体", entity?.name || ""],
      [documentType === "invoice" ? "請求日" : "見積日", invoiceDate],
      [],
    ];

    // 明細ヘッダー
    const itemHeader = ["項目名", "数量", "単位", "単価", "金額"];

    // 出力対象の項目（数量0を除外するオプションに対応）
    const exportItems = excludeZeroQuantity
      ? items.filter((item) => item.quantity > 0)
      : items;

    // 明細データ
    const itemRows = exportItems.map((item) => [
      item.name,
      item.quantity,
      item.unit || "",
      item.unit_price,
      item.amount,
    ]);

    // 合計行
    const summaryRows = [
      [],
      ["", "", "", "小計（税抜）", subtotal],
      ["", "", "", `消費税（${Math.round(taxRate * 100)}%）`, taxAmount],
      ["", "", "", "立替金", expenses],
      ["", "", "", "合計金額", totalAmount],
    ];

    // ワークシートデータを組み立て
    const wsData = [
      ...headerRows,
      itemHeader,
      ...itemRows,
      ...summaryRows,
    ];

    // ワークシート作成
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // 列幅設定
    ws["!cols"] = [
      { wch: 30 }, // 項目名
      { wch: 10 }, // 数量
      { wch: 8 },  // 単位
      { wch: 12 }, // 単価
      { wch: 12 }, // 金額
    ];

    // ワークブック作成
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, documentType === "invoice" ? "請求書" : "見積書");

    // ファイル名生成
    const fileName = project
      ? `${documentType === "invoice" ? "請求書" : "見積書"}_${project.code}_${invoiceDate}.xlsx`
      : `${documentType === "invoice" ? "請求書" : "見積書"}_${invoiceDate}.xlsx`;

    // ダウンロード
    XLSX.writeFile(wb, fileName);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {documentType === "invoice" ? "請求書" : "見積書"}を{isEditMode ? "編集" : "作成"}
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
                disabled={isEditMode}
              >
                {INVOICE_DOCUMENT_TYPE_LABELS.invoice}
              </Button>
              <Button
                type="button"
                variant={documentType === "estimate" ? "default" : "outline"}
                size="sm"
                onClick={() => setDocumentType("estimate")}
                disabled={isEditMode}
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
              <div className="relative" ref={projectSearchRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="業務名・コードで検索..."
                    className="pl-9 pr-8"
                    value={projectSearchQuery}
                    onChange={(e) => {
                      setProjectSearchQuery(e.target.value);
                      setShowProjectDropdown(true);
                      if (!e.target.value) {
                        setProjectId("");
                        setCustomerInfo(null);
                      }
                    }}
                    onFocus={() => setShowProjectDropdown(true)}
                    disabled={isEditMode}
                  />
                  {projectId && (
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={handleClearProject}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {showProjectDropdown && filteredProjects.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-[200px] overflow-y-auto">
                    {filteredProjects.map((project) => (
                      <button
                        key={project.id}
                        type="button"
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${
                          project.id === projectId ? "bg-muted" : ""
                        }`}
                        onClick={() => handleProjectSelect(project)}
                      >
                        <span className="text-muted-foreground">{project.code}</span>
                        {" - "}
                        {project.name}
                      </button>
                    ))}
                  </div>
                )}
                {showProjectDropdown && projectSearchQuery && filteredProjects.length === 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg p-3 text-sm text-muted-foreground">
                    該当する業務がありません
                  </div>
                )}
              </div>
            </div>

            {/* 事業主体 */}
            <div className="space-y-2">
              <Label>事業主体 *</Label>
              <Select
                value={businessEntityId}
                onValueChange={setBusinessEntityId}
                disabled={isEditMode}
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
                      <TableHead className="w-[100px]">数量</TableHead>
                      <TableHead className="w-[90px]">単位</TableHead>
                      <TableHead className="w-[120px]">単価</TableHead>
                      <TableHead className="w-[120px] text-right">金額</TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      // カテゴリ別にグループ化
                      const groupedItems: { category: string | null; items: InvoiceLineItem[] }[] = [];
                      for (const item of items) {
                        const categoryKey = item.category_name || null;
                        const existing = groupedItems.find((g) => g.category === categoryKey);
                        if (existing) {
                          existing.items.push(item);
                        } else {
                          groupedItems.push({ category: categoryKey, items: [item] });
                        }
                      }

                      return groupedItems.map((group) => (
                        <React.Fragment key={`group-${group.category || "uncategorized"}`}>
                          {/* カテゴリヘッダー行 */}
                          {group.category && (
                            <TableRow className="bg-cyan-100 hover:bg-cyan-100">
                              <TableCell colSpan={7} className="py-2 font-medium text-sm">
                                {group.category}
                              </TableCell>
                            </TableRow>
                          )}
                          {/* カテゴリ内の項目 */}
                          {group.items.map((item) => (
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
                                  step={1}
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
                        </React.Fragment>
                      ));
                    })()}
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
          <div className="flex justify-between pt-4 border-t">
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleExportExcel}
                disabled={items.length === 0}
              >
                <Download className="h-4 w-4 mr-1" />
                Excel出力
              </Button>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={excludeZeroQuantity}
                  onCheckedChange={(checked) => setExcludeZeroQuantity(checked === true)}
                />
                数量0を除外
              </label>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose} disabled={isPending}>
                キャンセル
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isPending || !projectId || !businessEntityId}
              >
                {isEditMode ? "保存" : "作成"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
