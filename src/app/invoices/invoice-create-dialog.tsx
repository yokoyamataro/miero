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
import { Plus, Minus, Trash2, GripVertical, Download, Search, X, FileInput } from "lucide-react";
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
  getInvoiceTemplates,
  getInvoiceItems,
  updateInvoiceItems,
  updateInvoice,
  getAllRecipients,
  getInvoicesForImport,
  getInvoiceItemsForImport,
  type RecipientOption,
  type InvoiceForImport,
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

  // 全顧客リスト（相手先選択用）
  const [allRecipients, setAllRecipients] = useState<RecipientOption[]>([]);
  const [recipientsLoaded, setRecipientsLoaded] = useState(false);
  const [recipientSearchQuery, setRecipientSearchQuery] = useState("");
  const [showRecipientDropdown, setShowRecipientDropdown] = useState(false);
  const recipientSearchRef = useRef<HTMLDivElement>(null);

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


  // 明細項目
  const [items, setItems] = useState<InvoiceLineItem[]>([]);

  // Excel出力オプション
  const [excludeZeroQuantity, setExcludeZeroQuantity] = useState(true);

  // 業務検索用
  const [projectSearchQuery, setProjectSearchQuery] = useState("");
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const projectSearchRef = useRef<HTMLDivElement>(null);

  // 明細読み込み用
  const [invoicesForImport, setInvoicesForImport] = useState<InvoiceForImport[]>([]);
  const [invoicesForImportLoaded, setInvoicesForImportLoaded] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importSearchQuery, setImportSearchQuery] = useState("");
  const [isLoadingImport, setIsLoadingImport] = useState(false);

  // テンプレートと顧客リストを読み込み
  useEffect(() => {
    if (open && !templatesLoaded) {
      getInvoiceTemplates().then((data) => {
        setTemplates(data);
        setTemplatesLoaded(true);
      });
    }
    if (open && !recipientsLoaded) {
      getAllRecipients().then((data) => {
        setAllRecipients(data);
        setRecipientsLoaded(true);
      });
    }
    if (open && !invoicesForImportLoaded) {
      getInvoicesForImport().then((data) => {
        setInvoicesForImport(data);
        setInvoicesForImportLoaded(true);
      });
    }
  }, [open, templatesLoaded, recipientsLoaded, invoicesForImportLoaded]);

  // ダイアログが開いた時のフラグ（リセットの重複防止）
  const [initialized, setInitialized] = useState(false);

  // 編集モード時に既存データを読み込み
  useEffect(() => {
    if (!open) {
      // ダイアログが閉じたら初期化フラグをリセット
      setInitialized(false);
      return;
    }

    if (initialized) {
      // 既に初期化済みなら何もしない
      return;
    }

    if (editingInvoice) {
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
      setInitialized(true);
    } else {
      // 新規作成モードの場合はフォームをリセット
      resetForm();
      setInitialized(true);
    }
  }, [open, editingInvoice, projects, initialized]);

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
    setItems([]);
    setProjectSearchQuery("");
    setShowProjectDropdown(false);
    setRecipientSearchQuery("");
    setShowRecipientDropdown(false);
    setShowImportDialog(false);
    setImportSearchQuery("");
  };

  // 明細読み込み用のフィルタリング
  const filteredInvoicesForImport = invoicesForImport.filter((inv) => {
    if (!importSearchQuery) return true;
    const q = importSearchQuery.toLowerCase();
    return (
      inv.invoice_number.toLowerCase().includes(q) ||
      inv.project_code.toLowerCase().includes(q) ||
      inv.project_name.toLowerCase().includes(q)
    );
  });

  // 明細を読み込む
  const handleImportItems = async (invoiceId: string) => {
    setIsLoadingImport(true);
    try {
      const result = await getInvoiceItemsForImport(invoiceId);
      if (result) {
        const newItems: InvoiceLineItem[] = result.items.map((item) => ({
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
        setItems(newItems);
        setTaxRate(result.taxRate || 0.1);
        setExpenses(result.expenses || 0);
      }
      setShowImportDialog(false);
      setImportSearchQuery("");
    } catch (error) {
      console.error("Error importing items:", error);
    } finally {
      setIsLoadingImport(false);
    }
  };

  // クリック外で検索ドロップダウンを閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (projectSearchRef.current && !projectSearchRef.current.contains(event.target as Node)) {
        setShowProjectDropdown(false);
      }
      if (recipientSearchRef.current && !recipientSearchRef.current.contains(event.target as Node)) {
        setShowRecipientDropdown(false);
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

  // 業務選択時
  const handleProjectSelect = (project: ProjectForInvoice) => {
    setProjectId(project.id);
    setProjectSearchQuery(`${project.code} - ${project.name}`);
    setShowProjectDropdown(false);
  };

  // 業務選択クリア
  const handleClearProject = () => {
    setProjectId("");
    setProjectSearchQuery("");
  };

  // 相手先検索結果のフィルタリング
  const filteredRecipients = allRecipients.filter((recipient) => {
    if (!recipientSearchQuery) return true;
    const q = recipientSearchQuery.toLowerCase();
    return recipient.label.toLowerCase().includes(q);
  }).slice(0, 15); // 最大15件表示

  // 相手先選択時
  const handleRecipientSelect = (recipient: RecipientOption) => {
    setRecipientContactId(recipient.id);
    setRecipientSearchQuery(recipient.label);
    setShowRecipientDropdown(false);
  };

  // 相手先クリア
  const handleClearRecipient = () => {
    setRecipientContactId("");
    setRecipientSearchQuery("");
  };

  // 選択中の相手先ラベルを取得
  const getSelectedRecipientLabel = () => {
    if (!recipientContactId) return "";
    const recipient = allRecipients.find((r) => r.id === recipientContactId);
    return recipient?.label || "";
  };

  // 編集モードで相手先がセットされている場合の初期化
  useEffect(() => {
    if (recipientsLoaded && recipientContactId && !recipientSearchQuery) {
      const label = getSelectedRecipientLabel();
      if (label) {
        setRecipientSearchQuery(label);
      }
    }
  }, [recipientsLoaded, recipientContactId]);

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

  // 手動で項目追加（末尾に追加）
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

  // 指定分類の末尾に項目を追加
  const handleAddItemToCategory = (categoryName: string | null) => {
    const newItem: InvoiceLineItem = {
      id: crypto.randomUUID(),
      item_template_id: null,
      category_name: categoryName,
      name: "",
      description: null,
      unit: "式",
      quantity: 1,
      unit_price: 0,
      amount: 0,
    };

    // 該当カテゴリの最後の項目のインデックスを見つける
    let lastIndexOfCategory = -1;
    for (let i = 0; i < items.length; i++) {
      if (items[i].category_name === categoryName) {
        lastIndexOfCategory = i;
      }
    }

    if (lastIndexOfCategory === -1) {
      // カテゴリが見つからない場合は末尾に追加
      setItems([...items, newItem]);
    } else {
      // 該当カテゴリの末尾に挿入
      const newItems = [...items];
      newItems.splice(lastIndexOfCategory + 1, 0, newItem);
      setItems(newItems);
    }
  };

  // 新しい分類を追加（項目1つ付き）
  const handleAddNewCategory = () => {
    const categoryName = prompt("新しい分類名を入力してください：");
    if (!categoryName || categoryName.trim() === "") return;

    setItems([
      ...items,
      {
        id: crypto.randomUUID(),
        item_template_id: null,
        category_name: categoryName.trim(),
        name: "",
        description: null,
        unit: "式",
        quantity: 1,
        unit_price: 0,
        amount: 0,
      },
    ]);
  };

  // 値引き項目を追加
  const handleAddDiscountItem = () => {
    setItems([
      ...items,
      {
        id: crypto.randomUUID(),
        item_template_id: null,
        category_name: "値引き",
        name: "値引き",
        description: null,
        unit: "式",
        quantity: 1,
        unit_price: 0,
        amount: 0,
      },
    ]);
  };

  // 項目��除
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

    // 明細ヘッダー（1列目=分類、2列目=項目名）
    const itemHeader = ["分類", "項目名", "数量", "単位", "単価", "金額"];

    // 出力対象の項目（数量0を除外するオプションに対応）
    const exportItems = excludeZeroQuantity
      ? items.filter((item) => item.quantity > 0)
      : items;

    // 明細データ（分類列を追加）
    const itemRows = exportItems.map((item) => [
      item.category_name || "",
      item.name,
      item.quantity,
      item.unit || "",
      item.unit_price,
      item.amount,
    ]);

    // 合計行
    const summaryRows = [
      [],
      ["", "", "", "", "小計（税抜）", subtotal],
      ["", "", "", "", `消費税（${Math.round(taxRate * 100)}%）`, taxAmount],
      ["", "", "", "", "立替金", expenses],
      ["", "", "", "", "合計金額", totalAmount],
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
      { wch: 15 }, // 分類
      { wch: 25 }, // 項目名
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
              <div className="relative" ref={recipientSearchRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="法人名・氏名で検索..."
                    className="pl-9 pr-8"
                    value={recipientSearchQuery}
                    onChange={(e) => {
                      setRecipientSearchQuery(e.target.value);
                      setShowRecipientDropdown(true);
                      if (!e.target.value) {
                        setRecipientContactId("");
                      }
                    }}
                    onFocus={() => setShowRecipientDropdown(true)}
                  />
                  {recipientContactId && (
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={handleClearRecipient}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {showRecipientDropdown && filteredRecipients.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-[200px] overflow-y-auto">
                    {filteredRecipients.map((recipient) => (
                      <button
                        key={recipient.id}
                        type="button"
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${
                          recipient.id === recipientContactId ? "bg-muted" : ""
                        }`}
                        onClick={() => handleRecipientSelect(recipient)}
                      >
                        {recipient.label}
                      </button>
                    ))}
                  </div>
                )}
                {showRecipientDropdown && recipientSearchQuery && filteredRecipients.length === 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg p-3 text-sm text-muted-foreground">
                    該当する顧客がありません
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* テンプレートから追加 / 明細読み込み */}
          <div className="flex gap-4">
            <div className="space-y-2 flex-1">
              <Label>テンプレートから追加</Label>
              <InvoiceItemSelector
                templates={templates}
                onAddItems={handleAddItemsFromTemplate}
              />
            </div>
            <div className="space-y-2 flex-1">
              <Label>既存の請求書/見積書から読み込み</Label>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                onClick={() => setShowImportDialog(true)}
              >
                <FileInput className="h-4 w-4 mr-2" />
                明細を読み込む...
              </Button>
            </div>
          </div>

          {/* 明細読み込みダイアログ */}
          {showImportDialog && (
            <div className="border rounded-md p-4 bg-muted/30 space-y-3">
              <div className="flex items-center justify-between">
                <Label>読み込み元を選択</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowImportDialog(false);
                    setImportSearchQuery("");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="請求書番号・業務名で検索..."
                  className="pl-9"
                  value={importSearchQuery}
                  onChange={(e) => setImportSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="max-h-[200px] overflow-y-auto border rounded-md bg-background">
                {filteredInvoicesForImport.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    該当する請求書/見積書がありません
                  </div>
                ) : (
                  filteredInvoicesForImport.slice(0, 20).map((inv) => (
                    <button
                      key={inv.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors border-b last:border-b-0 flex items-center justify-between"
                      onClick={() => handleImportItems(inv.id)}
                      disabled={isLoadingImport}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          inv.document_type === "estimate"
                            ? "bg-green-100 text-green-700"
                            : "bg-blue-100 text-blue-700"
                        }`}>
                          {inv.document_type === "estimate" ? "見積" : "請求"}
                        </span>
                        <span className="font-mono text-muted-foreground text-xs">
                          {inv.invoice_number}
                        </span>
                        <span className="truncate max-w-[200px]">{inv.project_name}</span>
                      </div>
                      <span className="text-muted-foreground text-xs">
                        {inv.invoice_date}
                      </span>
                    </button>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                ※ 読み込むと現在の明細項目は上書きされます
              </p>
            </div>
          )}

          {/* 明細項目テーブル */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>明細項目</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddNewCategory}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  分類を追加
                </Button>
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
            </div>

            {items.length === 0 ? (
              <div className="text-center text-muted-foreground py-8 border rounded-md">
                明細項目がありません。テンプレートから追加するか、手動で追加してください。
              </div>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <Table className="text-sm">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[24px] px-1"></TableHead>
                      <TableHead className="w-[180px] px-1">項目名</TableHead>
                      <TableHead className="w-[80px] px-1">数量</TableHead>
                      <TableHead className="w-[70px] px-1">単位</TableHead>
                      <TableHead className="w-[100px] px-1">単価</TableHead>
                      <TableHead className="w-[100px] px-1 text-right">金額</TableHead>
                      <TableHead className="w-[32px] px-1"></TableHead>
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
                              <TableCell colSpan={6} className="py-1 px-2 font-medium text-sm">
                                {group.category}
                              </TableCell>
                              <TableCell className="py-1 px-1 text-right">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0"
                                  onClick={() => handleAddItemToCategory(group.category)}
                                  title="この分類に項目を追加"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          )}
                          {/* カテゴリ内の項目 */}
                          {group.items.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="px-1 py-1">
                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                              </TableCell>
                              <TableCell className="px-1 py-1">
                                <Input
                                  value={item.name}
                                  onChange={(e) =>
                                    handleUpdateItem(item.id, "name", e.target.value)
                                  }
                                  placeholder="項目名"
                                  className="h-7 text-sm"
                                  title={item.description || undefined}
                                />
                              </TableCell>
                              <TableCell className="px-1 py-1">
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
                                  className="h-7 text-sm text-right"
                                  min={0}
                                  step={1}
                                />
                              </TableCell>
                              <TableCell className="px-1 py-1">
                                <Input
                                  value={item.unit || ""}
                                  onChange={(e) =>
                                    handleUpdateItem(item.id, "unit", e.target.value)
                                  }
                                  className="h-7 text-sm"
                                  placeholder="式"
                                />
                              </TableCell>
                              <TableCell className="px-1 py-1">
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
                                  className="h-7 text-sm text-right"
                                />
                              </TableCell>
                              <TableCell className="px-1 py-1 text-right font-medium">
                                {formatCurrency(item.amount)}
                              </TableCell>
                              <TableCell className="px-1 py-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => handleRemoveItem(item.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </React.Fragment>
                      ));
                    })()}
                  </TableBody>
                </Table>
                {/* 値引き項目追加ボタン */}
                <div className="border-t px-2 py-2 bg-muted/30">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-sm text-muted-foreground hover:text-foreground"
                    onClick={handleAddDiscountItem}
                  >
                    <Minus className="h-4 w-4 mr-1" />
                    値引き項目を追加
                  </Button>
                </div>
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
