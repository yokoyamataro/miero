"use client";

import { useState, useTransition, useMemo } from "react";
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
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  PROJECT_CATEGORY_LABELS,
  type ProjectCategory,
  type ProjectStatus,
} from "@/types/database";
import { createProject, type CreateProjectData, type ContactOption } from "../actions";

interface Employee {
  id: string;
  name: string;
}

interface ProjectFormProps {
  contacts: ContactOption[];
  employees: Employee[];
}

export function ProjectForm({ contacts, employees }: ProjectFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<ProjectCategory | "">("");
  const [status, setStatus] = useState<ProjectStatus>("受注");
  const [contactId, setContactId] = useState<string>("");
  const [managerId, setManagerId] = useState<string>("");

  // 法人と個人に分類
  const { corporateContacts, individualContacts } = useMemo(() => ({
    corporateContacts: contacts.filter((c) => c.type === "corporate"),
    individualContacts: contacts.filter((c) => c.type === "individual"),
  }), [contacts]);

  // カテゴリ別詳細データ
  const [details, setDetails] = useState<Record<string, unknown>>({});
  const [monthlyAllocations, setMonthlyAllocations] = useState<Record<string, number>>({});

  const updateDetails = (key: string, value: unknown) => {
    setDetails((prev) => ({ ...prev, [key]: value }));
  };

  const updateMonthlyAllocation = (month: string, value: number) => {
    setMonthlyAllocations((prev) => ({ ...prev, [month]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);

    if (!category) {
      setError("カテゴリを選択してください");
      return;
    }

    const data: CreateProjectData = {
      code: formData.get("code") as string,
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
      location: (formData.get("location") as string) || null,
      details: details,
      monthly_allocations: monthlyAllocations,
    };

    startTransition(async () => {
      const result = await createProject(data);
      if (result?.error) {
        setError(result.error);
      }
    });
  };

  // カテゴリ別フィールド
  const renderCategoryFields = () => {
    switch (category) {
      case "A_Survey":
        return (
          <>
            <SurveyFields details={details} updateDetails={updateDetails} />
            <MonthlyAllocationFields
              allocations={monthlyAllocations}
              updateAllocation={updateMonthlyAllocation}
            />
          </>
        );
      case "B_Boundary":
        return <BoundaryFields details={details} updateDetails={updateDetails} />;
      case "C_Registration":
        return <RegistrationFields details={details} updateDetails={updateDetails} />;
      case "D_Inheritance":
        return <InheritanceFields details={details} updateDetails={updateDetails} />;
      case "E_Corporate":
        return <CorporateFields details={details} updateDetails={updateDetails} />;
      case "F_Drone":
        return (
          <>
            <DroneFields details={details} updateDetails={updateDetails} />
            <MonthlyAllocationFields
              allocations={monthlyAllocations}
              updateAllocation={updateMonthlyAllocation}
            />
          </>
        );
      case "N_Farmland":
        return <FarmlandFields details={details} updateDetails={updateDetails} />;
      default:
        return null;
    }
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
                <Label htmlFor="code">業務コード *</Label>
                <Input
                  id="code"
                  name="code"
                  placeholder="例: A240001"
                  required
                />
              </div>
              <div>
                <Label htmlFor="category">カテゴリ *</Label>
                <Select
                  value={category}
                  onValueChange={(val) => {
                    setCategory(val as ProjectCategory);
                    setDetails({});
                    setMonthlyAllocations({});
                  }}
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
                    <SelectItem value="受注">受注</SelectItem>
                    <SelectItem value="着手">着手</SelectItem>
                    <SelectItem value="進行中">進行中</SelectItem>
                    <SelectItem value="完了">完了</SelectItem>
                    <SelectItem value="請求済">請求済</SelectItem>
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="contact_id">顧客</Label>
                <Select value={contactId} onValueChange={setContactId}>
                  <SelectTrigger id="contact_id">
                    <SelectValue placeholder="顧客を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">未選択</SelectItem>
                    {corporateContacts.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>法人（担当者）</SelectLabel>
                        {corporateContacts.map((contact) => (
                          <SelectItem key={contact.id} value={contact.id}>
                            {contact.company_name} ({contact.name})
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                    {individualContacts.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>個人</SelectLabel>
                        {individualContacts.map((contact) => (
                          <SelectItem key={contact.id} value={contact.id}>
                            {contact.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="manager_id">担当者</Label>
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

            <div>
              <Label htmlFor="location">所在地・エリア</Label>
              <Input
                id="location"
                name="location"
                placeholder="例: 北海道網走郡美幌町"
              />
            </div>
          </CardContent>
        </Card>

        {/* カテゴリ固有フィールド */}
        {category && (
          <Card>
            <CardHeader>
              <CardTitle>{PROJECT_CATEGORY_LABELS[category]} 詳細</CardTitle>
            </CardHeader>
            <CardContent>{renderCategoryFields()}</CardContent>
          </Card>
        )}

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
    </>
  );
}

// カテゴリ別フィールドコンポーネント
interface FieldProps {
  details: Record<string, unknown>;
  updateDetails: (key: string, value: unknown) => void;
}

function SurveyFields({ details, updateDetails }: FieldProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="survey_type">業務区分</Label>
        <Input
          id="survey_type"
          placeholder="例: 工事測量、現況測量"
          value={(details.survey_type as string) || ""}
          onChange={(e) => updateDetails("survey_type", e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="jv_name">JV名</Label>
        <Input
          id="jv_name"
          placeholder="例: 野口新島三九JV"
          value={(details.jv_name as string) || ""}
          onChange={(e) => updateDetails("jv_name", e.target.value)}
        />
      </div>
    </div>
  );
}

function BoundaryFields({ details, updateDetails }: FieldProps) {
  const workflow = (details.workflow as Record<string, boolean>) || {};

  const updateWorkflow = (key: string, value: boolean) => {
    updateDetails("workflow", { ...workflow, [key]: value });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="purpose">目的</Label>
        <Input
          id="purpose"
          placeholder="例: 分筆、合筆、地積更正"
          value={(details.purpose as string) || ""}
          onChange={(e) => updateDetails("purpose", e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="referrer">紹介者</Label>
        <Input
          id="referrer"
          placeholder="例: 一条工務店"
          value={(details.referrer as string) || ""}
          onChange={(e) => updateDetails("referrer", e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="lat">緯度</Label>
          <Input
            id="lat"
            type="number"
            step="0.000001"
            placeholder="43.457"
            value={((details.coordinates as { lat?: number })?.lat as number) || ""}
            onChange={(e) =>
              updateDetails("coordinates", {
                ...((details.coordinates as object) || {}),
                lat: parseFloat(e.target.value) || 0,
              })
            }
          />
        </div>
        <div>
          <Label htmlFor="lng">経度</Label>
          <Input
            id="lng"
            type="number"
            step="0.000001"
            placeholder="144.715"
            value={((details.coordinates as { lng?: number })?.lng as number) || ""}
            onChange={(e) =>
              updateDetails("coordinates", {
                ...((details.coordinates as object) || {}),
                lng: parseFloat(e.target.value) || 0,
              })
            }
          />
        </div>
      </div>
      <div>
        <Label className="mb-2 block">進捗チェック</Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {[
            { key: "estimate", label: "見積" },
            { key: "accepted", label: "受託" },
            { key: "survey", label: "資料調査" },
            { key: "staking", label: "境界標埋設" },
            { key: "registration", label: "登記申請" },
            { key: "billing", label: "請求納品" },
          ].map((item) => (
            <label key={item.key} className="flex items-center gap-2">
              <input
                type="checkbox"
                className="rounded"
                checked={workflow[item.key] || false}
                onChange={(e) => updateWorkflow(item.key, e.target.checked)}
              />
              <span className="text-sm">{item.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function RegistrationFields({ details, updateDetails }: FieldProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="sub_type">登記種別</Label>
        <Select
          value={(details.sub_type as string) || ""}
          onValueChange={(val) => updateDetails("sub_type", val)}
        >
          <SelectTrigger id="sub_type">
            <SelectValue placeholder="種別を選択" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="新築">新築</SelectItem>
            <SelectItem value="売買">売買</SelectItem>
            <SelectItem value="相続">相続</SelectItem>
            <SelectItem value="抵当権">抵当権</SelectItem>
            <SelectItem value="その他">その他</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="architect">建築業者</Label>
        <Input
          id="architect"
          placeholder="例: 一条工務店"
          value={(details.architect as string) || ""}
          onChange={(e) => updateDetails("architect", e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="completion_date">完了検査日</Label>
          <Input
            id="completion_date"
            type="date"
            value={(details.completion_date as string) || ""}
            onChange={(e) => updateDetails("completion_date", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="settlement_date">決済日</Label>
          <Input
            id="settlement_date"
            type="date"
            value={(details.settlement_date as string) || ""}
            onChange={(e) => updateDetails("settlement_date", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

function InheritanceFields({ details, updateDetails }: FieldProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="will_type">遺言種別</Label>
        <Input
          id="will_type"
          placeholder="例: 公正証書遺言、自筆証書遺言"
          value={(details.will_type as string) || ""}
          onChange={(e) => updateDetails("will_type", e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="will_date">遺言予定日</Label>
        <Input
          id="will_date"
          type="date"
          value={(details.will_date as string) || ""}
          onChange={(e) => updateDetails("will_date", e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="documents_kept">預かり書類</Label>
        <Input
          id="documents_kept"
          placeholder="例: 印鑑証明, 権利証"
          value={(details.documents_kept as string) || ""}
          onChange={(e) => updateDetails("documents_kept", e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="contact_info">連絡先情報</Label>
        <Input
          id="contact_info"
          placeholder="例: ケアハウス〇〇"
          value={(details.contact_info as string) || ""}
          onChange={(e) => updateDetails("contact_info", e.target.value)}
        />
      </div>
    </div>
  );
}

function CorporateFields({ details, updateDetails }: FieldProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="corp_purpose">目的</Label>
        <Input
          id="corp_purpose"
          placeholder="例: 設立、解散、役員変更"
          value={(details.purpose as string) || ""}
          onChange={(e) => updateDetails("purpose", e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="next_election_date">次期改選日</Label>
        <Input
          id="next_election_date"
          type="date"
          value={(details.next_election_date as string) || ""}
          onChange={(e) => updateDetails("next_election_date", e.target.value)}
        />
      </div>
    </div>
  );
}

function DroneFields({ details, updateDetails }: FieldProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="items">品目（カンマ区切り）</Label>
        <Input
          id="items"
          placeholder="例: バッテリー2, 充電ハブ"
          value={((details.items as string[]) || []).join(", ")}
          onChange={(e) =>
            updateDetails(
              "items",
              e.target.value.split(",").map((s) => s.trim())
            )
          }
        />
      </div>
      <div>
        <Label htmlFor="cost_price">仕入れ額</Label>
        <Input
          id="cost_price"
          type="number"
          placeholder="45200"
          value={(details.cost_price as number) || ""}
          onChange={(e) =>
            updateDetails("cost_price", parseInt(e.target.value, 10) || 0)
          }
        />
      </div>
    </div>
  );
}

function FarmlandFields({ details, updateDetails }: FieldProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="application_type">申請種別</Label>
        <Input
          id="application_type"
          placeholder="例: 農地転用、農振除外"
          value={(details.application_type as string) || ""}
          onChange={(e) => updateDetails("application_type", e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="article_type">農地法条項</Label>
        <Select
          value={(details.article_type as string) || ""}
          onValueChange={(val) => updateDetails("article_type", val)}
        >
          <SelectTrigger id="article_type">
            <SelectValue placeholder="条項を選択" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3条">3条</SelectItem>
            <SelectItem value="4条">4条</SelectItem>
            <SelectItem value="5条">5条</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="application_date">申請日</Label>
          <Input
            id="application_date"
            type="date"
            value={(details.application_date as string) || ""}
            onChange={(e) => updateDetails("application_date", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="permission_date">許可予定日</Label>
          <Input
            id="permission_date"
            type="date"
            value={(details.permission_date as string) || ""}
            onChange={(e) => updateDetails("permission_date", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

// 月次売上配分
interface MonthlyAllocationFieldsProps {
  allocations: Record<string, number>;
  updateAllocation: (month: string, value: number) => void;
}

function MonthlyAllocationFields({
  allocations,
  updateAllocation,
}: MonthlyAllocationFieldsProps) {
  const currentYear = new Date().getFullYear();
  const fiscalYear = new Date().getMonth() < 3 ? currentYear - 1 : currentYear;

  const months = [
    { key: `${fiscalYear}-04`, label: "4月" },
    { key: `${fiscalYear}-05`, label: "5月" },
    { key: `${fiscalYear}-06`, label: "6月" },
    { key: `${fiscalYear}-07`, label: "7月" },
    { key: `${fiscalYear}-08`, label: "8月" },
    { key: `${fiscalYear}-09`, label: "9月" },
    { key: `${fiscalYear}-10`, label: "10月" },
    { key: `${fiscalYear}-11`, label: "11月" },
    { key: `${fiscalYear}-12`, label: "12月" },
    { key: `${fiscalYear + 1}-01`, label: "1月" },
    { key: `${fiscalYear + 1}-02`, label: "2月" },
    { key: `${fiscalYear + 1}-03`, label: "3月" },
  ];

  return (
    <div className="space-y-4 mt-6">
      <Label>月次売上配分（{fiscalYear}年度）</Label>
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {months.map((month) => (
          <div key={month.key}>
            <Label className="text-xs text-muted-foreground">{month.label}</Label>
            <Input
              type="number"
              placeholder="0"
              className="h-8 text-sm"
              value={allocations[month.key] || ""}
              onChange={(e) =>
                updateAllocation(month.key, parseInt(e.target.value, 10) || 0)
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}
