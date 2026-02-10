"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, X, Star, Building, Search, ChevronLeft } from "lucide-react";
import type { Industry } from "@/types/database";
import { estimatePostalCode } from "@/lib/ai/postal-code";

// 法人格のカナパターン
const CORPORATE_TITLE_KANA = [
  "カブシキガイシャ",
  "カブシキ ガイシャ",
  "ユウゲンガイシャ",
  "ユウゲン ガイシャ",
  "ゴウドウガイシャ",
  "ゴウドウ ガイシャ",
  "ゴウシガイシャ",
  "ゴウシ ガイシャ",
  "ゴウメイガイシャ",
  "ゴウメイ ガイシャ",
  "トクテイヒエイリカツドウホウジン",
  "イッパンシャダンホウジン",
  "コウエキシャダンホウジン",
  "イッパンザイダンホウジン",
  "コウエキザイダンホウジン",
  "シャカイフクシホウジン",
  "ガッコウホウジン",
  "イリョウホウジン",
  "ノウジクミアイホウジン",
  "キョウドウクミアイ",
  "（カ）",
  "（ユ）",
  "（ド）",
  "(カ)",
  "(ユ)",
  "(ド)",
];

function stripCorporateTitleKana(value: string): string {
  let result = value.trim();
  for (const title of CORPORATE_TITLE_KANA) {
    if (result.startsWith(title)) {
      result = result.slice(title.length).trim();
    }
    if (result.endsWith(title)) {
      result = result.slice(0, -title.length).trim();
    }
  }
  return result;
}

export interface AccountFormData {
  company_name: string;
  company_name_kana: string | null;
  corporate_number: string | null;
  main_phone: string | null;
  fax: string | null;
  postal_code: string | null;
  prefecture: string | null;
  city: string | null;
  street: string | null;
  building: string | null;
  industry: string | null;
  notes: string | null;
}

export interface ContactFormData {
  id?: string;
  last_name: string;
  first_name: string;
  last_name_kana: string | null;
  first_name_kana: string | null;
  phone: string | null;
  email: string | null;
  department: string | null;
  position: string | null;
  is_primary: boolean;
  branch_id: string | null;
}

export interface BranchFormData {
  id?: string;
  name: string;
  phone: string | null;
  fax: string | null;
  postal_code: string | null;
  prefecture: string | null;
  city: string | null;
  street: string | null;
  building: string | null;
}

interface IndividualContactFormData {
  last_name: string;
  first_name: string;
  last_name_kana: string | null;
  first_name_kana: string | null;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  postal_code: string | null;
  prefecture: string | null;
  city: string | null;
  street: string | null;
  building: string | null;
  notes: string | null;
}

// ============================================
// 個人顧客追加モーダル
// ============================================
interface AddIndividualModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (contactId: string) => void;
  createIndividualContact: (data: IndividualContactFormData) => Promise<{ error?: string; contactId?: string }>;
}

