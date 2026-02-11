"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  MapPin,
  User,
  Calendar,
  CircleDollarSign,
  Building2,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Trash2,
  AlertTriangle,
  PauseCircle,
  Plus,
  Clock,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  PROJECT_CATEGORY_LABELS,
  PROJECT_STATUS_COLORS,
  PROJECT_AREA_GROUPS,
  type AreaGroup,
  type ProjectStatus,
  type Project,
  type Contact,
  type Account,
  type Employee,
} from "@/types/database";
import { updateProject, deleteProject, createComment, updateContact, updateAccount, createIndividualContact, createCorporateContact, addContactToAccount, createAccountWithContacts, type AccountFormData, type ContactFormData, type BranchFormData } from "./actions";
import { AddIndividualModal, AddAccountModal } from "@/components/customer-modal";
import type { Industry } from "@/types/database";
import { Phone, Mail, MapPin as MapPinIcon, Pencil, Printer } from "lucide-react";
import { Label } from "@/components/ui/label";

// 法人の担当者
export interface CorporateContact {
  id: string;
  name: string;
}

// 法人（担当者リスト付き）
export interface AccountOption {
  id: string;
  companyName: string;
  contacts: CorporateContact[];
}

// 個人顧客
export interface IndividualContact {
  id: string;
  name: string;
}

// 顧客データ
export interface CustomerData {
  accounts: AccountOption[];
  individuals: IndividualContact[];
}

interface ProjectInfoProps {
  project: Project;
  contact: Contact | null;
  account: Account | null;
  manager: Employee | null;
  employees: Employee[];
  customerData: CustomerData;
  currentEmployeeId: string | null;
  taskTimeTotals: {
    estimatedMinutes: number;
    actualMinutes: number;
  };
  industries: Industry[];
  stakeholderSection?: React.ReactNode;
}

const PROJECT_STATUSES: ProjectStatus[] = ["進行中", "完了"];

// 日付フォーマット
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

// 金額フォーマット
function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return "-";
  return `¥${amount.toLocaleString()}`;
}

// 時間フォーマット（分 → 小数時間）
function formatHours(minutes: number): string {
  if (minutes === 0) return "0h";
  const hours = minutes / 60;
  return `${hours.toFixed(1)}h`;
}

// 顧客選択モーダル（2段階選択 + 新規追加）
type ContactSelectStep = "list" | "accountContacts" | "newType";

