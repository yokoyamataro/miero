"use client";

import React, { useState, useTransition, useEffect, useRef, useMemo } from "react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, X, Upload } from "lucide-react";
import {
  type InvoiceDocumentType,
  type BusinessEntity,
  type Employee,
  type InvoiceWithDetails,
  INVOICE_DOCUMENT_TYPE_LABELS,
} from "@/types/database";
import {
  createInvoiceSimple,
  updateInvoiceSimple,
  uploadInvoicePdf,
  getAllRecipients,
  type RecipientOption,
} from "./actions";

interface ProjectForInvoice {
  id: string;
  code: string;
  name: string;
  contact_id: string | null;
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
  const [recipientAccountId, setRecipientAccountId] = useState(""); // 担当者がいない法人用
  const [feeTaxExcluded, setFeeTaxExcluded] = useState(0); // 税抜報酬
  const [expenses, setExpenses] = useState(0); // 立替金
  const [totalAmount, setTotalAmount] = useState(0);
  const [notes, setNotes] = useState("");

  // PDF添付用
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 業務検索用
  const [projectSearchQuery, setProjectSearchQuery] = useState("");
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const projectSearchRef = useRef<HTMLDivElement>(null);

  // 顧客リストを読み込み
  useEffect(() => {
    if (open && !recipientsLoaded) {
      getAllRecipients().then((data) => {
        setAllRecipients(data);
        setRecipientsLoaded(true);
      });
    }
  }, [open, recipientsLoaded]);

  // ダイアログが開いた時のフラグ（リセットの重複防止）
  const [initialized, setInitialized] = useState(false);

