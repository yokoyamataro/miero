"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FileText, Download, Loader2, Upload, Search, X } from "lucide-react";
import { format } from "date-fns";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { createClient } from "@/lib/supabase/client";
import type { DocumentTemplate, Account, Contact, Employee, Branch } from "@/types/database";
import { generateDocument } from "./document-actions";

interface DocumentTabProps {
  templates: DocumentTemplate[];
  accounts: Account[];
  allContacts: Contact[];
  individuals: Contact[];
  employees: Employee[];
  branches: Branch[];
  currentEmployeeId: string | null;
}

export function DocumentTab({
  templates,
  accounts,
  allContacts,
  individuals,
  employees,
  branches,
  currentEmployeeId,
}: DocumentTabProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // フォーム状態
  const [templateList, setTemplateList] = useState(templates);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [recipientType, setRecipientType] = useState<"account" | "contact">("account");
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>("");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [selectedSenderId, setSelectedSenderId] = useState<string>(currentEmployeeId || "");
  const [useToday, setUseToday] = useState(true);
  const [documentDate, setDocumentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // アップロードダイアログ状態
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // 法人検索用
  const [accountSearchQuery, setAccountSearchQuery] = useState("");
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const accountSearchRef = useRef<HTMLDivElement>(null);

  // 個人検索用
  const [contactSearchQuery, setContactSearchQuery] = useState("");
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const contactSearchRef = useRef<HTMLDivElement>(null);

  // クリック外でドロップダウンを閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountSearchRef.current && !accountSearchRef.current.contains(event.target as Node)) {
        setShowAccountDropdown(false);
      }
      if (contactSearchRef.current && !contactSearchRef.current.contains(event.target as Node)) {
        setShowContactDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 法人検索結果のフィルタリング
  const filteredAccounts = useMemo(() => {
    if (!accountSearchQuery) return accounts;
    const q = accountSearchQuery.toLowerCase();
    return accounts.filter((a) =>
      a.company_name.toLowerCase().includes(q)
    );
  }, [accounts, accountSearchQuery]);

  // 個人検索結果のフィルタリング（個人顧客 + 法人担当者）
  const filteredContacts = useMemo(() => {
    const allContactsList = [
      ...individuals.map((c) => ({
        ...c,
        displayLabel: `${c.last_name} ${c.first_name}`,
        groupLabel: null as string | null,
      })),
      ...allContacts
        .filter((c) => c.account_id)
        .map((c) => {
          const account = accounts.find((a) => a.id === c.account_id);
          return {
            ...c,
            displayLabel: `${c.last_name} ${c.first_name}`,
            groupLabel: account?.company_name || null,
          };
        }),
    ];

    if (!contactSearchQuery) return allContactsList.slice(0, 20);
    const q = contactSearchQuery.toLowerCase();
    return allContactsList
      .filter((c) =>
        c.displayLabel.toLowerCase().includes(q) ||
        (c.groupLabel && c.groupLabel.toLowerCase().includes(q))
      )
      .slice(0, 20);
  }, [individuals, allContacts, accounts, contactSearchQuery]);

  // 選択中の法人名を取得
  const selectedAccountName = useMemo(() => {
    if (recipientType !== "account" || !selectedRecipientId) return "";
    const account = accounts.find((a) => a.id === selectedRecipientId);
    return account?.company_name || "";
  }, [recipientType, selectedRecipientId, accounts]);

  // 選択中の個人名を取得
  const selectedContactName = useMemo(() => {
    if (recipientType !== "contact" || !selectedRecipientId) return "";
    const contact = [...individuals, ...allContacts].find((c) => c.id === selectedRecipientId);
    if (!contact) return "";
    const account = contact.account_id ? accounts.find((a) => a.id === contact.account_id) : null;
    return account
      ? `${account.company_name} - ${contact.last_name} ${contact.first_name}`
      : `${contact.last_name} ${contact.first_name}`;
  }, [recipientType, selectedRecipientId, individuals, allContacts, accounts]);

  // 選択中の法人に紐づく支店一覧
  const availableBranches = recipientType === "account" && selectedRecipientId
    ? branches.filter(b => b.account_id === selectedRecipientId)
    : [];

  // 選択中の法人（または支店）に紐づく担当者一覧
  const availableContacts = recipientType === "account" && selectedRecipientId
    ? allContacts.filter(c => {
        if (c.account_id !== selectedRecipientId) return false;
        // 支店が選択されている場合はその支店の担当者のみ
        if (selectedBranchId) {
          return c.branch_id === selectedBranchId;
        }
        return true;
      })
    : [];

  // 生成処理
  const handleGenerate = async () => {
    if (!selectedTemplateId || !selectedRecipientId || !selectedSenderId) {
      setError("テンプレート、宛先、差出人を選択してください");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // 1. Server Actionでプレースホルダー値を取得
      const result = await generateDocument({
        templateId: selectedTemplateId,
        recipientType,
        recipientId: selectedRecipientId,
        branchId: selectedBranchId || undefined,
        contactId: selectedContactId || undefined,
        senderId: selectedSenderId,
        documentDate: useToday ? format(new Date(), "yyyy-MM-dd") : documentDate,
      });

      if (!result.success || !result.data) {
        setError(result.error || "生成に失敗しました");
        return;
      }

      const { templateFileName, storagePath, placeholderValues } = JSON.parse(result.data);

      // 2. テンプレートファイルを取得
      let templateArrayBuffer: ArrayBuffer;

      if (storagePath) {
        // Supabase Storageから取得
        const supabase = createClient();
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("document-templates")
          .download(storagePath);

        if (downloadError || !fileData) {
          setError("テンプレートファイルのダウンロードに失敗しました。");
          return;
        }
        templateArrayBuffer = await fileData.arrayBuffer();
      } else {
        // フォールバック: public/templates/から取得
        const templateResponse = await fetch(`/templates/${templateFileName}`);
        if (!templateResponse.ok) {
          setError("テンプレートファイルが見つかりません。");
          return;
        }
        templateArrayBuffer = await templateResponse.arrayBuffer();
      }

      // 3. docxtemplaterで置換
      const zip = new PizZip(templateArrayBuffer);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: "{{", end: "}}" },
      });
      doc.render(placeholderValues);

      // 4. 生成されたファイルをダウンロード
      const output = doc.getZip().generate({
        type: "blob",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

      const url = URL.createObjectURL(output);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.fileName || "document.docx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Document generation error:", err);
      setError("文書生成中にエラーが発生しました");
    } finally {
      setIsGenerating(false);
    }
  };

  // 差出人リスト（ログインユーザーを先頭に）
  const sortedEmployees = [...employees].sort((a, b) => {
    if (a.id === currentEmployeeId) return -1;
    if (b.id === currentEmployeeId) return 1;
    return 0;
  });

  // ファイル選択
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith(".docx")) {
        setUploadError("Wordファイル（.docx）のみアップロードできます");
        return;
      }
      setSelectedFile(file);
      setUploadError(null);
      if (!uploadName) {
        setUploadName(file.name.replace(".docx", ""));
      }
    }
  };

  // アップロード処理
  const handleUpload = async () => {
    if (!selectedFile || !uploadName.trim()) {
      setUploadError("テンプレート名とファイルを指定してください");
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const supabase = createClient();

      const timestamp = Date.now();
      // Supabase Storageは日本語ファイル名をサポートしないため、安全なファイル名を生成
      const safeFileName = `${timestamp}.docx`;
      const storagePath = safeFileName;

      // Storageにアップロード
      const { error: uploadErr } = await supabase.storage
        .from("document-templates")
        .upload(storagePath, selectedFile);

      if (uploadErr) {
        throw new Error("ファイルのアップロードに失敗しました: " + uploadErr.message);
      }

      // DBにレコード追加
      const { data: newTemplate, error: insertErr } = await supabase
        .from("document_templates")
        .insert({
          name: uploadName.trim(),
          file_name: selectedFile.name,
          storage_path: storagePath,
          description: uploadDescription.trim() || null,
          sort_order: templateList.length,
        })
        .select()
        .single();

      if (insertErr) {
        await supabase.storage.from("document-templates").remove([storagePath]);
        throw new Error("テンプレートの登録に失敗しました: " + insertErr.message);
      }

      setTemplateList([...templateList, newTemplate as DocumentTemplate]);
      resetUploadForm();
      setIsUploadDialogOpen(false);
      router.refresh();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsUploading(false);
    }
  };

  // アップロードフォームリセット
  const resetUploadForm = () => {
    setUploadName("");
    setUploadDescription("");
    setSelectedFile(null);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          文書作成
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* テンプレート選択 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>テンプレート *</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsUploadDialogOpen(true)}
            >
              <Upload className="h-4 w-4 mr-1" />
              アップロード
            </Button>
          </div>
          <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
            <SelectTrigger>
              <SelectValue placeholder="テンプレートを選択" />
            </SelectTrigger>
            <SelectContent>
              {templateList.length === 0 ? (
                <SelectItem value="none" disabled>
                  テンプレートがありません
                </SelectItem>
              ) : (
                templateList.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                    {t.description && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        - {t.description}
                      </span>
                    )}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* 宛先タイプ選択 */}
        <div className="space-y-2">
          <Label>宛先タイプ *</Label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="recipientType"
                value="account"
                checked={recipientType === "account"}
                onChange={() => {
                  setRecipientType("account");
                  setSelectedRecipientId("");
                  setSelectedBranchId("");
                  setSelectedContactId("");
                }}
                className="w-4 h-4"
              />
              法人
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="recipientType"
                value="contact"
                checked={recipientType === "contact"}
                onChange={() => {
                  setRecipientType("contact");
                  setSelectedRecipientId("");
                  setSelectedBranchId("");
                  setSelectedContactId("");
                }}
                className="w-4 h-4"
              />
              個人
            </label>
          </div>
        </div>

        {/* 宛先選択 */}
        <div className="space-y-2">
          <Label>宛先 *</Label>
          {recipientType === "account" ? (
            /* 法人検索 */
            <div className="relative" ref={accountSearchRef}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="法人名で検索..."
                  className="pl-9 pr-8"
                  value={selectedRecipientId ? selectedAccountName : accountSearchQuery}
                  onChange={(e) => {
                    setAccountSearchQuery(e.target.value);
                    setShowAccountDropdown(true);
                    if (!e.target.value) {
                      setSelectedRecipientId("");
                      setSelectedBranchId("");
                      setSelectedContactId("");
                    }
                  }}
                  onFocus={() => setShowAccountDropdown(true)}
                />
                {selectedRecipientId && (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setSelectedRecipientId("");
                      setSelectedBranchId("");
                      setSelectedContactId("");
                      setAccountSearchQuery("");
                    }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {showAccountDropdown && filteredAccounts.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-[200px] overflow-y-auto">
                  {filteredAccounts.map((account) => (
                    <button
                      key={account.id}
                      type="button"
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${
                        account.id === selectedRecipientId ? "bg-muted" : ""
                      }`}
                      onClick={() => {
                        setSelectedRecipientId(account.id);
                        setSelectedBranchId("");
                        setSelectedContactId("");
                        setAccountSearchQuery("");
                        setShowAccountDropdown(false);
                      }}
                    >
                      {account.company_name}
                    </button>
                  ))}
                </div>
              )}
              {showAccountDropdown && filteredAccounts.length === 0 && accountSearchQuery && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg p-3 text-sm text-muted-foreground">
                  該当する法人がありません
                </div>
              )}
            </div>
          ) : (
            /* 個人検索 */
            <div className="relative" ref={contactSearchRef}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="氏名・法人名で検索..."
                  className="pl-9 pr-8"
                  value={selectedRecipientId ? selectedContactName : contactSearchQuery}
                  onChange={(e) => {
                    setContactSearchQuery(e.target.value);
                    setShowContactDropdown(true);
                    if (!e.target.value) {
                      setSelectedRecipientId("");
                    }
                  }}
                  onFocus={() => setShowContactDropdown(true)}
                />
                {selectedRecipientId && (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setSelectedRecipientId("");
                      setContactSearchQuery("");
                    }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {showContactDropdown && filteredContacts.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-[250px] overflow-y-auto">
                  {filteredContacts.map((contact) => (
                    <button
                      key={contact.id}
                      type="button"
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${
                        contact.id === selectedRecipientId ? "bg-muted" : ""
                      }`}
                      onClick={() => {
                        setSelectedRecipientId(contact.id);
                        setContactSearchQuery("");
                        setShowContactDropdown(false);
                      }}
                    >
                      {contact.groupLabel && (
                        <span className="text-muted-foreground text-xs mr-2">
                          {contact.groupLabel}
                        </span>
                      )}
                      {contact.displayLabel}
                    </button>
                  ))}
                </div>
              )}
              {showContactDropdown && filteredContacts.length === 0 && contactSearchQuery && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg p-3 text-sm text-muted-foreground">
                  該当する個人がありません
                </div>
              )}
            </div>
          )}
        </div>

        {/* 支店選択（法人選択時のみ、支店がある場合のみ表示） */}
        {recipientType === "account" && selectedRecipientId && availableBranches.length > 0 && (
          <div className="space-y-2">
            <Label>支店</Label>
            <Select value={selectedBranchId || "__none__"} onValueChange={(v) => {
              setSelectedBranchId(v === "__none__" ? "" : v);
              setSelectedContactId("");
            }}>
              <SelectTrigger>
                <SelectValue placeholder="支店を選択（任意）" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">本社</SelectItem>
                {availableBranches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* 担当者選択（法人選択時のみ、担当者がいる場合のみ表示） */}
        {recipientType === "account" && selectedRecipientId && availableContacts.length > 0 && (
          <div className="space-y-2">
            <Label>担当者</Label>
            <Select value={selectedContactId || "__none__"} onValueChange={(v) => setSelectedContactId(v === "__none__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="担当者を選択（任意）" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">指定なし</SelectItem>
                {availableContacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.last_name} {c.first_name}
                    {c.department && <span className="text-muted-foreground ml-1">({c.department})</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* 差出人選択 */}
        <div className="space-y-2">
          <Label>差出人 *</Label>
          <Select value={selectedSenderId} onValueChange={setSelectedSenderId}>
            <SelectTrigger>
              <SelectValue placeholder="差出人を選択" />
            </SelectTrigger>
            <SelectContent>
              {sortedEmployees.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                  {e.id === currentEmployeeId && (
                    <span className="text-muted-foreground ml-1">(自分)</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 日付選択 */}
        <div className="space-y-2">
          <Label>日付</Label>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={useToday}
                onCheckedChange={(checked) => setUseToday(!!checked)}
              />
              <span className="text-sm">作成日（今日）を使用</span>
            </label>
          </div>
          {!useToday && (
            <Input
              type="date"
              value={documentDate}
              onChange={(e) => setDocumentDate(e.target.value)}
              className="w-48"
            />
          )}
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
            {error}
          </div>
        )}

        {/* 生成ボタン */}
        <Button
          onClick={handleGenerate}
          disabled={
            isGenerating ||
            !selectedTemplateId ||
            !selectedRecipientId ||
            !selectedSenderId
          }
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              文書を生成してダウンロード
            </>
          )}
        </Button>

        {/* 使用可能なプレースホルダー一覧 */}
        <div className="text-xs text-muted-foreground border-t pt-4">
          <p className="font-medium mb-2">テンプレートで使用可能なプレースホルダー:</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="font-medium col-span-2 mt-2">【宛先】</span>
            <span>{"{{宛先_会社名}}"}</span>
            <span>{"{{宛先_氏名}}"}</span>
            <span>{"{{宛先_郵便番号}}"}</span>
            <span>{"{{宛先_住所}}"}</span>
            <span>{"{{敬称}}"} <span className="text-xs">（様/御中）</span></span>
            <span className="font-medium col-span-2 mt-2">【支店】</span>
            <span>{"{{支店名}}"}</span>
            <span>{"{{支店_電話}}"}</span>
            <span>{"{{支店_FAX}}"}</span>
            <span>{"{{支店_郵便番号}}"}</span>
            <span>{"{{支店_住所}}"}</span>
            <span className="font-medium col-span-2 mt-2">【担当者】</span>
            <span>{"{{担当者_氏名}}"}</span>
            <span>{"{{担当者_氏名様}}"}</span>
            <span>{"{{担当者_部署}}"}</span>
            <span>{"{{担当者_役職}}"}</span>
            <span>{"{{担当者_電話}}"}</span>
            <span>{"{{担当者_メール}}"}</span>
            <span className="font-medium col-span-2 mt-2">【差出人・日付】</span>
            <span>{"{{差出人_氏名}}"}</span>
            <span>{"{{差出人_メール}}"}</span>
            <span>{"{{作成日}}"}</span>
            <span>{"{{指定日付}}"}</span>
          </div>
        </div>
      </CardContent>

      {/* アップロードダイアログ */}
      <Dialog open={isUploadDialogOpen} onOpenChange={(open) => {
        setIsUploadDialogOpen(open);
        if (!open) resetUploadForm();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>テンプレートアップロード</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Wordファイル *</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".docx"
                onChange={handleFileSelect}
              />
              {selectedFile && (
                <p className="text-sm text-muted-foreground">
                  選択: {selectedFile.name}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>テンプレート名 *</Label>
              <Input
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder="例: 案内状"
              />
            </div>

            <div className="space-y-2">
              <Label>説明</Label>
              <Input
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="例: 顧客向け案内状テンプレート"
              />
            </div>

            {uploadError && (
              <p className="text-sm text-destructive">{uploadError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleUpload} disabled={isUploading || !selectedFile}>
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  アップロード中...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  登録
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
