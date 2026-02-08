"use client";

import { useState } from "react";
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
import { FileText, Download, Loader2 } from "lucide-react";
import { format } from "date-fns";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
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
  // フォーム状態
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

      const { templateFileName, placeholderValues } = JSON.parse(result.data);

      // 2. テンプレートファイルをfetch
      const templateResponse = await fetch(`/templates/${templateFileName}`);
      if (!templateResponse.ok) {
        setError("テンプレートファイルが見つかりません。public/templates/にファイルを配置してください。");
        return;
      }
      const templateArrayBuffer = await templateResponse.arrayBuffer();

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
          <Label>テンプレート *</Label>
          <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
            <SelectTrigger>
              <SelectValue placeholder="テンプレートを選択" />
            </SelectTrigger>
            <SelectContent>
              {templates.length === 0 ? (
                <SelectItem value="none" disabled>
                  テンプレートがありません
                </SelectItem>
              ) : (
                templates.map((t) => (
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
          <Select value={selectedRecipientId} onValueChange={(v) => {
            setSelectedRecipientId(v);
            setSelectedBranchId("");
            setSelectedContactId("");
          }}>
            <SelectTrigger>
              <SelectValue placeholder="宛先を選択" />
            </SelectTrigger>
            <SelectContent>
              {recipientType === "account" ? (
                accounts.length === 0 ? (
                  <SelectItem value="none" disabled>
                    法人がありません
                  </SelectItem>
                ) : (
                  accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.company_name}
                    </SelectItem>
                  ))
                )
              ) : (
                <>
                  {/* 個人顧客 */}
                  {individuals.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>個人顧客</SelectLabel>
                      {individuals.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.last_name} {c.first_name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {/* 法人担当者 */}
                  {accounts.map((a) => {
                    const accountContacts = allContacts.filter(
                      (c) => c.account_id === a.id
                    );
                    if (accountContacts.length === 0) return null;
                    return (
                      <SelectGroup key={a.id}>
                        <SelectLabel>{a.company_name}</SelectLabel>
                        {accountContacts.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.last_name} {c.first_name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    );
                  })}
                </>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* 支店選択（法人選択時のみ、支店がある場合のみ表示） */}
        {recipientType === "account" && selectedRecipientId && availableBranches.length > 0 && (
          <div className="space-y-2">
            <Label>支店</Label>
            <Select value={selectedBranchId} onValueChange={(v) => {
              setSelectedBranchId(v);
              setSelectedContactId("");
            }}>
              <SelectTrigger>
                <SelectValue placeholder="支店を選択（任意）" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">本社</SelectItem>
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
            <Select value={selectedContactId} onValueChange={setSelectedContactId}>
              <SelectTrigger>
                <SelectValue placeholder="担当者を選択（任意）" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">指定なし</SelectItem>
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
            <span className="font-medium col-span-2 mt-2">【支店】</span>
            <span>{"{{支店名}}"}</span>
            <span>{"{{支店_電話}}"}</span>
            <span>{"{{支店_FAX}}"}</span>
            <span>{"{{支店_郵便番号}}"}</span>
            <span>{"{{支店_住所}}"}</span>
            <span className="font-medium col-span-2 mt-2">【担当者】</span>
            <span>{"{{担当者_氏名}}"}</span>
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
    </Card>
  );
}
