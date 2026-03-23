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
import { ArrowLeft, Loader2, FileText } from "lucide-react";
import {
  PROJECT_CATEGORY_LABELS,
  PROJECT_AREA_GROUPS,
  type ProjectCategory,
  type ProjectStatus,
} from "@/types/database";
import {
  createProjects,
  getNextProjectCode,
  type CreateProjectsData,
} from "../actions";

interface Employee {
  id: string;
  name: string;
}

interface ProjectFormProps {
  employees: Employee[];
}

export function ProjectForm({ employees }: ProjectFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // 複数カテゴリ選択（最大3つ）
  const [categories, setCategories] = useState<ProjectCategory[]>([]);
  const [projectCodes, setProjectCodes] = useState<Record<ProjectCategory, string>>({} as Record<ProjectCategory, string>);
  const [loadingCodes, setLoadingCodes] = useState<Record<ProjectCategory, boolean>>({} as Record<ProjectCategory, boolean>);

  const [status, setStatus] = useState<ProjectStatus>("進行中");
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
      contact_id: null,
      manager_id: managerId || null,
      start_date: new Date().toISOString().split("T")[0], // 登録日を着手日として設定
      end_date: null,
      fee_tax_excluded: null,
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
    </>
  );
}
