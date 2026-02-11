"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
import {
  PROJECT_CATEGORY_LABELS,
  PROJECT_AREA_GROUPS,
  type ProjectCategory,
  type ProjectStatus,
  type Industry,
} from "@/types/database";
import {
  createProject,
  getNextProjectCode,
  type CreateProjectData,
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
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<ProjectCategory | "">("");
  const [projectCode, setProjectCode] = useState<string>("");
  const [isLoadingCode, setIsLoadingCode] = useState(false);
  const [status, setStatus] = useState<ProjectStatus>("進行中");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [contactId, setContactId] = useState<string>("");
  const [managerId, setManagerId] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [locationDetail, setLocationDetail] = useState<string>("");

  // カテゴリ変更時に業務コードを自動生成
  const handleCategoryChange = async (val: ProjectCategory) => {
    setCategory(val);
    // 業務コードを取得
    setIsLoadingCode(true);
    try {
      const nextCode = await getNextProjectCode(val);
      setProjectCode(nextCode);
    } catch (err) {
      console.error("Error fetching next code:", err);
    } finally {
      setIsLoadingCode(false);
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

    if (!category) {
      setError("カテゴリを選択してください");
      return;
    }

    if (!projectCode.trim()) {
      setError("業務コードを入力してください");
      return;
    }

    const data: CreateProjectData = {
      code: projectCode.trim(),
      category: category as ProjectCategory,
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
    };

    startTransition(async () => {
      const result = await createProject(data);
      if (result?.error) {
        setError(result.error);
      }
    });
  };

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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">カテゴリ *</Label>
                <Select
                  value={category}
                  onValueChange={(val) => handleCategoryChange(val as ProjectCategory)}
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="カテゴリを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.keys(PROJECT_CATEGORY_LABELS) as ProjectCategory[]
                    ).map((key) => (
                      <SelectItem key={key} value={key}>
                        {PROJECT_CATEGORY_LABELS[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="code">業務コード *</Label>
                <div className="relative">
                  <Input
                    id="code"
                    name="code"
                    placeholder={category ? "自動生成中..." : "カテゴリを先に選択"}
                    value={projectCode}
                    onChange={(e) => setProjectCode(e.target.value)}
                    required
                    disabled={isLoadingCode}
                  />
                  {isLoadingCode && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              </div>
            </div>

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

        {/* 送信ボタン */}
        <div className="flex justify-end gap-4">
          <Link href="/projects">
            <Button type="button" variant="outline">
              キャンセル
            </Button>
          </Link>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            登録する
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


