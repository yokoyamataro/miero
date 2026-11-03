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
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  FileText,
  Download,
  Loader2,
  Upload,
  Search,
  X,
  Building2,
  User,
} from "lucide-react";
import { format } from "date-fns";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { createClient } from "@/lib/supabase/client";
import type { DocumentTemplate, Customer, Employee } from "@/types/database";
import { generateDocument } from "./document-actions";

interface DocumentTabProps {
  templates: DocumentTemplate[];
  customers: Customer[];
  employees: Employee[];
  currentEmployeeId: string | null;
}

export function DocumentTab({
  templates,
  customers,
  employees,
  currentEmployeeId,
}: DocumentTabProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // フォーム状態
  const [templateList, setTemplateList] = useState(templates);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedSenderId, setSelectedSenderId] = useState<string>(currentEmployeeId || "");
  const [useToday, setUseToday] = useState(true);
  const [documentDate, setDocumentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 顧客検索用
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerSearchRef = useRef<HTMLDivElement>(null);

  // アップロードダイアログ状態
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // クリック外でドロップダウンを閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        customerSearchRef.current &&
        !customerSearchRef.current.contains(event.target as Node)
      ) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 顧客検索結果 (法人・個人を統合)
  const filteredCustomers = useMemo(() => {
    const q = customerSearchQuery.trim().toLowerCase();
    const base = q
      ? customers.filter((c) => {
          const haystack = [
            c.display_name,
            c.display_name_kana,
            c.contact_last_name,
            c.contact_first_name,
            c.phone,
            c.email,
            c.city,
            c.street,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(q);
        })
      : customers;
    return base.slice(0, 30);
  }, [customers, customerSearchQuery]);

  // 選択中の顧客
  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) return null;
    return customers.find((c) => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  const selectedCustomerLabel = selectedCustomer
    ? selectedCustomer.display_name
    : "";

  // 生成処理
  const handleGenerate = async () => {
    if (!selectedTemplateId || !selectedCustomerId || !selectedSenderId) {
      setError("テンプレート、宛先、差出人を選択してください");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const result = await generateDocument({
        templateId: selectedTemplateId,
        customerId: selectedCustomerId,
        senderId: selectedSenderId,
        documentDate: useToday ? format(new Date(), "yyyy-MM-dd") : documentDate,
      });

      if (!result.success || !result.data) {
        setError(result.error || "生成に失敗しました");
        return;
      }

      const { templateFileName, storagePath, placeholderValues } = JSON.parse(
        result.data
      );

      let templateArrayBuffer: ArrayBuffer;

      if (storagePath) {
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
        const templateResponse = await fetch(`/templates/${templateFileName}`);
        if (!templateResponse.ok) {
          setError("テンプレートファイルが見つかりません。");
          return;
        }
        templateArrayBuffer = await templateResponse.arrayBuffer();
      }

      const zip = new PizZip(templateArrayBuffer);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: "{{", end: "}}" },
      });
      doc.render(placeholderValues);

      const output = doc.getZip().generate({
        type: "blob",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
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

  // 差出人リスト (ログインユーザーを先頭に)
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
      const safeFileName = `${timestamp}.docx`;
      const storagePath = safeFileName;

      const { error: uploadErr } = await supabase.storage
        .from("document-templates")
        .upload(storagePath, selectedFile);

      if (uploadErr) {
        throw new Error("ファイルのアップロードに失敗しました: " + uploadErr.message);
      }

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
        throw new Error(
          "テンプレートの登録に失敗しました: " + insertErr.message
        );
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

        {/* 宛先選択 (法人・個人を1つの検索欄で統合) */}
        <div className="space-y-2">
          <Label>宛先 *</Label>
          <div className="relative" ref={customerSearchRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="法人名・氏名・カナで検索"
                className="pl-9 pr-8"
                value={selectedCustomerId ? selectedCustomerLabel : customerSearchQuery}
                onChange={(e) => {
                  setCustomerSearchQuery(e.target.value);
                  setShowCustomerDropdown(true);
                  if (!e.target.value) {
                    setSelectedCustomerId("");
                  }
                }}
                onFocus={() => setShowCustomerDropdown(true)}
              />
              {selectedCustomerId && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setSelectedCustomerId("");
                    setCustomerSearchQuery("");
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {showCustomerDropdown && filteredCustomers.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-[280px] overflow-y-auto">
                {filteredCustomers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center gap-2 ${
                      c.id === selectedCustomerId ? "bg-muted" : ""
                    }`}
                    onClick={() => {
                      setSelectedCustomerId(c.id);
                      setCustomerSearchQuery("");
                      setShowCustomerDropdown(false);
                    }}
                  >
                    {c.type === "corporate" ? (
                      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 flex-shrink-0">
                        <Building2 className="h-3 w-3 mr-1" />
                        法人
                      </Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100 flex-shrink-0">
                        <User className="h-3 w-3 mr-1" />
                        個人
                      </Badge>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{c.display_name}</div>
                      {c.type === "corporate" && c.contact_last_name && (
                        <div className="text-xs text-muted-foreground truncate">
                          担当: {c.contact_last_name} {c.contact_first_name ?? ""}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {showCustomerDropdown &&
              filteredCustomers.length === 0 &&
              customerSearchQuery && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg p-3 text-sm text-muted-foreground">
                  該当する顧客がありません
                </div>
              )}
          </div>
          {selectedCustomer && selectedCustomer.type === "corporate" && (
            <p className="text-xs text-muted-foreground">
              {selectedCustomer.contact_last_name || selectedCustomer.contact_first_name
                ? `担当者: ${selectedCustomer.contact_last_name ?? ""} ${selectedCustomer.contact_first_name ?? ""}`.trim()
                : "担当者未設定（宛先は「御中」になります）"}
            </p>
          )}
        </div>

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
            !selectedCustomerId ||
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

        {/* プレースホルダー一覧 */}
        <div className="text-xs text-muted-foreground border-t pt-4">
          <p className="font-medium mb-2">テンプレートで使用可能なプレースホルダー:</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="font-medium col-span-2 mt-2">【宛先】</span>
            <span>{"{{宛先_会社名}}"}</span>
            <span>{"{{宛先_氏名}}"}</span>
            <span>{"{{宛先_郵便番号}}"}</span>
            <span>{"{{宛先_住所}}"}</span>
            <span>{"{{敬称}}"} <span className="text-xs">(様/御中)</span></span>
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
      <Dialog
        open={isUploadDialogOpen}
        onOpenChange={(open) => {
          setIsUploadDialogOpen(open);
          if (!open) resetUploadForm();
        }}
      >
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