  // 編集モード時に既存データを読み込み
  useEffect(() => {
    if (!open) {
      setInitialized(false);
      return;
    }

    if (initialized) {
      return;
    }

    if (editingInvoice) {
      setDocumentType((editingInvoice.document_type as InvoiceDocumentType) || "invoice");
      setProjectId(editingInvoice.project_id);
      setBusinessEntityId(editingInvoice.business_entity_id);
      setInvoiceDate(editingInvoice.invoice_date);
      setRecipientContactId(editingInvoice.recipient_contact_id || "");
      setRecipientAccountId(editingInvoice.recipient_account_id || "");
      setFeeTaxExcluded(editingInvoice.fee_tax_excluded || 0);
      setExpenses(editingInvoice.expenses || 0);
      setTotalAmount(editingInvoice.total_amount || 0);
      setNotes(editingInvoice.notes || "");

      const project = projects.find((p) => p.id === editingInvoice.project_id);
      if (project) {
        setProjectSearchQuery(`${project.code} - ${project.name}`);
      }
      setInitialized(true);
    } else {
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
    setRecipientAccountId("");
    setFeeTaxExcluded(0);
    setExpenses(0);
    setTotalAmount(0);
    setNotes("");
    setProjectSearchQuery("");
    setShowProjectDropdown(false);
    setRecipientSearchQuery("");
    setShowRecipientDropdown(false);
    setPdfFile(null);
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
  }).slice(0, 10);

  // ダイアログを閉じる
  const handleClose = () => {
    onOpenChange(false);
  };

  // 業務選択時
  const handleProjectSelect = (project: ProjectForInvoice) => {
    setProjectId(project.id);
    setProjectSearchQuery(`${project.code} - ${project.name}`);
    setShowProjectDropdown(false);

    // 業務に紐付いた顧客を相手先に自動セット
    if (project.contact_id && recipientsLoaded) {
      const recipient = allRecipients.find((r) => r.id === project.contact_id);
      if (recipient) {
        setRecipientContactId(recipient.id);
        setRecipientSearchQuery(recipient.label);
      }
    }
  };

  // 業務選択クリア
  const handleClearProject = () => {
    setProjectId("");
    setProjectSearchQuery("");
  };

  // 選択中の業務の依頼人ID
  const selectedProjectContactId = projectId
    ? projects.find((p) => p.id === projectId)?.contact_id
    : null;

  // 相手先検索結果のフィルタリング（業務の依頼人を先頭に表示）
  const filteredRecipients = useMemo(() => {
    let filtered = allRecipients;

    // 検索クエリがある場合はフィルタリング
    if (recipientSearchQuery) {
      const q = recipientSearchQuery.toLowerCase();
      filtered = allRecipients.filter((recipient) =>
        recipient.label.toLowerCase().includes(q)
      );
    }

    // 業務の依頼人を先頭に移動
    if (selectedProjectContactId) {
      const projectContact = filtered.find((r) => r.id === selectedProjectContactId);
      if (projectContact) {
        filtered = [
          projectContact,
          ...filtered.filter((r) => r.id !== selectedProjectContactId),
        ];
      }
    }

    return filtered.slice(0, 20);
  }, [allRecipients, recipientSearchQuery, selectedProjectContactId]);

  // 相手先選択時
  const handleRecipientSelect = (recipient: RecipientOption) => {
    if (recipient.type === "account_only") {
      // 担当者がいない法人の場合
      setRecipientContactId("");
      setRecipientAccountId(recipient.accountId || recipient.id);
    } else {
      // 担当者または個人の場合
      setRecipientContactId(recipient.id);
      setRecipientAccountId("");
    }
    setRecipientSearchQuery(recipient.label);
    setShowRecipientDropdown(false);
  };

  // 相手先クリア
  const handleClearRecipient = () => {
    setRecipientContactId("");
    setRecipientAccountId("");
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

  // PDF選択
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file);
    } else if (file) {
      alert("PDFファイルを選択してください");
    }
  };

  // 送信
  const handleSubmit = async () => {
    if (!projectId || !businessEntityId) return;

    const project = projects.find((p) => p.id === projectId);
    const entity = businessEntities.find((e) => e.id === businessEntityId);
    if (!project || !entity) return;

    startTransition(async () => {
      if (isEditMode && editingInvoice) {
        // 編集モード
        const result = await updateInvoiceSimple(editingInvoice.id, {
          invoice_date: invoiceDate,
          recipient_contact_id: recipientContactId || null,
          recipient_account_id: recipientAccountId || null,
          fee_tax_excluded: feeTaxExcluded,
          expenses: expenses,
          total_amount: totalAmount,
          notes: notes || null,
        });

        if (result.error) {
          alert(result.error);
          return;
        }

        // PDFがあればアップロード
        if (pdfFile) {
          const formData = new FormData();
          formData.append("file", pdfFile);
          await uploadInvoicePdf(editingInvoice.id, formData);
        }
      } else {
        // 新規作成モード
        const result = await createInvoiceSimple({
          project_id: projectId,
          project_code: project.code,
          business_entity_id: businessEntityId,
          business_entity_code: entity.code,
          invoice_date: invoiceDate,
          recipient_contact_id: recipientContactId || null,
          recipient_account_id: recipientAccountId || null,
          document_type: documentType,
          fee_tax_excluded: feeTaxExcluded,
          expenses: expenses,
          total_amount: totalAmount,
          notes: notes || null,
        });

        if (result.error) {
          alert(result.error);
          return;
        }

        // PDFがあればアップロード
        if (pdfFile && result.invoiceId) {
          const formData = new FormData();
          formData.append("file", pdfFile);
          await uploadInvoicePdf(result.invoiceId, formData);
        }
      }

      handleClose();
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {documentType === "invoice" ? "請求書" : "見積書"}を{isEditMode ? "編集" : "登録"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-[250px] overflow-y-auto">
                  {filteredRecipients.map((recipient) => {
                    const isProjectContact = recipient.id === selectedProjectContactId;
                    return (
                      <button
                        key={recipient.id}
                        type="button"
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${
                          recipient.id === recipientContactId ? "bg-muted" : ""
                        } ${isProjectContact ? "bg-blue-50 border-b" : ""}`}
                        onClick={() => handleRecipientSelect(recipient)}
                      >
                        {isProjectContact && (
                          <span className="text-xs text-blue-600 mr-2">業務依頼人</span>
                        )}
                        {recipient.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 金額 */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-sm">税抜報酬</Label>
                <Input
                  type="number"
                  value={feeTaxExcluded || ""}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0;
                    setFeeTaxExcluded(value);
                    setTotalAmount(value + expenses);
                  }}
                  placeholder="0"
                  className="text-right"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">立替金</Label>
                <Input
                  type="number"
                  value={expenses || ""}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0;
                    setExpenses(value);
                    setTotalAmount(feeTaxExcluded + value);
                  }}
                  placeholder="0"
                  className="text-right"
                />
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t">
              <Label className="text-sm font-medium">{documentType === "invoice" ? "請求金額" : "見積金額"}</Label>
              <span className="text-lg font-bold">
                {new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(totalAmount)}
              </span>
            </div>
          </div>

          {/* PDF添付 */}
          <div className="space-y-2">
            <Label>PDF添付</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                ファイルを選択
              </Button>
              {pdfFile && (
                <span className="text-sm text-muted-foreground truncate flex-1">
                  {pdfFile.name}
                </span>
              )}
              {!pdfFile && editingInvoice?.pdf_path && (
                <span className="text-sm text-green-600">
                  PDF添付済み
                </span>
              )}
            </div>
            <input
              type="file"
              ref={fileInputRef}
              accept="application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
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
              {isEditMode ? "保存" : "登録"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