export function AddIndividualModal({
  open,
  onOpenChange,
  onSaved,
  createIndividualContact,
}: AddIndividualModalProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<IndividualContactFormData>({
    last_name: "",
    first_name: "",
    last_name_kana: null,
    first_name_kana: null,
    birth_date: null,
    phone: null,
    email: null,
    postal_code: null,
    prefecture: null,
    city: null,
    street: null,
    building: null,
    notes: null,
  });

  const resetForm = () => {
    setFormData({
      last_name: "",
      first_name: "",
      last_name_kana: null,
      first_name_kana: null,
      birth_date: null,
      phone: null,
      email: null,
      postal_code: null,
      prefecture: null,
      city: null,
      street: null,
      building: null,
      notes: null,
    });
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!formData.last_name.trim() || !formData.first_name.trim()) {
      setError("姓と名は必須です");
      return;
    }

    startTransition(async () => {
      const result = await createIndividualContact(formData);
      if (result.error) {
        setError(result.error);
      } else if (result.contactId) {
        onSaved(result.contactId);
        handleClose();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>新規個人登録</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* 基本情報 */}
          <div className="space-y-4">
            <h3 className="font-medium border-b pb-2">基本情報</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="ind_last_name">姓 *</Label>
                <Input
                  id="ind_last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="山本"
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="ind_first_name">名 *</Label>
                <Input
                  id="ind_first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="四郎"
                />
              </div>
              <div>
                <Label htmlFor="ind_last_name_kana">姓（カナ）</Label>
                <Input
                  id="ind_last_name_kana"
                  value={formData.last_name_kana || ""}
                  onChange={(e) => setFormData({ ...formData, last_name_kana: e.target.value || null })}
                  placeholder="ヤマモト"
                />
              </div>
              <div>
                <Label htmlFor="ind_first_name_kana">名（カナ）</Label>
                <Input
                  id="ind_first_name_kana"
                  value={formData.first_name_kana || ""}
                  onChange={(e) => setFormData({ ...formData, first_name_kana: e.target.value || null })}
                  placeholder="シロウ"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="ind_birth_date">生年月日</Label>
                <Input
                  id="ind_birth_date"
                  type="date"
                  value={formData.birth_date || ""}
                  onChange={(e) => setFormData({ ...formData, birth_date: e.target.value || null })}
                />
              </div>
              <div>
                <Label htmlFor="ind_phone">電話番号</Label>
                <Input
                  id="ind_phone"
                  value={formData.phone || ""}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value || null })}
                  placeholder="090-1234-5678"
                />
              </div>
              <div>
                <Label htmlFor="ind_email">メールアドレス</Label>
                <Input
                  id="ind_email"
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value || null })}
                  placeholder="yamamoto@example.com"
                />
              </div>
            </div>
          </div>

          {/* 住所 */}
          <div className="space-y-4">
            <h3 className="font-medium border-b pb-2">住所</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="ind_postal_code">郵便番号</Label>
                <Input
                  id="ind_postal_code"
                  value={formData.postal_code || ""}
                  onChange={(e) => setFormData({ ...formData, postal_code: e.target.value || null })}
                  placeholder="093-0000"
                />
              </div>
              <div>
                <Label htmlFor="ind_prefecture">都道府県</Label>
                <Input
                  id="ind_prefecture"
                  value={formData.prefecture || ""}
                  onChange={(e) => setFormData({ ...formData, prefecture: e.target.value || null })}
                  placeholder="北海道"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="ind_city">市区町村</Label>
                <Input
                  id="ind_city"
                  value={formData.city || ""}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value || null })}
                  placeholder="網走市"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ind_street">町名・番地</Label>
                <Input
                  id="ind_street"
                  value={formData.street || ""}
                  onChange={(e) => setFormData({ ...formData, street: e.target.value || null })}
                  placeholder="xxx町1-2-3"
                />
              </div>
              <div>
                <Label htmlFor="ind_building">建物名・部屋番号</Label>
                <Input
                  id="ind_building"
                  value={formData.building || ""}
                  onChange={(e) => setFormData({ ...formData, building: e.target.value || null })}
                  placeholder="○○マンション101"
                />
              </div>
            </div>
          </div>

          {/* 備考 */}
          <div className="space-y-4">
            <h3 className="font-medium border-b pb-2">備考</h3>
            <textarea
              id="ind_notes"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="備考・メモ"
              value={formData.notes || ""}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value || null })}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            登録する
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// 法人顧客追加モーダル
// ============================================
interface AddAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (contactId: string, accountId: string) => void;
  industries: Industry[];
  createAccount: (
    data: AccountFormData,
    contacts: ContactFormData[],
    branches: BranchFormData[]
  ) => Promise<{ error?: string; accountId?: string; primaryContactId?: string }>;
}

