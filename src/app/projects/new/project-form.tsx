"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, Plus, FileText } from "lucide-react";
import {
  PROJECT_CATEGORY_LABELS,
  PROJECT_AREA_GROUPS,
  type ProjectCategory,
  type ProjectStatus,
  type Industry,
} from "@/types/database";
import {
  createProjects,
  getNextProjectCode,
  type CreateProjectsData,
  type CustomerData,
  type AccountWithContacts,
  type IndividualContact,
} from "../actions";
import {
  AddAccountModal,
  AddIndividualModal,
  type AccountFormData,
  type ContactFormData,
  type BranchFormData,
} from "@/components/customer-modal";
import { createAccount } from "@/app/accounts/actions";
import { createIndividualContact, type IndividualContactFormData } from "@/app/contacts/actions";

interface Employee {
  id: string;
  name: string;
}

interface ProjectFormProps {
  customerData: CustomerData;
  employees: Employee[];
  industries: Industry[];
}

export function ProjectForm({ customerData, employees, industries }: ProjectFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // 複数カテゴリ選択（最大3つ）
  const [categories, setCategories] = useState<ProjectCategory[]>([]);
  const [projectCodes, setProjectCodes] = useState<Record<ProjectCategory, string>>({} as Record<ProjectCategory, string>);
  const [loadingCodes, setLoadingCodes] = useState<Record<ProjectCategory, boolean>>({} as Record<ProjectCategory, boolean>);

  const [status, setStatus] = useState<ProjectStatus>("進行中");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [contactId, setContactId] = useState<string>("");
  const [managerId, setManagerId] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [locationDetail, setLocationDetail] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // カテゴリ選択/解除時に業務コードを自動生成
  const handleCategoryToggle = async (category: ProjectCategory, checked: boolean) => {
    if (checked) {
      // 最大3つまで
      if (categories.length >= 3) {
        return;
      }
      setCategories((prev) => [...prev, category]);
      // 業務コードを取得
      setLoadingCodes((prev) => ({ ...prev, [category]: true }));
      try {
        const nextCode = await getNextProjectCode(category);
        setProjectCodes((prev) => ({ ...prev, [category]: nextCode }));
      } catch (err) {
        console.error("Error fetching next code:", err);
      } finally {
        setLoadingCodes((prev) => ({ ...prev, [category]: false }));
      }
    } else {
      setCategories((prev) => prev.filter((c) => c !== category));
      setProjectCodes((prev) => {
        const newCodes = { ...prev };
        delete newCodes[category];
        return newCodes;
      });
    }
  };

  // 顧客データを状態で管理（新規追加時に更新するため）
  const [accounts, setAccounts] = useState(customerData.accounts);
  const [individuals, setIndividuals] = useState(customerData.individuals);

  // 新規顧客追加モーダル
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showIndividualModal, setShowIndividualModal] = useState(false);

  // 選択した法人の担当者リスト
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  // 新規法人追加（モーダルから呼ばれる）
  const handleCreateAccount = async (
    data: AccountFormData,
    contacts: ContactFormData[],
    branches: BranchFormData[]
  ): Promise<{ error?: string; accountId?: string; primaryContactId?: string }> => {
    const result = await createAccount(data, contacts, branches);
    if (result.error) {
      return { error: result.error };
    }
    return {
      accountId: result.accountId || undefined,
      primaryContactId: result.primaryContactId || undefined,
    };
  };

  // 法人保存後のコールバック
  const handleAccountSaved = (contactId: string, accountId: string, companyName: string, contactName: string) => {
    // 新しい法人をリストに追加
    const newAccount: AccountWithContacts = {
      id: accountId,
      companyName: companyName,
      contacts: contactId ? [{ id: contactId, name: contactName || "(担当者)" }] : [],
    };
    setAccounts((prev) => [newAccount, ...prev]);
    // 新しい法人を選択
    setSelectedAccountId(accountId);
    // 担当者を選択
    if (contactId) {
      setContactId(contactId);
    }
  };

  // 新規個人追加（モーダルから呼ばれる）
  const handleCreateIndividualContact = async (
    data: IndividualContactFormData
  ): Promise<{ error?: string; contactId?: string }> => {
    const result = await createIndividualContact(data);
    if (result.error) {
      return { error: result.error };
    }
    return { contactId: result.contactId };
  };

  // 個人保存後のコールバック
  const handleIndividualSaved = (contactId: string, name: string) => {
    // 新しい個人をリストに追加
    const newIndividual: IndividualContact = {
      id: contactId,
      name: name,
    };
    setIndividuals((prev) => [newIndividual, ...prev]);
    // 法人選択を解除して個人を選択
    setSelectedAccountId("none");
    setContactId(contactId);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);

    if (categories.length === 0) {
      setError("カテゴリを1つ以上選択してください");
      return;
    }

    const data: CreateProjectsData = {
      categories: categories,
      name: formData.get("name") as string,
      status: status,
      contact_id: contactId && contactId !== "none" ? contactId : null,
      manager_id: managerId || null,
      start_date: (formData.get("start_date") as string) || null,
      end_date: (formData.get("end_date") as string) || null,
      fee_tax_excluded: formData.get("fee_tax_excluded")
        ? parseInt(formData.get("fee_tax_excluded") as string, 10)
        : null,
      location: location || null,
      location_detail: locationDetail || null,
      notes: notes.trim() || null,
    };

    startTransition(async () => {
      const result = await createProjects(data);
      if (result?.error) {
        setError(result.error);
      } else if (result?.primaryProjectId) {
        // 登録した業務の詳細画面に遷移
        router.push(`/projects/${result.primaryProjectId}`);
      }
    });
  };

  // ローディング中かどうか
  const isAnyCodeLoading = Object.values(loadingCodes).some((v) => v);

  return (
    <>
      <header className="mb-8">
        <Link
          href="/projects"
          className="flex items-center text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          業務一覧に戻る
        </Link>
        <h1 className="text-2xl font-bold">新規業務登録</h1>
      </header>

      {error && (
        <Card className="mb-6 border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 基本情報 */}
        <Card>
          <CardHeader>
            <CardTitle>基本情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* カテゴリ選択（チェックボックスグループ） */}
            <div>
              <Label>カテゴリ * (最大3つ選択可能)</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                {(Object.keys(PROJECT_CATEGORY_LABELS) as ProjectCategory[]).map((key) => {
                  const isSelected = categories.includes(key);
                  const isDisabled = !isSelected && categories.length >= 3;
                  return (
                    <div
                      key={key}
                      className={`flex items-center space-x-2 p-2 rounded border ${
                        isSelected ? "bg-primary/10 border-primary" : "border-border"
                      } ${isDisabled ? "opacity-50" : ""}`}
                    >
                      <Checkbox
                        id={`category-${key}`}
                        checked={isSelected}
                        disabled={isDisabled}
                        onCheckedChange={(checked) => handleCategoryToggle(key, !!checked)}
                      />
                      <label
                        htmlFor={`category-${key}`}
                        className={`text-sm cursor-pointer ${isDisabled ? "cursor-not-allowed" : ""}`}
                      >
                        {PROJECT_CATEGORY_LABELS[key]}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 業務コード表示 */}
            {categories.length > 0 && (
              <div>
                <Label>業務コード</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {categories.map((cat) => (
                    <div
                      key={cat}
                      className="flex items-center gap-2 px-3 py-1.5 rounded bg-muted text-sm"
                    >
                      <span className="font-medium">{PROJECT_CATEGORY_LABELS[cat]}:</span>
                      {loadingCodes[cat] ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <span className="font-mono">{projectCodes[cat] || "..."}</span>
                      )}
                    </div>
                  ))}
                </div>
                {categories.length > 1 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {categories.length}つの業務が作成され、相互に関連業務として登録されます
                  </p>
                )}
              </div>
            )}

            <div>
              <Label htmlFor="name">業務名 *</Label>
              <Input
                id="name"
                name="name"
                placeholder="例: ○○様邸 境界確定測量"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="status">ステータス</Label>
                <Select value={status} onValueChange={(val) => setStatus(val as ProjectStatus)}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="進行中">進行中</SelectItem>
                    <SelectItem value="完了">完了</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="fee_tax_excluded">税抜報酬額</Label>
                <Input
                  id="fee_tax_excluded"
                  name="fee_tax_excluded"
                  type="number"
                  placeholder="0"
                />
              </div>
            </div>

            {/* 顧客選択（2段階選択） */}
            <div className="space-y-4">
              <Label>顧客</Label>
              <div className="grid grid-cols-2 gap-4">
                {/* 法人 or 個人 選択 */}
                <div>
                  <Label className="text-xs text-muted-foreground">法人</Label>
                  <Select
                    value={selectedAccountId}
                    onValueChange={(val) => {
                      setSelectedAccountId(val);
                      setContactId(""); // 法人を変えたら担当者をリセット
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="法人を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <div
                        className="flex items-center gap-2 px-2 py-1.5 text-sm text-primary cursor-pointer hover:bg-muted rounded-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowAccountModal(true);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                        新規法人を追加
                      </div>
                      <div className="h-px bg-border my-1" />
                      <SelectItem value="none">選択しない</SelectItem>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.companyName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 法人の担当者 or 個人 選択 */}
                <div>
                  <Label className="text-xs text-muted-foreground">
                    {selectedAccountId && selectedAccountId !== "none" ? "担当者" : "個人"}
                  </Label>
                  <Select value={contactId} onValueChange={setContactId}>
                    <SelectTrigger>
                      <SelectValue placeholder={selectedAccountId && selectedAccountId !== "none" ? "担当者を選択" : "個人を選択"} />
                    </SelectTrigger>
                    <SelectContent>
                      {!(selectedAccountId && selectedAccountId !== "none") && (
                        <>
                          <div
                            className="flex items-center gap-2 px-2 py-1.5 text-sm text-primary cursor-pointer hover:bg-muted rounded-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowIndividualModal(true);
                            }}
                          >
                            <Plus className="h-4 w-4" />
                            新規個人を追加
                          </div>
                          <div className="h-px bg-border my-1" />
                        </>
                      )}
                      <SelectItem value="none">未選択</SelectItem>
                      {selectedAccountId && selectedAccountId !== "none" ? (
                        // 法人の担当者リスト
                        selectedAccount?.contacts.map((contact) => (
                          <SelectItem key={contact.id} value={contact.id}>
                            {contact.name}
                          </SelectItem>
                        ))
                      ) : (
                        // 個人リスト
                        individuals.map((contact) => (
                          <SelectItem key={contact.id} value={contact.id}>
                            {contact.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="manager_id">担当者（社員）</Label>
                <Select value={managerId} onValueChange={setManagerId}>
                  <SelectTrigger id="manager_id">
                    <SelectValue placeholder="担当者を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start_date">着手日</Label>
                <Input id="start_date" name="start_date" type="date" />
              </div>
              <div>
                <Label htmlFor="end_date">完了予定日</Label>
                <Input id="end_date" name="end_date" type="date" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="location">所在地・エリア</Label>
                <Select value={location} onValueChange={setLocation}>
                  <SelectTrigger id="location">
                    <SelectValue placeholder="エリアを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_AREA_GROUPS.map((group) => (
                      <SelectGroup key={group.name}>
                        <SelectLabel className="font-bold text-muted-foreground">
                          {group.name}
                        </SelectLabel>
                        {group.areas.map((area) => (
                          <SelectItem key={area} value={area}>
                            {area}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="location_detail">字・町名以下</Label>
                <Input
                  id="location_detail"
                  placeholder="例: 朱円1番地"
                  value={locationDetail}
                  onChange={(e) => setLocationDetail(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ノート */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              ノート
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              id="notes"
              placeholder="業務に関するメモや詳細情報を入力..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        {/* 送信ボタン */}
        <div className="flex justify-end gap-4">
          <Link href="/projects">
            <Button type="button" variant="outline">
              キャンセル
            </Button>
          </Link>
          <Button type="submit" disabled={isPending || isAnyCodeLoading || categories.length === 0}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {categories.length > 1 ? `${categories.length}件登録する` : "登録する"}
          </Button>
        </div>
      </form>

      {/* 新規法人追加モーダル */}
      <AddAccountModal
        open={showAccountModal}
        onOpenChange={setShowAccountModal}
        onSaved={handleAccountSaved}
        industries={industries}
        createAccount={handleCreateAccount}
      />

      {/* 新規個人追加モーダル */}
      <AddIndividualModal
        open={showIndividualModal}
        onOpenChange={setShowIndividualModal}
        onSaved={handleIndividualSaved}
        createIndividualContact={handleCreateIndividualContact}
      />
    </>
  );
}
