"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Save, Trash2, Building2, User } from "lucide-react";
import type { Customer, CustomerType } from "@/types/database";
import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
  type CustomerFormData,
} from "./actions";

interface CustomerFormProps {
  customer?: Customer;
  defaultType?: CustomerType;
}

export function CustomerForm({ customer, defaultType = "corporate" }: CustomerFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<CustomerType>(customer?.type ?? defaultType);

  // 共通
  const [displayName, setDisplayName] = useState(customer?.display_name ?? "");
  const [displayNameKana, setDisplayNameKana] = useState(customer?.display_name_kana ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [postalCode, setPostalCode] = useState(customer?.postal_code ?? "");
  const [prefecture, setPrefecture] = useState(customer?.prefecture ?? "");
  const [city, setCity] = useState(customer?.city ?? "");
  const [street, setStreet] = useState(customer?.street ?? "");
  const [building, setBuilding] = useState(customer?.building ?? "");
  const [notes, setNotes] = useState(customer?.notes ?? "");

  // 法人固有
  const [corporateNumber, setCorporateNumber] = useState(customer?.corporate_number ?? "");
  const [industry, setIndustry] = useState(customer?.industry ?? "");
  const [fax, setFax] = useState(customer?.fax ?? "");
  const [contactLastName, setContactLastName] = useState(customer?.contact_last_name ?? "");
  const [contactFirstName, setContactFirstName] = useState(customer?.contact_first_name ?? "");
  const [contactLastNameKana, setContactLastNameKana] = useState(customer?.contact_last_name_kana ?? "");
  const [contactFirstNameKana, setContactFirstNameKana] = useState(customer?.contact_first_name_kana ?? "");
  const [contactDepartment, setContactDepartment] = useState(customer?.contact_department ?? "");
  const [contactPosition, setContactPosition] = useState(customer?.contact_position ?? "");
  const [contactPhone, setContactPhone] = useState(customer?.contact_phone ?? "");
  const [contactEmail, setContactEmail] = useState(customer?.contact_email ?? "");

  // 個人固有
  const [lastName, setLastName] = useState(customer?.last_name ?? "");
  const [firstName, setFirstName] = useState(customer?.first_name ?? "");
  const [lastNameKana, setLastNameKana] = useState(customer?.last_name_kana ?? "");
  const [firstNameKana, setFirstNameKana] = useState(customer?.first_name_kana ?? "");
  const [birthDate, setBirthDate] = useState(customer?.birth_date ?? "");

  const isEdit = !!customer;

  // 個人の場合、姓名から display_name を自動生成
  const effectiveDisplayName = (): string => {
    if (type === "corporate") return displayName.trim();
    const auto = `${lastName.trim()} ${firstName.trim()}`.trim();
    return displayName.trim() || auto;
  };

  const effectiveDisplayNameKana = (): string | null => {
    if (type === "corporate") return displayNameKana.trim() || null;
    if (displayNameKana.trim()) return displayNameKana.trim();
    const auto = `${lastNameKana.trim()} ${firstNameKana.trim()}`.trim();
    return auto || null;
  };

  const handleSubmit = () => {
    setError(null);
    const finalName = effectiveDisplayName();
    if (!finalName) {
      setError(type === "corporate" ? "会社名は必須です" : "氏名は必須です");
      return;
    }

    const data: CustomerFormData = {
      type,
      display_name: finalName,
      display_name_kana: effectiveDisplayNameKana(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      postal_code: postalCode.trim() || null,
      prefecture: prefecture.trim() || null,
      city: city.trim() || null,
      street: street.trim() || null,
      building: building.trim() || null,
      notes: notes.trim() || null,
      corporate_number: corporateNumber.trim() || null,
      industry: industry.trim() || null,
      fax: fax.trim() || null,
      contact_last_name: contactLastName.trim() || null,
      contact_first_name: contactFirstName.trim() || null,
      contact_last_name_kana: contactLastNameKana.trim() || null,
      contact_first_name_kana: contactFirstNameKana.trim() || null,
      contact_department: contactDepartment.trim() || null,
      contact_position: contactPosition.trim() || null,
      contact_phone: contactPhone.trim() || null,
      contact_email: contactEmail.trim() || null,
      last_name: lastName.trim() || null,
      first_name: firstName.trim() || null,
      last_name_kana: lastNameKana.trim() || null,
      first_name_kana: firstNameKana.trim() || null,
      birth_date: birthDate.trim() || null,
    };

    startTransition(async () => {
      if (isEdit) {
        const result = await updateCustomer(customer!.id, data);
        if (result.error) {
          setError(result.error);
          return;
        }
        router.push(`/customers/${customer!.id}`);
        router.refresh();
      } else {
        const result = await createCustomer(data);
        if (result.error) {
          setError(result.error);
          return;
        }
        router.push(`/customers/${result.id!}`);
        router.refresh();
      }
    });
  };

  const handleDelete = () => {
    if (!customer) return;
    startTransition(async () => {
      const result = await deleteCustomer(customer.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push("/customers");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
          {error}
        </div>
      )}

      {/* 区分選択（新規時のみ、編集時は固定） */}
      {!isEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">区分</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setType("corporate")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md border transition-colors ${
                  type === "corporate"
                    ? "bg-blue-100 border-blue-400 text-blue-900"
                    : "bg-background border-border hover:border-foreground/30"
                }`}
              >
                <Building2 className="h-4 w-4" />
                法人
              </button>
              <button
                type="button"
                onClick={() => setType("individual")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md border transition-colors ${
                  type === "individual"
                    ? "bg-green-100 border-green-400 text-green-900"
                    : "bg-background border-border hover:border-foreground/30"
                }`}
              >
                <User className="h-4 w-4" />
                個人
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 名称 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            {type === "corporate" ? "法人情報" : "氏名"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {type === "corporate" ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="display_name">
                    会社名 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="display_name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="株式会社○○"
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="display_name_kana">会社名（カナ）</Label>
                  <Input
                    id="display_name_kana"
                    value={displayNameKana}
                    onChange={(e) => setDisplayNameKana(e.target.value)}
                    placeholder="カブシキガイシャマルマル"
                    disabled={isPending}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="corporate_number">法人番号</Label>
                  <Input
                    id="corporate_number"
                    value={corporateNumber}
                    onChange={(e) => setCorporateNumber(e.target.value)}
                    placeholder="1234567890123"
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="industry">業種</Label>
                  <Input
                    id="industry"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    disabled={isPending}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="last_name">
                    姓 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="last_name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="first_name">名</Label>
                  <Input
                    id="first_name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="last_name_kana">姓（カナ）</Label>
                  <Input
                    id="last_name_kana"
                    value={lastNameKana}
                    onChange={(e) => setLastNameKana(e.target.value)}
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="first_name_kana">名（カナ）</Label>
                  <Input
                    id="first_name_kana"
                    value={firstNameKana}
                    onChange={(e) => setFirstNameKana(e.target.value)}
                    disabled={isPending}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="birth_date">生年月日</Label>
                <Input
                  id="birth_date"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  disabled={isPending}
                  className="max-w-xs"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 連絡先 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">連絡先</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="phone">
                {type === "corporate" ? "代表電話" : "電話番号"}
              </Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>
          {type === "corporate" && (
            <div className="space-y-1 max-w-md">
              <Label htmlFor="fax">FAX</Label>
              <Input
                id="fax"
                value={fax}
                onChange={(e) => setFax(e.target.value)}
                disabled={isPending}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* 住所 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">住所</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label htmlFor="postal_code">郵便番号</Label>
              <Input
                id="postal_code"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="060-0001"
                disabled={isPending}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="prefecture">都道府県</Label>
              <Input
                id="prefecture"
                value={prefecture}
                onChange={(e) => setPrefecture(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="city">市区町村</Label>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="street">町名・番地</Label>
              <Input
                id="street"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="building">建物名・部屋番号</Label>
              <Input
                id="building"
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 担当者（法人のみ） */}
      {type === "corporate" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">担当者（1名）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label htmlFor="contact_last_name">姓</Label>
                <Input
                  id="contact_last_name"
                  value={contactLastName}
                  onChange={(e) => setContactLastName(e.target.value)}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="contact_first_name">名</Label>
                <Input
                  id="contact_first_name"
                  value={contactFirstName}
                  onChange={(e) => setContactFirstName(e.target.value)}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="contact_last_name_kana">姓（カナ）</Label>
                <Input
                  id="contact_last_name_kana"
                  value={contactLastNameKana}
                  onChange={(e) => setContactLastNameKana(e.target.value)}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="contact_first_name_kana">名（カナ）</Label>
                <Input
                  id="contact_first_name_kana"
                  value={contactFirstNameKana}
                  onChange={(e) => setContactFirstNameKana(e.target.value)}
                  disabled={isPending}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="contact_department">部署</Label>
                <Input
                  id="contact_department"
                  value={contactDepartment}
                  onChange={(e) => setContactDepartment(e.target.value)}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="contact_position">役職</Label>
                <Input
                  id="contact_position"
                  value={contactPosition}
                  onChange={(e) => setContactPosition(e.target.value)}
                  disabled={isPending}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="contact_phone">電話</Label>
                <Input
                  id="contact_phone"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="contact_email">メール</Label>
                <Input
                  id="contact_email"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  disabled={isPending}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 備考 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">備考</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="メモ・備考"
            rows={3}
            disabled={isPending}
          />
        </CardContent>
      </Card>

      {/* アクション */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Button type="button" onClick={handleSubmit} disabled={isPending}>
                <Save className="h-4 w-4 mr-1" />
                {isEdit ? "保存" : "登録"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.back()}
                disabled={isPending}
              >
                キャンセル
              </Button>
            </div>

            {isEdit && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" disabled={isPending}>
                    <Trash2 className="h-4 w-4 mr-1 text-red-500" />
                    削除
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>顧客を削除</AlertDialogTitle>
                    <AlertDialogDescription>
                      「{customer!.display_name}」を削除します。この操作は論理削除で、必要なら復元できます。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>キャンセル</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-red-500 hover:bg-red-600"
                    >
                      削除する
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