export function AddAccountModal({
  open,
  onOpenChange,
  onSaved,
  industries,
  createAccount,
}: AddAccountModalProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [estimatingPostalCode, setEstimatingPostalCode] = useState(false);
  const [industry, setIndustry] = useState<string>("");

  const [accountData, setAccountData] = useState<AccountFormData>({
    company_name: "",
    company_name_kana: null,
    corporate_number: null,
    main_phone: null,
    fax: null,
    postal_code: null,
    prefecture: null,
    city: null,
    street: null,
    building: null,
    industry: null,
    notes: null,
  });

  const [contacts, setContacts] = useState<ContactFormData[]>([
    {
      last_name: "",
      first_name: "",
      last_name_kana: null,
      first_name_kana: null,
      phone: null,
      email: null,
      department: null,
      position: null,
      is_primary: true,
      branch_id: null,
    },
  ]);

  const [branches, setBranches] = useState<BranchFormData[]>([]);

  const resetForm = () => {
    setAccountData({
      company_name: "",
      company_name_kana: null,
      corporate_number: null,
      main_phone: null,
      fax: null,
      postal_code: null,
      prefecture: null,
      city: null,
      street: null,
      building: null,
      industry: null,
      notes: null,
    });
    setContacts([
      {
        last_name: "",
        first_name: "",
        last_name_kana: null,
        first_name_kana: null,
        phone: null,
        email: null,
        department: null,
        position: null,
        is_primary: true,
        branch_id: null,
      },
    ]);
    setBranches([]);
    setIndustry("");
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
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
        is_primary: false,
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

  // 支店の追加
  const addBranch = () => {
    setBranches([
      ...branches,
      {
        id: `temp-${Date.now()}`,
        name: "",
        phone: null,
        fax: null,
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

  // 住所から郵便番号を推定
  const handleEstimatePostalCode = async () => {
    if (!accountData.prefecture || !accountData.city) {
      setError("都道府県と市区町村を入力してください");
      return;
    }

    setEstimatingPostalCode(true);
    setError(null);

    try {
      const result = await estimatePostalCode(
        accountData.prefecture,
        accountData.city,
        accountData.street || "",
        accountData.company_name
      );
      if (result.postalCode) {
        const formatted = result.postalCode.slice(0, 3) + "-" + result.postalCode.slice(3);
        setAccountData({ ...accountData, postal_code: formatted });
      } else {
        setError(result.error || "郵便番号を特定できませんでした");
      }
    } catch {
      setError("郵便番号の推定に失敗しました");
    } finally {
      setEstimatingPostalCode(false);
    }
  };

  const handleSubmit = async () => {
    if (!accountData.company_name.trim()) {
      setError("会社名は必須です");
      return;
    }

    const validContacts = contacts.filter(
      (c) => c.last_name.trim() !== "" || c.first_name.trim() !== ""
    );
    const validBranches = branches.filter((b) => b.name.trim() !== "");

    startTransition(async () => {
      const dataWithIndustry = { ...accountData, industry: industry || null };
      const result = await createAccount(dataWithIndustry, validContacts, validBranches);
      if (result.error) {
        setError(result.error);
      } else if (result.primaryContactId && result.accountId) {
        onSaved(result.primaryContactId, result.accountId);
        handleClose();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>新規法人登録</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* 法人情報 */}
          <div className="space-y-4">
            <h3 className="font-medium border-b pb-2">法人情報</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="acc_company_name">会社名 *</Label>
                <Input
                  id="acc_company_name"
                  value={accountData.company_name}
                  onChange={(e) => setAccountData({ ...accountData, company_name: e.target.value })}
                  placeholder="例: 株式会社ABC建設"
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="acc_company_name_kana">会社名（カナ）</Label>
                <Input
                  id="acc_company_name_kana"
                  value={accountData.company_name_kana || ""}
                  onChange={(e) => setAccountData({ ...accountData, company_name_kana: e.target.value || null })}
                  onBlur={(e) => {
                    const stripped = stripCorporateTitleKana(e.target.value);
                    setAccountData({ ...accountData, company_name_kana: stripped || null });
                  }}
                  placeholder="例: エービーシーケンセツ"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  ※ 法人格（カブシキガイシャ等）は除いて入力してください
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="acc_corporate_number">法人番号（13桁）</Label>
                <Input
                  id="acc_corporate_number"
                  value={accountData.corporate_number || ""}
                  onChange={(e) => setAccountData({ ...accountData, corporate_number: e.target.value || null })}
                  placeholder="例: 1234567890123"
                  maxLength={13}
                />
              </div>
              <div>
                <Label>業種</Label>
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger>
                    <SelectValue placeholder="選択してください" />
                  </SelectTrigger>
                  <SelectContent>
                    {industries.map((ind) => (
                      <SelectItem key={ind.id} value={ind.name}>
                        {ind.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="acc_main_phone">代表電話番号</Label>
                <Input
                  id="acc_main_phone"
                  value={accountData.main_phone || ""}
                  onChange={(e) => setAccountData({ ...accountData, main_phone: e.target.value || null })}
                  placeholder="例: 011-1234-5678"
                />
              </div>
              <div>
                <Label htmlFor="acc_fax">FAX番号</Label>
                <Input
                  id="acc_fax"
                  value={accountData.fax || ""}
                  onChange={(e) => setAccountData({ ...accountData, fax: e.target.value || null })}
                  placeholder="例: 011-1234-5679"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="acc_postal_code">郵便番号</Label>
                <div className="flex gap-2">
                  <Input
                    id="acc_postal_code"
                    value={accountData.postal_code || ""}
                    onChange={(e) => setAccountData({ ...accountData, postal_code: e.target.value || null })}
                    placeholder="060-0001"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleEstimatePostalCode}
                    disabled={estimatingPostalCode}
                    title="住所から郵便番号を検索"
                  >
                    {estimatingPostalCode ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="acc_prefecture">都道府県</Label>
                <Input
                  id="acc_prefecture"
                  value={accountData.prefecture || ""}
                  onChange={(e) => setAccountData({ ...accountData, prefecture: e.target.value || null })}
                  placeholder="北海道"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="acc_city">市区町村</Label>
                <Input
                  id="acc_city"
                  value={accountData.city || ""}
                  onChange={(e) => setAccountData({ ...accountData, city: e.target.value || null })}
                  placeholder="札幌市中央区"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="acc_street">町名・番地</Label>
                <Input
                  id="acc_street"
                  value={accountData.street || ""}
                  onChange={(e) => setAccountData({ ...accountData, street: e.target.value || null })}
                  placeholder="大通1-1"
                />
              </div>
              <div>
                <Label htmlFor="acc_building">建物名・部屋番号</Label>
                <Input
                  id="acc_building"
                  value={accountData.building || ""}
                  onChange={(e) => setAccountData({ ...accountData, building: e.target.value || null })}
                  placeholder="○○ビル3F"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="acc_notes">備考</Label>
              <textarea
                id="acc_notes"
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="備考・メモ"
                value={accountData.notes || ""}
                onChange={(e) => setAccountData({ ...accountData, notes: e.target.value || null })}
              />
            </div>
          </div>

          {/* 支店セクション */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-medium">支店</h3>
              <Button type="button" variant="outline" size="sm" onClick={addBranch}>
                <Plus className="h-4 w-4 mr-1" />
                支店を追加
              </Button>
            </div>
            {branches.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-2">
                支店がありません
              </p>
            ) : (
              branches.map((branch, index) => (
                <div
                  key={branch.id || index}
                  className="border rounded-lg p-4 space-y-3 relative"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {branch.name || "（支店名未入力）"}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeBranch(index)}
                      className="text-destructive hover:text-destructive h-6 w-6 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">支店名 *</Label>
                      <Input
                        placeholder="例: 札幌支店"
                        value={branch.name}
                        onChange={(e) => updateBranch(index, "name", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">電話番号</Label>
                      <Input
                        placeholder="例: 011-9999-8888"
                        value={branch.phone || ""}
                        onChange={(e) => updateBranch(index, "phone", e.target.value || null)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">FAX番号</Label>
                      <Input
                        placeholder="例: 011-9999-8889"
                        value={branch.fax || ""}
                        onChange={(e) => updateBranch(index, "fax", e.target.value || null)}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 担当者セクション */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-medium">担当者</h3>
              <Button type="button" variant="outline" size="sm" onClick={addContact}>
                <Plus className="h-4 w-4 mr-1" />
                担当者を追加
              </Button>
            </div>
            {contacts.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-2">
                担当者がありません
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
                        title={contact.is_primary ? "主要担当者" : "主要担当者に設定"}
                      >
                        <Star
                          className="h-4 w-4"
                          fill={contact.is_primary ? "currentColor" : "none"}
                        />
                      </button>
                      {contact.is_primary && (
                        <span className="text-xs text-yellow-600 font-medium">
                          主要担当者
                        </span>
                      )}
                    </div>
                    {contacts.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeContact(index)}
                        className="text-destructive hover:text-destructive h-6 w-6 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs">姓</Label>
                      <Input
                        placeholder="田中"
                        value={contact.last_name}
                        onChange={(e) => updateContact(index, "last_name", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">名</Label>
                      <Input
                        placeholder="次郎"
                        value={contact.first_name}
                        onChange={(e) => updateContact(index, "first_name", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">姓（カナ）</Label>
                      <Input
                        placeholder="タナカ"
                        value={contact.last_name_kana || ""}
                        onChange={(e) => updateContact(index, "last_name_kana", e.target.value || null)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">名（カナ）</Label>
                      <Input
                        placeholder="ジロウ"
                        value={contact.first_name_kana || ""}
                        onChange={(e) => updateContact(index, "first_name_kana", e.target.value || null)}
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
                          <SelectValue placeholder="本社" />
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
                        onChange={(e) => updateContact(index, "department", e.target.value || null)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">役職</Label>
                      <Input
                        placeholder="部長"
                        value={contact.position || ""}
                        onChange={(e) => updateContact(index, "position", e.target.value || null)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">電話番号</Label>
                      <Input
                        placeholder="090-1234-5678"
                        value={contact.phone || ""}
                        onChange={(e) => updateContact(index, "phone", e.target.value || null)}
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
                        onChange={(e) => updateContact(index, "email", e.target.value || null)}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            登録する
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
