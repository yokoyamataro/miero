"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
} from "@/components/ui/select";
import { ArrowLeft, Loader2, Trash2, Plus, X, Star, Building, Sparkles } from "lucide-react";
import type { AccountWithContacts, Industry } from "@/types/database";
import {
  createAccount,
  updateAccount,
  deleteAccount,
  type AccountFormData,
  type ContactFormData,
  type BranchFormData,
} from "./actions";
import { IndustrySelect } from "./industry-select";
import { estimatePostalCode } from "@/lib/ai/postal-code";

interface AccountFormProps {
  account?: AccountWithContacts;
  isEdit?: boolean;
  industries: Industry[];
}

export function AccountForm({ account, isEdit = false, industries }: AccountFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [industry, setIndustry] = useState<string>(account?.industry || "");
  const [estimatingPostalCode, setEstimatingPostalCode] = useState(false);

  // 支店の状態管理
  const [branches, setBranches] = useState<BranchFormData[]>(
    account?.branches?.map((b) => ({
      id: b.id,
      name: b.name,
      phone: b.phone,
      postal_code: b.postal_code,
      prefecture: b.prefecture,
      city: b.city,
      street: b.street,
      building: b.building,
    })) || []
  );

  // 担当者の状態管理
  const [contacts, setContacts] = useState<ContactFormData[]>(
    account?.contacts?.map((c) => ({
      id: c.id,
      last_name: c.last_name,
      first_name: c.first_name,
      last_name_kana: c.last_name_kana,
      first_name_kana: c.first_name_kana,
      phone: c.phone,
      email: c.email,
      department: c.department,
      position: c.position,
      is_primary: c.is_primary,
      branch_id: c.branch_id,
    })) || []
  );

  // 支店の追加
  const addBranch = () => {
    setBranches([
      ...branches,
      {
        id: `temp-${Date.now()}`,
        name: "",
        phone: null,
        postal_code: null,
        prefecture: null,
        city: null,
        street: null,
        building: null,
      },
    ]);
  };

  // 支店の削除
  const removeBranch = (index: number) => {
    const branchId = branches[index].id;
    setBranches(branches.filter((_, i) => i !== index));
    // この支店を参照している担当者のbranch_idをクリア
    setContacts((prev) =>
      prev.map((c) => (c.branch_id === branchId ? { ...c, branch_id: null } : c))
    );
  };

  // 支店の更新
  const updateBranch = (
    index: number,
    field: keyof BranchFormData,
    value: string | null
  ) => {
    setBranches((prev) =>
      prev.map((b, i) => (i === index ? { ...b, [field]: value } : b))
    );
  };

  // 担当者の追加
  const addContact = () => {
    setContacts([
      ...contacts,
      {
        last_name: "",
        first_name: "",
        last_name_kana: null,
        first_name_kana: null,
        phone: null,
        email: null,
        department: null,
        position: null,
        is_primary: contacts.length === 0,
        branch_id: null,
      },
    ]);
  };

  // 担当者の削除
  const removeContact = (index: number) => {
    const newContacts = contacts.filter((_, i) => i !== index);
    if (contacts[index].is_primary && newContacts.length > 0) {
      newContacts[0].is_primary = true;
    }
    setContacts(newContacts);
  };

  // 担当者の更新
  const updateContact = (
    index: number,
    field: keyof ContactFormData,
    value: string | boolean | null
  ) => {
    setContacts((prev) => {
      const newContacts = prev.map((c, i) => {
        if (field === "is_primary" && value === true) {
          return i === index
            ? { ...c, is_primary: true }
            : { ...c, is_primary: false };
        }
        if (i === index) {
          return { ...c, [field]: value };
        }
        return c;
      });
      return newContacts;
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);

    const data: AccountFormData = {
      company_name: formData.get("company_name") as string,
      company_name_kana: (formData.get("company_name_kana") as string) || null,
      corporate_number: (formData.get("corporate_number") as string) || null,
      main_phone: (formData.get("main_phone") as string) || null,
      postal_code: (formData.get("postal_code") as string) || null,
      prefecture: (formData.get("prefecture") as string) || null,
      city: (formData.get("city") as string) || null,
      street: (formData.get("street") as string) || null,
      building: (formData.get("building") as string) || null,
      industry: industry || null,
      notes: (formData.get("notes") as string) || null,
    };

    const validContacts = contacts.filter(
      (c) => c.last_name.trim() !== "" || c.first_name.trim() !== ""
    );

    const validBranches = branches.filter((b) => b.name.trim() !== "");

    startTransition(async () => {
      let result;
      if (isEdit && account) {
        result = await updateAccount(account.id, data, validContacts, validBranches);
      } else {
        result = await createAccount(data, validContacts, validBranches);
      }

      if (result.error) {
        setError(result.error);
      } else {
        router.push("/accounts");
      }
    });
  };

  // 住所から郵便番号を推定
  const handleEstimatePostalCode = async () => {
    const form = document.querySelector("form") as HTMLFormElement;
    if (!form) return;

    const formData = new FormData(form);
    const companyName = formData.get("company_name") as string;
    const prefecture = formData.get("prefecture") as string;
    const city = formData.get("city") as string;
    const street = formData.get("street") as string;

    if (!prefecture || !city) {
      setError("都道府県と市区町村を入力してください");
      return;
    }

    setEstimatingPostalCode(true);
    setError(null);

    try {
      const result = await estimatePostalCode(prefecture, city, street, companyName);
      if (result.postalCode) {
        const postalCodeInput = document.getElementById("postal_code") as HTMLInputElement;
        if (postalCodeInput) {
          // 郵便番号をフォーマット（XXX-XXXX）
          const formatted = result.postalCode.slice(0, 3) + "-" + result.postalCode.slice(3);
          postalCodeInput.value = formatted;
        }
        setError("AIによる推定です。正確でない場合があるため確認してください。");
      } else {
        setError(result.error || "郵便番号を特定できませんでした");
      }
    } catch {
      setError("郵便番号の推定に失敗しました");
    } finally {
      setEstimatingPostalCode(false);
    }
  };

  const handleDelete = async () => {
    if (!account) return;
    if (
      !confirm(
        "この法人を削除してもよろしいですか？\n関連する支店・担当者情報も削除されます。"
      )
    )
      return;

    startTransition(async () => {
      const result = await deleteAccount(account.id);
      if (result.error) {
        setError(result.error);
      } else {
        router.push("/accounts");
      }
    });
  };

  return (
    <>
      <header className="mb-8">
        <Link
          href="/accounts"
          className="flex items-center text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          法人一覧に戻る
        </Link>
        <h1 className="text-2xl font-bold">
          {isEdit ? "法人編集" : "新規法人登録"}
        </h1>
      </header>

      {error && (
        <Card className="mb-6 border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>法人情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="company_name">会社名 *</Label>
                <Input
                  id="company_name"
                  name="company_name"
                  placeholder="例: 株式会社ABC建設"
                  defaultValue={account?.company_name || ""}
                  required
                />
              </div>
              <div>
                <Label htmlFor="company_name_kana">会社名（カナ）</Label>
                <Input
                  id="company_name_kana"
                  name="company_name_kana"
                  placeholder="例: カブシキガイシャエービーシーケンセツ"
                  defaultValue={account?.company_name_kana || ""}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="corporate_number">会社法人等番号（12桁）</Label>
                <Input
                  id="corporate_number"
                  name="corporate_number"
                  placeholder="例: 123456789012"
                  maxLength={12}
                  pattern="\d{12}"
                  defaultValue={account?.corporate_number || ""}
                />
              </div>
              <div>
                <Label htmlFor="main_phone">代表電話番号</Label>
                <Input
                  id="main_phone"
                  name="main_phone"
                  placeholder="例: 011-1234-5678"
                  defaultValue={account?.main_phone || ""}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="industry">業種</Label>
                <IndustrySelect
                  industries={industries}
                  value={industry}
                  onChange={setIndustry}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="postal_code">郵便番号</Label>
                <div className="flex gap-2">
                  <Input
                    id="postal_code"
                    name="postal_code"
                    placeholder="060-0001"
                    defaultValue={account?.postal_code || ""}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleEstimatePostalCode}
                    disabled={estimatingPostalCode}
                    title="住所から郵便番号を推定（AI）"
                  >
                    {estimatingPostalCode ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="prefecture">都道府県</Label>
                <Input
                  id="prefecture"
                  name="prefecture"
                  placeholder="北海道"
                  defaultValue={account?.prefecture || ""}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="city">市区町村</Label>
                <Input
                  id="city"
                  name="city"
                  placeholder="札幌市中央区"
                  defaultValue={account?.city || ""}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="street">町名・番地</Label>
                <Input
                  id="street"
                  name="street"
                  placeholder="大通1-1"
                  defaultValue={account?.street || ""}
                />
              </div>
              <div>
                <Label htmlFor="building">建物名・部屋番号</Label>
                <Input
                  id="building"
                  name="building"
                  placeholder="○○ビル3F"
                  defaultValue={account?.building || ""}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">備考</Label>
              <textarea
                id="notes"
                name="notes"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="備考・メモ"
                defaultValue={account?.notes || ""}
              />
            </div>
          </CardContent>
        </Card>

        {/* 支店セクション */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>支店</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addBranch}>
              <Plus className="h-4 w-4 mr-2" />
              支店を追加
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {branches.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">
                支店がありません。「支店を追加」ボタンで追加できます。
              </p>
            ) : (
              branches.map((branch, index) => (
                <div
                  key={branch.id || index}
                  className="border rounded-lg p-4 space-y-3 relative"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <Building className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {branch.name || "（支店名未入力）"}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeBranch(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">支店名 *</Label>
                      <Input
                        placeholder="例: 札幌支店"
                        value={branch.name}
                        onChange={(e) =>
                          updateBranch(index, "name", e.target.value)
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-xs">電話番号</Label>
                      <Input
                        placeholder="例: 011-9999-8888"
                        value={branch.phone || ""}
                        onChange={(e) =>
                          updateBranch(index, "phone", e.target.value || null)
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs">郵便番号</Label>
                      <Input
                        placeholder="060-0001"
                        value={branch.postal_code || ""}
                        onChange={(e) =>
                          updateBranch(index, "postal_code", e.target.value || null)
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">都道府県</Label>
                      <Input
                        placeholder="北海道"
                        value={branch.prefecture || ""}
                        onChange={(e) =>
                          updateBranch(index, "prefecture", e.target.value || null)
                        }
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-xs">市区町村</Label>
                      <Input
                        placeholder="札幌市中央区"
                        value={branch.city || ""}
                        onChange={(e) =>
                          updateBranch(index, "city", e.target.value || null)
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">町名・番地</Label>
                      <Input
                        placeholder="大通1-1"
                        value={branch.street || ""}
                        onChange={(e) =>
                          updateBranch(index, "street", e.target.value || null)
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">建物名・部屋番号</Label>
                      <Input
                        placeholder="○○ビル3F"
                        value={branch.building || ""}
                        onChange={(e) =>
                          updateBranch(index, "building", e.target.value || null)
                        }
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* 担当者セクション */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>担当者</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addContact}>
              <Plus className="h-4 w-4 mr-2" />
              担当者を追加
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {contacts.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">
                担当者がありません。「担当者を追加」ボタンで追加できます。
              </p>
            ) : (
              contacts.map((contact, index) => (
                <div
                  key={index}
                  className="border rounded-lg p-4 space-y-3 relative"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateContact(index, "is_primary", true)}
                        className={`p-1 rounded ${
                          contact.is_primary
                            ? "text-yellow-500"
                            : "text-gray-300 hover:text-yellow-400"
                        }`}
                        title={
                          contact.is_primary ? "主要担当者" : "主要担当者に設定"
                        }
                      >
                        <Star
                          className="h-5 w-5"
                          fill={contact.is_primary ? "currentColor" : "none"}
                        />
                      </button>
                      {contact.is_primary && (
                        <span className="text-xs text-yellow-600 font-medium">
                          主要担当者
                        </span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeContact(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs">姓 *</Label>
                      <Input
                        placeholder="田中"
                        value={contact.last_name}
                        onChange={(e) =>
                          updateContact(index, "last_name", e.target.value)
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-xs">名 *</Label>
                      <Input
                        placeholder="次郎"
                        value={contact.first_name}
                        onChange={(e) =>
                          updateContact(index, "first_name", e.target.value)
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-xs">姓（カナ）</Label>
                      <Input
                        placeholder="タナカ"
                        value={contact.last_name_kana || ""}
                        onChange={(e) =>
                          updateContact(index, "last_name_kana", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">名（カナ）</Label>
                      <Input
                        placeholder="ジロウ"
                        value={contact.first_name_kana || ""}
                        onChange={(e) =>
                          updateContact(index, "first_name_kana", e.target.value)
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs">所属支店</Label>
                      <Select
                        value={contact.branch_id || "none"}
                        onValueChange={(value) =>
                          updateContact(index, "branch_id", value === "none" ? null : value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="選択なし" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">本社</SelectItem>
                          {branches
                            .filter((b) => b.name.trim() !== "")
                            .map((branch) => (
                              <SelectItem key={branch.id} value={branch.id || ""}>
                                {branch.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">部署</Label>
                      <Input
                        placeholder="営業部"
                        value={contact.department || ""}
                        onChange={(e) =>
                          updateContact(index, "department", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">役職</Label>
                      <Input
                        placeholder="部長"
                        value={contact.position || ""}
                        onChange={(e) =>
                          updateContact(index, "position", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">電話番号</Label>
                      <Input
                        placeholder="090-1234-5678"
                        value={contact.phone || ""}
                        onChange={(e) =>
                          updateContact(index, "phone", e.target.value)
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">メール</Label>
                      <Input
                        type="email"
                        placeholder="tanaka@example.com"
                        value={contact.email || ""}
                        onChange={(e) =>
                          updateContact(index, "email", e.target.value)
                        }
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <div>
            {isEdit && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isPending}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                削除
              </Button>
            )}
          </div>
          <div className="flex gap-4">
            <Link href="/accounts">
              <Button type="button" variant="outline">
                キャンセル
              </Button>
            </Link>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? "更新する" : "登録する"}
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}
