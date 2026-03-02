"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Plus,
  Trash2,
  Search,
  X,
  Building2,
  User,
  ChevronLeft,
  ChevronRight,
  FileText,
  Download,
  Loader2,
} from "lucide-react";
import {
  type StakeholderTag,
  type ProjectStakeholderWithDetails,
  type DocumentTemplate,
  type Employee,
  getContactFullName,
  DEFAULT_CATEGORY_COLORS,
} from "@/types/database";
import type { CustomerData, AccountOption } from "./project-info";
import {
  addProjectStakeholder,
  removeProjectStakeholder,
  updateProjectStakeholderTag,
  createStakeholderTag,
  createIndividualContact,
  createCorporateContact,
} from "./actions";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { createClient } from "@/lib/supabase/client";
import { generateDocument } from "@/app/customers/document-actions";

interface StakeholderSectionProps {
  projectId: string;
  stakeholders: ProjectStakeholderWithDetails[];
  tags: StakeholderTag[];
  customerData: CustomerData;
  documentTemplates: DocumentTemplate[];
  employees: Employee[];
  currentEmployeeId: string | null;
}

export function StakeholderSection({
  projectId,
  stakeholders,
  tags,
  customerData,
  documentTemplates,
  employees,
  currentEmployeeId,
}: StakeholderSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);

  // 文書作成ダイアログ
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [selectedStakeholder, setSelectedStakeholder] = useState<ProjectStakeholderWithDetails | null>(null);

  const handleOpenDocumentDialog = (stakeholder: ProjectStakeholderWithDetails) => {
    setSelectedStakeholder(stakeholder);
    setShowDocumentModal(true);
  };

  const handleRemove = (stakeholderId: string) => {
    startTransition(async () => {
      const result = await removeProjectStakeholder(stakeholderId, projectId);
      if (result.error) {
        alert(result.error);
      }
      router.refresh();
    });
  };

  const handleTagChange = (stakeholderId: string, newTagId: string) => {
    startTransition(async () => {
      const result = await updateProjectStakeholderTag(stakeholderId, newTagId, projectId);
      if (result.error) {
        alert(result.error);
      }
      setEditingTagId(null);
      router.refresh();
    });
  };

  return (
    <Card className={isPending ? "opacity-50" : ""}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5" />
          関係者
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddModal(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          追加
        </Button>
      </CardHeader>
      <CardContent>
        {stakeholders.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            関係者が登録されていません
          </p>
        ) : (
          <div className="space-y-2">
            {stakeholders.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 group"
              >
                {/* タグバッジ（クリックで変更） */}
                {editingTagId === s.id ? (
                  <Select
                    value={s.tag_id}
                    onValueChange={(val) => handleTagChange(s.id, val)}
                  >
                    <SelectTrigger className="w-24 h-7">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {tags.map((tag) => (
                        <SelectItem key={tag.id} value={tag.id}>
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${tag.color}`} />
                            {tag.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge
                    className={`${s.tag.color} text-white cursor-pointer shrink-0`}
                    onClick={() => setEditingTagId(s.id)}
                  >
                    {s.tag.name}
                  </Badge>
                )}

                {/* 名前 */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {s.account ? (
                      <>
                        <span className="text-muted-foreground">{s.account.company_name}</span>
                        {" "}
                        {getContactFullName(s.contact)}
                      </>
                    ) : (
                      getContactFullName(s.contact)
                    )}
                  </div>
                  {s.note && (
                    <div className="text-xs text-muted-foreground truncate">
                      {s.note}
                    </div>
                  )}
                </div>

                {/* 文書作成ボタン */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 shrink-0"
                  onClick={() => handleOpenDocumentDialog(s)}
                  title="文書作成"
                >
                  <FileText className="h-4 w-4 text-primary" />
                </Button>

                {/* 削除ボタン */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 shrink-0"
                  onClick={() => handleRemove(s.id)}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* 追加モーダル */}
      <AddStakeholderModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        projectId={projectId}
        tags={tags}
        customerData={customerData}
      />

      {/* 文書作成ダイアログ */}
      {selectedStakeholder && (
        <DocumentGenerateDialog
          open={showDocumentModal}
          onOpenChange={(open) => {
            setShowDocumentModal(open);
            if (!open) setSelectedStakeholder(null);
          }}
          stakeholder={selectedStakeholder}
          templates={documentTemplates}
          employees={employees}
          currentEmployeeId={currentEmployeeId}
        />
      )}
    </Card>
  );
}

// ============================================
// 関係者追加モーダル
// ============================================

type AddStep = "contact" | "accountContacts" | "newType" | "newIndividual" | "newCorporate" | "tag";

function AddStakeholderModal({
  open,
  onOpenChange,
  projectId,
  tags,
  customerData,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  tags: StakeholderTag[];
  customerData: CustomerData;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<AddStep>("contact");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<AccountOption | null>(null);

  // 新規タグ作成
  const [showNewTag, setShowNewTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("bg-gray-500");

  // 新規個人フォーム
  const [individualForm, setIndividualForm] = useState({
    last_name: "",
    first_name: "",
    last_name_kana: "",
    first_name_kana: "",
    phone: "",
    email: "",
  });

  // 新規法人フォーム
  const [corporateForm, setCorporateForm] = useState({
    company_name: "",
    company_name_kana: "",
    main_phone: "",
    contact_last_name: "",
    contact_first_name: "",
    contact_phone: "",
    contact_email: "",
  });

  const reset = () => {
    setStep("contact");
    setSelectedContactId(null);
    setSearchQuery("");
    setSelectedAccount(null);
    setShowNewTag(false);
    setNewTagName("");
    setNewTagColor("bg-gray-500");
    setIndividualForm({
      last_name: "",
      first_name: "",
      last_name_kana: "",
      first_name_kana: "",
      phone: "",
      email: "",
    });
    setCorporateForm({
      company_name: "",
      company_name_kana: "",
      main_phone: "",
      contact_last_name: "",
      contact_first_name: "",
      contact_phone: "",
      contact_email: "",
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    reset();
  };

  const handleBack = () => {
    if (step === "accountContacts") {
      setSelectedAccount(null);
      setStep("contact");
    } else if (step === "newType") {
      setStep("contact");
    } else if (step === "newIndividual" || step === "newCorporate") {
      setStep("newType");
    } else if (step === "tag") {
      setStep("contact");
      setSelectedContactId(null);
    }
  };

  // 連絡先選択
  const handleContactSelect = (contactId: string) => {
    setSelectedContactId(contactId);
    setStep("tag");
    setSearchQuery("");
    setSelectedAccount(null);
  };

  // タグ選択 → 追加実行
  const handleTagSelect = (tagId: string) => {
    if (!selectedContactId) return;

    startTransition(async () => {
      const result = await addProjectStakeholder(projectId, selectedContactId, tagId);
      if (result.error) {
        alert(result.error);
      } else {
        handleClose();
        router.refresh();
      }
    });
  };

  // 新規タグ作成 → 追加実行
  const handleCreateTagAndAdd = () => {
    if (!selectedContactId || !newTagName.trim()) return;

    startTransition(async () => {
      const tagResult = await createStakeholderTag(newTagName.trim(), newTagColor);
      if (tagResult.error) {
        alert(tagResult.error);
        return;
      }
      if (tagResult.id) {
        const result = await addProjectStakeholder(projectId, selectedContactId, tagResult.id);
        if (result.error) {
          alert(result.error);
        } else {
          handleClose();
          router.refresh();
        }
      }
    });
  };

  // 新規個人を作成 → タグ選択へ
  const handleCreateIndividual = () => {
    if (!individualForm.last_name || !individualForm.first_name) return;

    startTransition(async () => {
      const result = await createIndividualContact({
        last_name: individualForm.last_name,
        first_name: individualForm.first_name,
        last_name_kana: individualForm.last_name_kana || null,
        first_name_kana: individualForm.first_name_kana || null,
        phone: individualForm.phone || null,
        email: individualForm.email || null,
      });

      if (result.error) {
        alert(result.error);
        return;
      }

      if (result.contactId) {
        setSelectedContactId(result.contactId);
        setStep("tag");
        router.refresh();
      }
    });
  };

  // 新規法人を作成 → タグ選択へ
  const handleCreateCorporate = () => {
    if (!corporateForm.company_name || !corporateForm.contact_last_name || !corporateForm.contact_first_name) return;

    startTransition(async () => {
      const result = await createCorporateContact({
        company_name: corporateForm.company_name,
        company_name_kana: corporateForm.company_name_kana || null,
        main_phone: corporateForm.main_phone || null,
        contact_last_name: corporateForm.contact_last_name,
        contact_first_name: corporateForm.contact_first_name,
        contact_phone: corporateForm.contact_phone || null,
        contact_email: corporateForm.contact_email || null,
      });

      if (result.error) {
        alert(result.error);
        return;
      }

      if (result.contactId) {
        setSelectedContactId(result.contactId);
        setStep("tag");
        router.refresh();
      }
    });
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

  // 法人内の担当者をフィルタリング
  const filteredContactsInAccount = useMemo(() => {
    if (!selectedAccount) return [];
    const query = searchQuery.toLowerCase();
    return selectedAccount.contacts.filter((c) =>
      c.name.toLowerCase().includes(query)
    );
  }, [selectedAccount, searchQuery]);

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
            新規顧客を追加
          </div>
        );
      case "newIndividual":
        return (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleBack} className="h-8 w-8 p-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            個人を追加
          </div>
        );
      case "newCorporate":
        return (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleBack} className="h-8 w-8 p-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            法人を追加
          </div>
        );
      case "tag":
        return showNewTag ? (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowNewTag(false)} className="h-8 w-8 p-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            新しいタグを作成
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleBack} className="h-8 w-8 p-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            タグを選択
          </div>
        );
      default:
        return "関係者を選択";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={`max-w-md max-h-[80vh] flex flex-col ${isPending ? "opacity-50" : ""}`}>
        <DialogHeader>
          <DialogTitle>
            {getTitle()}
          </DialogTitle>
        </DialogHeader>

        {step === "contact" && (
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

            {/* 連絡先リスト */}
            <div className="flex-1 overflow-y-auto space-y-4 mt-4">
              {/* 新規追加ボタン */}
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => setStep("newType")}
              >
                <Plus className="h-4 w-4" />
                新規顧客を追加
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
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => handleContactSelect(contact.id)}
                      >
                        {contact.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {filteredAccounts.length === 0 && filteredIndividuals.length === 0 && searchQuery && (
                <div className="text-center text-muted-foreground py-4">
                  該当する顧客がありません
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
              {filteredContactsInAccount.length > 0 ? (
                filteredContactsInAccount.map((contact) => (
                  <Button
                    key={contact.id}
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => handleContactSelect(contact.id)}
                  >
                    {contact.name}
                  </Button>
                ))
              ) : (
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
              onClick={() => setStep("newIndividual")}
            >
              <User className="h-5 w-5" />
              <div className="text-left">
                <div className="font-medium">個人</div>
                <div className="text-xs text-muted-foreground">個人を追加</div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-4"
              onClick={() => setStep("newCorporate")}
            >
              <Building2 className="h-5 w-5" />
              <div className="text-left">
                <div className="font-medium">法人</div>
                <div className="text-xs text-muted-foreground">法人と担当者を追加</div>
              </div>
            </Button>
          </div>
        )}

        {step === "newIndividual" && (
          <div className="flex-1 overflow-y-auto space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="sh_ind_last_name">姓 *</Label>
                <Input
                  id="sh_ind_last_name"
                  value={individualForm.last_name}
                  onChange={(e) => setIndividualForm({ ...individualForm, last_name: e.target.value })}
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="sh_ind_first_name">名 *</Label>
                <Input
                  id="sh_ind_first_name"
                  value={individualForm.first_name}
                  onChange={(e) => setIndividualForm({ ...individualForm, first_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="sh_ind_last_name_kana">姓（カナ）</Label>
                <Input
                  id="sh_ind_last_name_kana"
                  value={individualForm.last_name_kana}
                  onChange={(e) => setIndividualForm({ ...individualForm, last_name_kana: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="sh_ind_first_name_kana">名（カナ）</Label>
                <Input
                  id="sh_ind_first_name_kana"
                  value={individualForm.first_name_kana}
                  onChange={(e) => setIndividualForm({ ...individualForm, first_name_kana: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="sh_ind_phone">電話番号</Label>
                <Input
                  id="sh_ind_phone"
                  value={individualForm.phone}
                  onChange={(e) => setIndividualForm({ ...individualForm, phone: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="sh_ind_email">メールアドレス</Label>
                <Input
                  id="sh_ind_email"
                  type="email"
                  value={individualForm.email}
                  onChange={(e) => setIndividualForm({ ...individualForm, email: e.target.value })}
                />
              </div>
            </div>
            <Button
              className="w-full"
              disabled={!individualForm.last_name || !individualForm.first_name || isPending}
              onClick={handleCreateIndividual}
            >
              追加してタグを選択
            </Button>
          </div>
        )}

        {step === "newCorporate" && (
          <div className="flex-1 overflow-y-auto space-y-4 mt-4">
            <div className="space-y-3">
              <h4 className="text-sm font-medium border-b pb-1">法人情報</h4>
              <div>
                <Label htmlFor="sh_corp_name">法人名 *</Label>
                <Input
                  id="sh_corp_name"
                  value={corporateForm.company_name}
                  onChange={(e) => setCorporateForm({ ...corporateForm, company_name: e.target.value })}
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="sh_corp_name_kana">フリガナ</Label>
                <Input
                  id="sh_corp_name_kana"
                  value={corporateForm.company_name_kana}
                  onChange={(e) => setCorporateForm({ ...corporateForm, company_name_kana: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="sh_corp_phone">代表電話</Label>
                <Input
                  id="sh_corp_phone"
                  value={corporateForm.main_phone}
                  onChange={(e) => setCorporateForm({ ...corporateForm, main_phone: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-medium border-b pb-1">担当者情報</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="sh_corp_contact_last_name">姓 *</Label>
                  <Input
                    id="sh_corp_contact_last_name"
                    value={corporateForm.contact_last_name}
                    onChange={(e) => setCorporateForm({ ...corporateForm, contact_last_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="sh_corp_contact_first_name">名 *</Label>
                  <Input
                    id="sh_corp_contact_first_name"
                    value={corporateForm.contact_first_name}
                    onChange={(e) => setCorporateForm({ ...corporateForm, contact_first_name: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="sh_corp_contact_phone">電話番号</Label>
                <Input
                  id="sh_corp_contact_phone"
                  value={corporateForm.contact_phone}
                  onChange={(e) => setCorporateForm({ ...corporateForm, contact_phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="sh_corp_contact_email">メールアドレス</Label>
                <Input
                  id="sh_corp_contact_email"
                  type="email"
                  value={corporateForm.contact_email}
                  onChange={(e) => setCorporateForm({ ...corporateForm, contact_email: e.target.value })}
                />
              </div>
            </div>

            <Button
              className="w-full"
              disabled={!corporateForm.company_name || !corporateForm.contact_last_name || !corporateForm.contact_first_name || isPending}
              onClick={handleCreateCorporate}
            >
              追加してタグを選択
            </Button>
          </div>
        )}

        {step === "tag" && (
          showNewTag ? (
            /* 新規タグ作成フォーム */
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium">タグ名</label>
                <Input
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="タグ名を入力"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium">色</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {DEFAULT_CATEGORY_COLORS.slice(0, 12).map((color) => (
                    <button
                      key={color}
                      className={`w-8 h-8 rounded-full ${color} ${
                        newTagColor === color ? "ring-2 ring-offset-2 ring-black" : ""
                      }`}
                      onClick={() => setNewTagColor(color)}
                    />
                  ))}
                </div>
              </div>
              <Button
                className="w-full"
                disabled={!newTagName.trim() || isPending}
                onClick={handleCreateTagAndAdd}
              >
                タグを作成して追加
              </Button>
            </div>
          ) : (
            /* タグ選択 */
            <div className="flex-1 overflow-y-auto space-y-2 mt-4">
              {tags.map((tag) => (
                <Button
                  key={tag.id}
                  variant="ghost"
                  className="w-full justify-start gap-2"
                  onClick={() => handleTagSelect(tag.id)}
                  disabled={isPending}
                >
                  <span className={`w-3 h-3 rounded-full ${tag.color} shrink-0`} />
                  {tag.name}
                </Button>
              ))}
              <hr className="my-2" />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowNewTag(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                新しいタグを作成
              </Button>
            </div>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// 文書作成ダイアログ
// ============================================

function DocumentGenerateDialog({
  open,
  onOpenChange,
  stakeholder,
  templates,
  employees,
  currentEmployeeId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stakeholder: ProjectStakeholderWithDetails;
  templates: DocumentTemplate[];
  employees: Employee[];
  currentEmployeeId: string | null;
}) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedSenderId, setSelectedSenderId] = useState<string>(currentEmployeeId || "");
  const [useToday, setUseToday] = useState(true);
  const [documentDate, setDocumentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 差出人リスト（ログインユーザーを先頭に）
  const sortedEmployees = useMemo(() => {
    return [...employees].sort((a, b) => {
      if (a.id === currentEmployeeId) return -1;
      if (b.id === currentEmployeeId) return 1;
      return 0;
    });
  }, [employees, currentEmployeeId]);

  const reset = () => {
    setSelectedTemplateId("");
    setSelectedSenderId(currentEmployeeId || "");
    setUseToday(true);
    setDocumentDate(format(new Date(), "yyyy-MM-dd"));
    setError(null);
  };

  const handleClose = () => {
    onOpenChange(false);
    reset();
  };

  // 生成処理
  const handleGenerate = async () => {
    if (!selectedTemplateId || !selectedSenderId) {
      setError("テンプレートと差出人を選択してください");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // 宛先タイプを判定（法人に所属していればaccount、なければcontact）
      const recipientType = stakeholder.account ? "account" : "contact";
      const recipientId = stakeholder.account
        ? stakeholder.account.id
        : stakeholder.contact.id;
      const contactId = stakeholder.account ? stakeholder.contact.id : undefined;

      // Server Actionでプレースホルダー値を取得
      const result = await generateDocument({
        templateId: selectedTemplateId,
        recipientType,
        recipientId,
        contactId,
        senderId: selectedSenderId,
        documentDate: useToday ? format(new Date(), "yyyy-MM-dd") : documentDate,
      });

      if (!result.success || !result.data) {
        setError(result.error || "生成に失敗しました");
        return;
      }

      const { templateFileName, storagePath, placeholderValues } = JSON.parse(result.data);

      // テンプレートファイルを取得
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

      // docxtemplaterで置換
      const zip = new PizZip(templateArrayBuffer);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: "{{", end: "}}" },
      });
      doc.render(placeholderValues);

      // 生成されたファイルをダウンロード
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

      handleClose();
    } catch (err) {
      console.error("Document generation error:", err);
      setError("文書生成中にエラーが発生しました");
    } finally {
      setIsGenerating(false);
    }
  };

  const contactName = stakeholder.account
    ? `${stakeholder.account.company_name} ${getContactFullName(stakeholder.contact)}`
    : getContactFullName(stakeholder.contact);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            文書作成
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 宛先表示 */}
          <div className="space-y-1">
            <Label>宛先</Label>
            <div className="text-sm p-2 bg-muted rounded-md">
              {contactName}
            </div>
          </div>

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
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
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

          {/* エラー表示 */}
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            キャンセル
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !selectedTemplateId || !selectedSenderId}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                文書を生成
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