export function ContactSelectModal({
  open,
  onOpenChange,
  customerData,
  currentContactId,
  onSelect,
  industries,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerData: CustomerData;
  currentContactId: string | null;
  onSelect: (contactId: string | null) => void;
  industries: Industry[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<ContactSelectStep>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<AccountOption | null>(null);

  // 新規追加モーダル
  const [showAddIndividualModal, setShowAddIndividualModal] = useState(false);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);

  const reset = () => {
    setStep("list");
    setSearchQuery("");
    setSelectedAccount(null);
  };

  // 検索フィルタリング
  const { filteredAccounts, filteredIndividuals } = useMemo(() => {
    const query = searchQuery.toLowerCase();

    const filteredAccounts = customerData.accounts.filter((acc) => {
      const matchesCompany = acc.companyName.toLowerCase().includes(query);
      const matchesContact = acc.contacts.some((c) => c.name.toLowerCase().includes(query));
      return matchesCompany || matchesContact;
    });

    const filteredIndividuals = customerData.individuals.filter((ind) =>
      ind.name.toLowerCase().includes(query)
    );

    return { filteredAccounts, filteredIndividuals };
  }, [customerData, searchQuery]);

  const handleSelect = (contactId: string | null) => {
    onSelect(contactId);
    onOpenChange(false);
    reset();
  };

  const handleClose = () => {
    onOpenChange(false);
    reset();
  };

  const handleBack = () => {
    if (step === "accountContacts") {
      setSelectedAccount(null);
      setStep("list");
    } else if (step === "newType") {
      setStep("list");
    }
  };

  // 法人内の担当者をフィルタリング
  const filteredContactsInAccount = useMemo(() => {
    if (!selectedAccount) return [];
    const query = searchQuery.toLowerCase();
    return selectedAccount.contacts.filter((c) =>
      c.name.toLowerCase().includes(query)
    );
  }, [selectedAccount, searchQuery]);

  // 新規個人顧客が作成されたとき
  const handleIndividualCreated = (contactId: string, _name: string) => {
    onSelect(contactId);
    onOpenChange(false);
    reset();
    router.refresh();
  };

  // 新規法人+担当者が作成されたとき
  const handleAccountCreated = (contactId: string, _accountId: string, _companyName: string, _contactName: string) => {
    onSelect(contactId);
    onOpenChange(false);
    reset();
    router.refresh();
  };

  // タイトル
  const getTitle = () => {
    switch (step) {
      case "accountContacts":
        return (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleBack} className="h-8 w-8 p-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {selectedAccount?.companyName}の担当者
          </div>
        );
      case "newType":
        return (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleBack} className="h-8 w-8 p-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            新規依頼人を追加
          </div>
        );
      default:
        return "依頼人を選択";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={`max-w-md max-h-[80vh] flex flex-col ${isPending ? "opacity-50" : ""}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getTitle()}
          </DialogTitle>
        </DialogHeader>

        {step === "list" && (
          <>
            {/* 検索ボックス */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="名前・法人名で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* 依頼人リスト */}
            <div className="flex-1 overflow-y-auto space-y-4 mt-4">
              {/* 新規追加ボタン */}
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => setStep("newType")}
              >
                <Plus className="h-4 w-4" />
                新規依頼人を追加
              </Button>

              {/* 未選択オプション */}
              <Button
                variant={currentContactId === null ? "secondary" : "ghost"}
                className="w-full justify-start"
                onClick={() => handleSelect(null)}
              >
                <span className="text-muted-foreground">未選択</span>
              </Button>

              {/* 法人 */}
              {filteredAccounts.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    法人
                  </div>
                  <div className="space-y-1">
                    {filteredAccounts.map((account) => (
                      <Button
                        key={account.id}
                        variant="ghost"
                        className="w-full justify-between h-auto py-2"
                        onClick={() => {
                          setSelectedAccount(account);
                          setStep("accountContacts");
                          setSearchQuery("");
                        }}
                      >
                        <div className="text-left">
                          <div className="font-medium">{account.companyName}</div>
                          <div className="text-xs text-muted-foreground">
                            担当者 {account.contacts.length}名
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* 個人 */}
              {filteredIndividuals.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    個人
                  </div>
                  <div className="space-y-1">
                    {filteredIndividuals.map((contact) => (
                      <Button
                        key={contact.id}
                        variant={currentContactId === contact.id ? "secondary" : "ghost"}
                        className="w-full justify-start"
                        onClick={() => handleSelect(contact.id)}
                      >
                        {contact.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {filteredAccounts.length === 0 && filteredIndividuals.length === 0 && searchQuery && (
                <div className="text-center text-muted-foreground py-4">
                  該当する依頼人がありません
                </div>
              )}
            </div>
          </>
        )}

        {step === "accountContacts" && selectedAccount && (
          <>
            {/* 検索ボックス */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="担当者名で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 mt-4">
              {/* 担当者無しオプション - 代表連絡先（is_primary）を使用 */}
              <Button
                variant="ghost"
                className="w-full justify-start text-muted-foreground"
                onClick={() => {
                  // 代表連絡先（is_primaryの連絡先、なければ最初の連絡先）を選択
                  // 「（担当者未設定）」以外の連絡先を優先
                  const normalContacts = selectedAccount.contacts.filter(c => c.name !== "（担当者未設定）");
                  if (normalContacts.length > 0) {
                    handleSelect(normalContacts[0].id);
                  } else if (selectedAccount.contacts.length > 0) {
                    // 連絡先が全て「（担当者未設定）」の場合はそれを使用
                    handleSelect(selectedAccount.contacts[0].id);
                  } else {
                    // 連絡先がない場合は未選択
                    handleSelect(null);
                  }
                }}
              >
                担当者無し
              </Button>
              {filteredContactsInAccount.length > 0 ? (
                filteredContactsInAccount
                  .filter(contact => contact.name !== "（担当者未設定）")
                  .map((contact) => (
                    <Button
                      key={contact.id}
                      variant={currentContactId === contact.id ? "secondary" : "ghost"}
                      className="w-full justify-start"
                      onClick={() => handleSelect(contact.id)}
                    >
                      {contact.name}
                    </Button>
                  ))
              ) : null}
              {filteredContactsInAccount.filter(c => c.name !== "（担当者未設定）").length === 0 && (
                <div className="text-center text-muted-foreground py-4">
                  担当者が登録されていません
                </div>
              )}
            </div>
          </>
        )}

        {step === "newType" && (
          <div className="flex-1 space-y-2 mt-4">
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-4"
              onClick={() => {
                setShowAddIndividualModal(true);
              }}
            >
              <User className="h-5 w-5" />
              <div className="text-left">
                <div className="font-medium">個人</div>
                <div className="text-xs text-muted-foreground">個人のお客様を追加</div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-4"
              onClick={() => {
                setShowAddAccountModal(true);
              }}
            >
              <Building2 className="h-5 w-5" />
              <div className="text-left">
                <div className="font-medium">法人</div>
                <div className="text-xs text-muted-foreground">法人と担当者を追加</div>
              </div>
            </Button>
          </div>
        )}
      </DialogContent>

      {/* 個人追加モーダル */}
      <AddIndividualModal
        open={showAddIndividualModal}
        onOpenChange={setShowAddIndividualModal}
        onSaved={handleIndividualCreated}
        createIndividualContact={createIndividualContact}
      />

      {/* 法人追加モーダル */}
      <AddAccountModal
        open={showAddAccountModal}
        onOpenChange={setShowAddAccountModal}
        onSaved={handleAccountCreated}
        industries={industries}
        createAccount={createAccountWithContacts}
      />
    </Dialog>
  );
}

// 顧客詳細セクションコンポーネント
function CustomerDetailSection({
  contact,
  account,
  onEditClick,
  onChangeClick,
}: {
  contact: Contact | null;
  account: Account | null;
  onEditClick: () => void;
  onChangeClick: () => void;
}) {
  if (!contact) {
    return (
      <div className="text-muted-foreground text-sm">
        依頼人が選択されていません
        <Button
          variant="link"
          size="sm"
          className="ml-2 h-auto p-0"
          onClick={onChangeClick}
        >
          依頼人を選択
        </Button>
      </div>
    );
  }

  const formatAddress = (item: Contact | Account) => {
    const parts = [
      item.postal_code ? `〒${item.postal_code}` : null,
      item.prefecture,
      item.city,
      item.street,
      item.building,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : null;
  };

  const contactAddress = formatAddress(contact);
  const accountAddress = account ? formatAddress(account) : null;

  return (
    <div className="space-y-3 text-sm">
      {/* ヘッダー：顧客名と操作ボタン */}
      <div className="flex items-center justify-between">
        <div className="font-medium">
          {account ? (
            <span>{account.company_name}</span>
          ) : (
            <span>{contact.last_name} {contact.first_name}</span>
          )}
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={onEditClick}
          >
            <Pencil className="h-3.5 w-3.5 mr-1" />
            修正
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={onChangeClick}
          >
            変更
          </Button>
        </div>
      </div>

      {/* 法人情報（法人の場合） */}
      {account && (
        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
          <div className="text-xs font-medium text-muted-foreground">法人情報</div>
          {accountAddress && (
            <div className="flex items-start gap-2">
              <MapPinIcon className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
              <span>{accountAddress}</span>
            </div>
          )}
          {(account.main_phone || account.fax) && (
            <div className="flex items-center gap-4">
              {account.main_phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{account.main_phone}</span>
                </div>
              )}
              {account.fax && (
                <div className="flex items-center gap-2">
                  <Printer className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>FAX: {account.fax}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 担当者情報（法人の場合）または個人情報 */}
      <div className="bg-muted/50 rounded-lg p-3 space-y-2">
        <div className="text-xs font-medium text-muted-foreground">
          {account ? "担当者情報" : "個人情報"}
        </div>
        {account && (
          <div className="font-medium">
            {contact.last_name} {contact.first_name}
            {contact.department && <span className="text-muted-foreground ml-2">{contact.department}</span>}
            {contact.position && <span className="text-muted-foreground ml-1">{contact.position}</span>}
          </div>
        )}
        {contact.phone && (
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{contact.phone}</span>
          </div>
        )}
        {contact.email && (
          <div className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            <a
              href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(contact.email)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {contact.email}
            </a>
          </div>
        )}
        {!account && contactAddress && (
          <div className="flex items-start gap-2">
            <MapPinIcon className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
            <span>{contactAddress}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// 顧客編集モーダル
function CustomerEditModal({
  open,
  onOpenChange,
  contact,
  account,
  onSave,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact;
  account: Account | null;
  onSave: (contactUpdates: Partial<Contact>, accountUpdates?: Partial<Account>) => void;
  isPending: boolean;
}) {
  const [contactForm, setContactForm] = useState({
    last_name: contact.last_name,
    first_name: contact.first_name,
    last_name_kana: contact.last_name_kana || "",
    first_name_kana: contact.first_name_kana || "",
    phone: contact.phone || "",
    email: contact.email || "",
    postal_code: contact.postal_code || "",
    prefecture: contact.prefecture || "",
    city: contact.city || "",
    street: contact.street || "",
    building: contact.building || "",
    department: contact.department || "",
    position: contact.position || "",
  });

  const [accountForm, setAccountForm] = useState(account ? {
    company_name: account.company_name,
    company_name_kana: account.company_name_kana || "",
    main_phone: account.main_phone || "",
    fax: account.fax || "",
    postal_code: account.postal_code || "",
    prefecture: account.prefecture || "",
    city: account.city || "",
    street: account.street || "",
    building: account.building || "",
  } : null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const contactUpdates: Partial<Contact> = {
      last_name: contactForm.last_name,
      first_name: contactForm.first_name,
      last_name_kana: contactForm.last_name_kana || null,
      first_name_kana: contactForm.first_name_kana || null,
      phone: contactForm.phone || null,
      email: contactForm.email || null,
      postal_code: contactForm.postal_code || null,
      prefecture: contactForm.prefecture || null,
      city: contactForm.city || null,
      street: contactForm.street || null,
      building: contactForm.building || null,
      department: contactForm.department || null,
      position: contactForm.position || null,
    };

    let accountUpdates: Partial<Account> | undefined;
    if (accountForm) {
      accountUpdates = {
        company_name: accountForm.company_name,
        company_name_kana: accountForm.company_name_kana || null,
        main_phone: accountForm.main_phone || null,
        fax: accountForm.fax || null,
        postal_code: accountForm.postal_code || null,
        prefecture: accountForm.prefecture || null,
        city: accountForm.city || null,
        street: accountForm.street || null,
        building: accountForm.building || null,
      };
    }

    onSave(contactUpdates, accountUpdates);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>顧客情報を編集</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 法人情報（法人の場合） */}
          {accountForm && (
            <div className="space-y-4">
              <h3 className="font-medium text-sm border-b pb-2">法人情報</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label htmlFor="company_name">法人名</Label>
                  <Input
                    id="company_name"
                    value={accountForm.company_name}
                    onChange={(e) => setAccountForm({ ...accountForm, company_name: e.target.value })}
                    required
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="company_name_kana">フリガナ</Label>
                  <Input
                    id="company_name_kana"
                    value={accountForm.company_name_kana}
                    onChange={(e) => setAccountForm({ ...accountForm, company_name_kana: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="account_phone">電話番号</Label>
                  <Input
                    id="account_phone"
                    value={accountForm.main_phone}
                    onChange={(e) => setAccountForm({ ...accountForm, main_phone: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="account_fax">FAX番号</Label>
                  <Input
                    id="account_fax"
                    value={accountForm.fax}
                    onChange={(e) => setAccountForm({ ...accountForm, fax: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="account_postal_code">郵便番号</Label>
                  <Input
                    id="account_postal_code"
                    value={accountForm.postal_code}
                    onChange={(e) => setAccountForm({ ...accountForm, postal_code: e.target.value })}
                    placeholder="000-0000"
                  />
                </div>
                <div>
                  <Label htmlFor="account_prefecture">都道府県</Label>
                  <Input
                    id="account_prefecture"
                    value={accountForm.prefecture}
                    onChange={(e) => setAccountForm({ ...accountForm, prefecture: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="account_city">市区町村</Label>
                  <Input
                    id="account_city"
                    value={accountForm.city}
                    onChange={(e) => setAccountForm({ ...accountForm, city: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="account_street">字・町名</Label>
                  <Input
                    id="account_street"
                    value={accountForm.street}
                    onChange={(e) => setAccountForm({ ...accountForm, street: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="account_building">建物名</Label>
                  <Input
                    id="account_building"
                    value={accountForm.building}
                    onChange={(e) => setAccountForm({ ...accountForm, building: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 担当者/個人情報 */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm border-b pb-2">
              {account ? "担当者情報" : "個人情報"}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="last_name">姓</Label>
                <Input
                  id="last_name"
                  value={contactForm.last_name}
                  onChange={(e) => setContactForm({ ...contactForm, last_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="first_name">名</Label>
                <Input
                  id="first_name"
                  value={contactForm.first_name}
                  onChange={(e) => setContactForm({ ...contactForm, first_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="last_name_kana">姓（カナ）</Label>
                <Input
                  id="last_name_kana"
                  value={contactForm.last_name_kana}
                  onChange={(e) => setContactForm({ ...contactForm, last_name_kana: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="first_name_kana">名（カナ）</Label>
                <Input
                  id="first_name_kana"
                  value={contactForm.first_name_kana}
                  onChange={(e) => setContactForm({ ...contactForm, first_name_kana: e.target.value })}
                />
              </div>
              {account && (
                <>
                  <div>
                    <Label htmlFor="department">部署</Label>
                    <Input
                      id="department"
                      value={contactForm.department}
                      onChange={(e) => setContactForm({ ...contactForm, department: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="position">役職</Label>
                    <Input
                      id="position"
                      value={contactForm.position}
                      onChange={(e) => setContactForm({ ...contactForm, position: e.target.value })}
                    />
                  </div>
                </>
              )}
              <div className="col-span-2">
                <Label htmlFor="contact_phone">電話番号</Label>
                <Input
                  id="contact_phone"
                  value={contactForm.phone}
                  onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="email">メールアドレス</Label>
                <Input
                  id="email"
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                />
              </div>

              {/* 個人の場合のみ住所を表示 */}
              {!account && (
                <>
                  <div>
                    <Label htmlFor="contact_postal_code">郵便番号</Label>
                    <Input
                      id="contact_postal_code"
                      value={contactForm.postal_code}
                      onChange={(e) => setContactForm({ ...contactForm, postal_code: e.target.value })}
                      placeholder="000-0000"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contact_prefecture">都道府県</Label>
                    <Input
                      id="contact_prefecture"
                      value={contactForm.prefecture}
                      onChange={(e) => setContactForm({ ...contactForm, prefecture: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="contact_city">市区町村</Label>
                    <Input
                      id="contact_city"
                      value={contactForm.city}
                      onChange={(e) => setContactForm({ ...contactForm, city: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="contact_street">字・町名</Label>
                    <Input
                      id="contact_street"
                      value={contactForm.street}
                      onChange={(e) => setContactForm({ ...contactForm, street: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="contact_building">建物名</Label>
                    <Input
                      id="contact_building"
                      value={contactForm.building}
                      onChange={(e) => setContactForm({ ...contactForm, building: e.target.value })}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              キャンセル
            </Button>
            <Button type="submit" disabled={isPending}>
              保存
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// 編集可能なタイトルコンポーネント
function EditableTitle({
  value,
  onSave,
}: {
  value: string;
  onSave: (value: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value);

  const handleSave = () => {
    if (inputValue !== value) {
      onSave(inputValue);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setInputValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <Input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        autoFocus
        className="text-2xl font-bold h-auto py-1"
      />
    );
  }

  return (
    <h1
      onClick={() => {
        setInputValue(value);
        setIsEditing(true);
      }}
      className="text-2xl font-bold cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 py-0.5"
    >
      {value}
    </h1>
  );
}

// 編集可能なフィールドコンポーネント
function EditableField({
  label,
  value,
  displayValue,
  icon: Icon,
  type = "text",
  onSave,
  options,
  optionGroups,
  placeholder,
}: {
  label: string;
  value: string;
  displayValue?: string;
  icon: React.ComponentType<{ className?: string }>;
  type?: "text" | "date" | "number" | "select";
  onSave: (value: string) => void;
  options?: { value: string; label: string }[];
  optionGroups?: { name: string; items: { value: string; label: string }[] }[];
  placeholder?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value);

  const handleSave = () => {
    if (inputValue !== value) {
      onSave(inputValue);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setInputValue(value);
      setIsEditing(false);
    }
  };

  const handleSelectChange = (val: string) => {
    const resolved = val === "none" ? "" : val;
    setInputValue(resolved);
    onSave(resolved);
    setIsEditing(false);
  };

  return (
    <div className="flex items-start gap-3">
      <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
      <div className="flex-1">
        <div className="text-sm text-muted-foreground">{label}</div>
        {isEditing ? (
          type === "select" && (options || optionGroups) ? (
            <Select
              value={inputValue || "none"}
              onValueChange={handleSelectChange}
            >
              <SelectTrigger className="h-8 mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">未選択</SelectItem>
                {optionGroups
                  ? optionGroups.map((group) => (
                      <SelectGroup key={group.name}>
                        <SelectLabel className="font-bold text-muted-foreground">
                          {group.name}
                        </SelectLabel>
                        {group.items.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))
                  : options?.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              type={type}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              autoFocus
              className="h-8 mt-1"
              placeholder={placeholder}
            />
          )
        ) : (
          <div
            onClick={() => {
              setInputValue(value);
              setIsEditing(true);
            }}
            className="cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 py-0.5"
          >
            {displayValue || value || "-"}
          </div>
        )}
      </div>
    </div>
  );
}

export function ProjectInfo({
  project,
  contact,
  account,
  manager,
  employees,
  customerData,
  currentEmployeeId,
  taskTimeTotals,
  industries,
  stakeholderSection,
}: ProjectInfoProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showContactModal, setShowContactModal] = useState(false);
  const [showCustomerEditModal, setShowCustomerEditModal] = useState(false);
  const [showOnHoldDialog, setShowOnHoldDialog] = useState(false);
  const [onHoldReason, setOnHoldReason] = useState("");

  const handleUpdate = (field: string, value: string) => {
    startTransition(async () => {
      let updateValue: string | number | boolean | null = value;

      // フィールドに応じた変換
      if (field === "fee_tax_excluded") {
        updateValue = value ? parseInt(value, 10) : null;
      } else if (field === "manager_id" && value === "none") {
        updateValue = null;
      } else if ((field === "start_date" || field === "end_date") && !value) {
        updateValue = null;
      } else if ((field === "location" || field === "location_detail") && !value) {
        updateValue = null;
      } else if (field === "is_urgent" || field === "is_on_hold") {
        updateValue = value === "true";
      }

      await updateProject(project.id, { [field]: updateValue });
      router.refresh();
    });
  };

  const handleOnHoldClick = () => {
    if (project.is_on_hold) {
      // 待機解除
      handleUpdate("is_on_hold", "false");
    } else {
      // 待機にする：ダイアログを表示
      setOnHoldReason("");
      setShowOnHoldDialog(true);
    }
  };

  const handleOnHoldConfirm = () => {
    startTransition(async () => {
      // 待機フラグをON
      await updateProject(project.id, { is_on_hold: true });
      // コメントを追加
      const commentContent = `【待機】\n理由：${onHoldReason || "（理由未入力）"}`;
      await createComment(project.id, commentContent);
      setShowOnHoldDialog(false);
      router.refresh();
    });
  };

  const handleContactChange = (contactId: string | null) => {
    startTransition(async () => {
      await updateProject(project.id, { contact_id: contactId });
      router.refresh();
    });
  };

  const handleCustomerSave = (
    contactUpdates: Partial<Contact>,
    accountUpdates?: Partial<Account>
  ) => {
    startTransition(async () => {
      if (contact) {
        await updateContact(contact.id, contactUpdates as Parameters<typeof updateContact>[1]);
      }
      if (account && accountUpdates) {
        await updateAccount(account.id, accountUpdates as Parameters<typeof updateAccount>[1]);
      }
      setShowCustomerEditModal(false);
      router.refresh();
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      await deleteProject(project.id);
      router.push("/projects");
    });
  };

  // 顧客表示名
  const customerName = contact
    ? account
      ? `${account.company_name} (${contact.last_name} ${contact.first_name})`
      : `${contact.last_name} ${contact.first_name}`
    : "-";

  return (
    <div className={`space-y-6 ${isPending ? "opacity-50" : ""}`}>
      {/* ヘッダー情報 */}
      <div>
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <span className="font-mono text-muted-foreground">{project.code}</span>
          <Badge className="bg-blue-100 text-blue-800">
            {PROJECT_CATEGORY_LABELS[project.category]}
          </Badge>
          <Select
            value={project.status}
            onValueChange={(val) => handleUpdate("status", val)}
          >
            <SelectTrigger className="w-auto h-7 px-2 border-none shadow-none">
              <Badge className={PROJECT_STATUS_COLORS[project.status]}>
                {project.status}
              </Badge>
            </SelectTrigger>
            <SelectContent>
              {PROJECT_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  <Badge className={PROJECT_STATUS_COLORS[status]}>{status}</Badge>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={project.is_urgent ? "destructive" : "outline"}
            size="sm"
            className="gap-1"
            onClick={() => handleUpdate("is_urgent", project.is_urgent ? "false" : "true")}
          >
            <AlertTriangle className="h-4 w-4" />
            緊急
          </Button>
          <Button
            variant={project.is_on_hold ? "secondary" : "outline"}
            size="sm"
            className="gap-1"
            onClick={handleOnHoldClick}
          >
            <PauseCircle className="h-4 w-4" />
            待機
          </Button>
          <div className="flex-1" />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4 mr-1" />
                削除
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>業務を削除しますか？</AlertDialogTitle>
                <AlertDialogDescription>
                  「{project.name}」を削除します。この操作は取り消せません。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  削除する
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <EditableTitle
          value={project.name}
          onSave={(val) => handleUpdate("name", val)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">基本情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <div className="text-sm text-muted-foreground mb-2">依頼人</div>
              <CustomerDetailSection
                contact={contact}
                account={account}
                onEditClick={() => setShowCustomerEditModal(true)}
                onChangeClick={() => setShowContactModal(true)}
              />
            </div>
          </div>

          {/* 関係者セクション（顧客と期間の間に配置） */}
          {stakeholderSection}

          <EditableField
            label="担当者"
            value={project.manager_id || "none"}
            displayValue={manager?.name || "-"}
            icon={User}
            type="select"
            options={employees.map((e) => ({ value: e.id, label: e.name }))}
            onSave={(val) => handleUpdate("manager_id", val)}
          />

          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <div className="text-sm text-muted-foreground">期間</div>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={project.start_date || ""}
                  onChange={(e) => handleUpdate("start_date", e.target.value)}
                  className="h-8 w-36"
                />
                <span className="text-muted-foreground">〜</span>
                <Input
                  type="date"
                  value={project.end_date || ""}
                  onChange={(e) => handleUpdate("end_date", e.target.value)}
                  className="h-8 w-36"
                />
              </div>
            </div>
          </div>

          <EditableField
            label="報酬（税抜）"
            value={project.fee_tax_excluded?.toString() || ""}
            displayValue={formatCurrency(project.fee_tax_excluded)}
            icon={CircleDollarSign}
            type="number"
            onSave={(val) => handleUpdate("fee_tax_excluded", val)}
            placeholder="金額を入力"
          />

          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <div className="text-sm text-muted-foreground">タスク時間</div>
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-xs text-muted-foreground mr-1">予定:</span>
                  <span className="font-medium">{formatHours(taskTimeTotals.estimatedMinutes)}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground mr-1">実績:</span>
                  <span className="font-medium">{formatHours(taskTimeTotals.actualMinutes)}</span>
                </div>
              </div>
            </div>
          </div>

          <EditableField
            label="所在地"
            value={project.location || ""}
            icon={MapPin}
            type="select"
            onSave={(val) => handleUpdate("location", val)}
            optionGroups={PROJECT_AREA_GROUPS.map((group) => ({
              name: group.name,
              items: group.areas.map((area) => ({ value: area, label: area })),
            }))}
          />

          <EditableField
            label="字・町名以下"
            value={project.location_detail || ""}
            icon={MapPin}
            onSave={(val) => handleUpdate("location_detail", val)}
            placeholder="字・町名以下を入力"
          />
        </CardContent>
      </Card>

      {/* 顧客選択モーダル */}
      <ContactSelectModal
        open={showContactModal}
        onOpenChange={setShowContactModal}
        customerData={customerData}
        currentContactId={project.contact_id}
        onSelect={handleContactChange}
        industries={industries}
      />

      {/* 顧客編集モーダル */}
      {contact && (
        <CustomerEditModal
          open={showCustomerEditModal}
          onOpenChange={setShowCustomerEditModal}
          contact={contact}
          account={account}
          onSave={handleCustomerSave}
          isPending={isPending}
        />
      )}

      {/* 待機理由入力ダイアログ */}
      <Dialog open={showOnHoldDialog} onOpenChange={setShowOnHoldDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>待機にする</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              待機理由をコメントとして記録します。
            </p>
            <Textarea
              placeholder="待機の理由を入力..."
              value={onHoldReason}
              onChange={(e) => setOnHoldReason(e.target.value)}
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowOnHoldDialog(false)}
              >
                キャンセル
              </Button>
              <Button onClick={handleOnHoldConfirm} disabled={isPending}>
                待機にする
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
