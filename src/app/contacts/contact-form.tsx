"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import type { Contact } from "@/types/database";
import {
  createIndividualContact,
  updateIndividualContact,
  deleteIndividualContact,
  type IndividualContactFormData,
  type RelatedProject,
} from "./actions";
import { RelatedProjectsSection } from "@/components/related-projects-section";

interface ContactFormProps {
  contact?: Contact;
  isEdit?: boolean;
  relatedProjects?: RelatedProject[];
}

export function ContactForm({ contact, isEdit = false, relatedProjects = [] }: ContactFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);

    const data: IndividualContactFormData = {
      last_name: formData.get("last_name") as string,
      first_name: formData.get("first_name") as string,
      last_name_kana: (formData.get("last_name_kana") as string) || null,
      first_name_kana: (formData.get("first_name_kana") as string) || null,
      birth_date: (formData.get("birth_date") as string) || null,
      phone: (formData.get("phone") as string) || null,
      email: (formData.get("email") as string) || null,
      postal_code: (formData.get("postal_code") as string) || null,
      prefecture: (formData.get("prefecture") as string) || null,
      city: (formData.get("city") as string) || null,
      street: (formData.get("street") as string) || null,
      building: (formData.get("building") as string) || null,
      notes: (formData.get("notes") as string) || null,
    };

    startTransition(async () => {
      let result;
      if (isEdit && contact) {
        result = await updateIndividualContact(contact.id, data);
      } else {
        result = await createIndividualContact(data);
      }

      if (result.error) {
        setError(result.error);
      } else {
        router.push("/contacts");
      }
    });
  };

  const handleDelete = async () => {
    if (!contact) return;
    if (
      !confirm(
        "この個人顧客を削除してもよろしいですか？\n関連する業務データがある場合、顧客情報が空になります。"
      )
    )
      return;

    startTransition(async () => {
      const result = await deleteIndividualContact(contact.id);
      if (result.error) {
        setError(result.error);
      } else {
        router.push("/contacts");
      }
    });
  };

  return (
    <>
      <header className="mb-8">
        <Link
          href="/contacts"
          className="flex items-center text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          個人顧客一覧に戻る
        </Link>
        <h1 className="text-2xl font-bold">
          {isEdit ? "個人顧客編集" : "新規個人顧客登録"}
        </h1>
      </header>

      {error && (
        <Card className="mb-6 border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* 関連業務（編集時のみ表示） */}
      {isEdit && relatedProjects.length > 0 && (
        <div className="mb-6">
          <RelatedProjectsSection projects={relatedProjects} />
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>基本情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="last_name">姓 *</Label>
                <Input
                  id="last_name"
                  name="last_name"
                  placeholder="山本"
                  defaultValue={contact?.last_name || ""}
                  required
                />
              </div>
              <div>
                <Label htmlFor="first_name">名 *</Label>
                <Input
                  id="first_name"
                  name="first_name"
                  placeholder="四郎"
                  defaultValue={contact?.first_name || ""}
                  required
                />
              </div>
              <div>
                <Label htmlFor="last_name_kana">姓（カナ）</Label>
                <Input
                  id="last_name_kana"
                  name="last_name_kana"
                  placeholder="ヤマモト"
                  defaultValue={contact?.last_name_kana || ""}
                />
              </div>
              <div>
                <Label htmlFor="first_name_kana">名（カナ）</Label>
                <Input
                  id="first_name_kana"
                  name="first_name_kana"
                  placeholder="シロウ"
                  defaultValue={contact?.first_name_kana || ""}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="birth_date">生年月日</Label>
                <Input
                  id="birth_date"
                  name="birth_date"
                  type="date"
                  defaultValue={contact?.birth_date || ""}
                />
              </div>
              <div>
                <Label htmlFor="phone">電話番号</Label>
                <Input
                  id="phone"
                  name="phone"
                  placeholder="090-1234-5678"
                  defaultValue={contact?.phone || ""}
                />
              </div>
              <div>
                <Label htmlFor="email">メールアドレス</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="yamamoto@example.com"
                  defaultValue={contact?.email || ""}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>住所</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="postal_code">郵便番号</Label>
                <Input
                  id="postal_code"
                  name="postal_code"
                  placeholder="093-0000"
                  defaultValue={contact?.postal_code || ""}
                />
              </div>
              <div>
                <Label htmlFor="prefecture">都道府県</Label>
                <Input
                  id="prefecture"
                  name="prefecture"
                  placeholder="北海道"
                  defaultValue={contact?.prefecture || ""}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="city">市区町村</Label>
                <Input
                  id="city"
                  name="city"
                  placeholder="網走市"
                  defaultValue={contact?.city || ""}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="street">町名・番地</Label>
                <Input
                  id="street"
                  name="street"
                  placeholder="xxx町1-2-3"
                  defaultValue={contact?.street || ""}
                />
              </div>
              <div>
                <Label htmlFor="building">建物名・部屋番号</Label>
                <Input
                  id="building"
                  name="building"
                  placeholder="○○マンション101"
                  defaultValue={contact?.building || ""}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>備考</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              id="notes"
              name="notes"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="備考・メモ"
              defaultValue={contact?.notes || ""}
            />
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
            <Link href="/contacts">
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
