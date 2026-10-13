"use client";

import { useState, useRef, useTransition, type KeyboardEvent, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  X,
  Save,
  Trash2,
  Image as ImageIcon,
  GitBranch,
  Youtube,
  Eye,
  Pencil,
  Columns2,
  Heading1,
  Heading2,
  Heading3,
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Link as LinkIcon,
  Table as TableIcon,
  Minus,
  Code,
} from "lucide-react";
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
import { MarkdownRenderer } from "@/components/markdown-renderer";
import {
  DEFAULT_MANUAL_CATEGORIES,
  type Manual,
} from "@/types/database";
import {
  createManual,
  updateManual,
  deleteManual,
  uploadManualImage,
  type ManualFormData,
} from "./actions";

interface ManualFormProps {
  manual?: Manual;
  categorySuggestions?: string[];
}

type ViewMode = "edit" | "preview" | "split";

// ツールバー用の小さなボタン
function ToolbarButton({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="h-8 min-w-8 px-2 inline-flex items-center justify-center rounded hover:bg-muted-foreground/10 disabled:opacity-50 disabled:cursor-not-allowed text-sm text-foreground"
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-5 bg-border mx-1" />;
}

const MERMAID_TEMPLATE = `\`\`\`mermaid
graph TD
  A[開始] --> B{条件}
  B -->|はい| C[処理1]
  B -->|いいえ| D[処理2]
  C --> E[終了]
  D --> E
\`\`\``;

const YOUTUBE_TEMPLATE = `\`\`\`youtube
https://www.youtube.com/watch?v=VIDEO_ID
\`\`\``;

export function ManualForm({ manual, categorySuggestions = [] }: ManualFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [title, setTitle] = useState(manual?.title ?? "");
  const [category, setCategory] = useState(manual?.category ?? "");
  const [body, setBody] = useState(manual?.body ?? "");
  const [tags, setTags] = useState<string[]>(manual?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [isPublished, setIsPublished] = useState(manual?.is_published ?? false);
  const [viewMode, setViewMode] = useState<ViewMode>("split");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEdit = !!manual;

  const allCategorySuggestions = Array.from(
    new Set([...DEFAULT_MANUAL_CATEGORIES, ...categorySuggestions])
  );

  const addTag = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    if (tags.includes(t)) return;
    setTags([...tags, t]);
    setTagInput("");
  };

  const removeTag = (t: string) => {
    setTags(tags.filter((x) => x !== t));
  };

  const onTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  // カーソル位置にテキストを挿入（ブロック要素用、前後に空行確保）
  const insertAtCursor = (text: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      setBody((prev) => prev + "\n" + text + "\n");
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = body.slice(0, start);
    const after = body.slice(end);
    const prefix = before && !before.endsWith("\n") ? "\n" : "";
    const suffix = after && !after.startsWith("\n") ? "\n" : "";
    const inserted = `${prefix}${text}${suffix}`;
    const next = before + inserted + after;
    setBody(next);

    const pos = (before + inserted).length;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  };

  // 選択範囲を prefix/suffix で囲む（太字・斜体・リンクなどインライン用）
  const wrapSelection = (
    prefix: string,
    suffix: string,
    placeholder: string
  ) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = body.slice(start, end) || placeholder;
    const before = body.slice(0, start);
    const after = body.slice(end);
    const inserted = `${prefix}${selected}${suffix}`;
    const next = before + inserted + after;
    setBody(next);

    requestAnimationFrame(() => {
      ta.focus();
      // 選択なしだった → placeholderを選択状態に。選択あり → カーソルを末尾へ
      if (end === start) {
        const selStart = before.length + prefix.length;
        ta.setSelectionRange(selStart, selStart + selected.length);
      } else {
        const pos = (before + inserted).length;
        ta.setSelectionRange(pos, pos);
      }
    });
  };

  // 選択行の各行頭に prefix を付与（箇条書き・引用・見出しなどブロック用）
  const prefixLines = (linePrefix: string, placeholder: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;

    // 選択範囲の行頭・行末まで拡張
    const lineStart = body.lastIndexOf("\n", start - 1) + 1;
    const lineEndIdx = body.indexOf("\n", end);
    const lineEnd = lineEndIdx === -1 ? body.length : lineEndIdx;

    const before = body.slice(0, lineStart);
    const target = body.slice(lineStart, lineEnd) || placeholder;
    const after = body.slice(lineEnd);

    const transformed = target
      .split("\n")
      .map((line) => `${linePrefix}${line}`)
      .join("\n");

    // 前後に空行を確保（ブロック要素の分離）
    const needPrefixBlank =
      before && !before.endsWith("\n\n") && before.endsWith("\n") ? "" : before && !before.endsWith("\n") ? "\n\n" : "";
    const needSuffixBlank =
      after && !after.startsWith("\n") ? "\n" : "";

    const inserted = `${needPrefixBlank}${transformed}${needSuffixBlank}`;
    const next = before + inserted + after;
    setBody(next);

    requestAnimationFrame(() => {
      ta.focus();
      const pos = (before + inserted).length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const handleImageSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // 同じファイルを再度選べるようにリセット

    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const result = await uploadManualImage(fd);
      if (result.error || !result.url) {
        setError(result.error ?? "アップロードに失敗しました");
        return;
      }
      const alt = file.name.replace(/\.[^.]+$/, "");
      insertAtCursor(`![${alt}](${result.url})`);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (publish?: boolean) => {
    setError(null);
    if (!title.trim()) {
      setError("タイトルは必須です");
      return;
    }

    const data: ManualFormData = {
      title: title.trim(),
      category: category.trim() || null,
      body,
      tags,
      is_published: publish !== undefined ? publish : isPublished,
    };

    startTransition(async () => {
      if (isEdit) {
        const result = await updateManual(manual!.id, data);
        if (result.error) {
          setError(result.error);
          return;
        }
        router.push(`/manuals/${manual!.id}`);
        router.refresh();
      } else {
        const result = await createManual(data);
        if (result.error) {
          setError(result.error);
          return;
        }
        router.push(`/manuals/${result.id!}`);
        router.refresh();
      }
    });
  };

  const handleDelete = () => {
    if (!manual) return;
    startTransition(async () => {
      const result = await deleteManual(manual.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push("/manuals");
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

      <div className="space-y-2">
        <Label htmlFor="title">
          タイトル <span className="text-red-500">*</span>
        </Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例: 境界測量の進め方"
          disabled={isPending}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="category">カテゴリ</Label>
          <Input
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="例: 測量"
            list="manual-category-suggestions"
            disabled={isPending}
          />
          <datalist id="manual-category-suggestions">
            {allCategorySuggestions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tags">タグ</Label>
          <div className="flex flex-wrap items-center gap-1.5 border rounded-md px-2 py-1.5 bg-background min-h-10">
            {tags.map((t) => (
              <Badge key={t} variant="secondary" className="gap-1">
                {t}
                <button
                  type="button"
                  onClick={() => removeTag(t)}
                  className="hover:text-red-500"
                  aria-label={`${t}を削除`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <input
              id="tags"
              className="flex-1 min-w-[120px] bg-transparent outline-none text-sm py-1"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={onTagKeyDown}
              onBlur={() => tagInput && addTag(tagInput)}
              placeholder="Enterで追加"
              disabled={isPending}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Label htmlFor="body">本文（Markdown）</Label>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant={viewMode === "edit" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("edit")}
            >
              <Pencil className="h-4 w-4 mr-1" />
              編集
            </Button>
            <Button
              type="button"
              variant={viewMode === "split" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("split")}
              className="hidden md:inline-flex"
            >
              <Columns2 className="h-4 w-4 mr-1" />
              分割
            </Button>
            <Button
              type="button"
              variant={viewMode === "preview" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("preview")}
            >
              <Eye className="h-4 w-4 mr-1" />
              プレビュー
            </Button>
          </div>
        </div>

        {/* ツールバー */}
        <div className="flex items-center gap-0.5 flex-wrap border rounded-t-md p-1.5 bg-muted/30 border-b-0">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
            className="hidden"
            onChange={handleImageSelect}
          />

          {/* 見出し */}
          <ToolbarButton
            onClick={() => prefixLines("# ", "見出し")}
            disabled={isPending}
            title="大見出し (H1)"
          >
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => prefixLines("## ", "見出し")}
            disabled={isPending}
            title="中見出し (H2)"
          >
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => prefixLines("### ", "見出し")}
            disabled={isPending}
            title="小見出し (H3)"
          >
            <Heading3 className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarDivider />

          {/* 装飾 */}
          <ToolbarButton
            onClick={() => wrapSelection("**", "**", "太字")}
            disabled={isPending}
            title="太字"
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => wrapSelection("*", "*", "斜体")}
            disabled={isPending}
            title="斜体"
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => wrapSelection("~~", "~~", "取消線")}
            disabled={isPending}
            title="取消線"
          >
            <Strikethrough className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => wrapSelection("`", "`", "code")}
            disabled={isPending}
            title="インラインコード"
          >
            <Code className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarDivider />

          {/* リスト・引用 */}
          <ToolbarButton
            onClick={() => prefixLines("- ", "項目")}
            disabled={isPending}
            title="箇条書き"
          >
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => prefixLines("1. ", "項目")}
            disabled={isPending}
            title="番号付きリスト"
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => prefixLines("- [ ] ", "タスク")}
            disabled={isPending}
            title="チェックリスト"
          >
            <ListChecks className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => prefixLines("> ", "引用")}
            disabled={isPending}
            title="引用"
          >
            <Quote className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarDivider />

          {/* リンク・表・区切り線 */}
          <ToolbarButton
            onClick={() => wrapSelection("[", "](https://)", "リンク文字")}
            disabled={isPending}
            title="リンク"
          >
            <LinkIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              insertAtCursor("| 列1 | 列2 | 列3 |\n|---|---|---|\n| a | b | c |\n| d | e | f |")
            }
            disabled={isPending}
            title="表"
          >
            <TableIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => insertAtCursor("---")}
            disabled={isPending}
            title="区切り線"
          >
            <Minus className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarDivider />

          {/* メディア */}
          <ToolbarButton
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || isPending}
            title="画像をアップロードして挿入"
          >
            <ImageIcon className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">
              {uploading ? "アップロード中..." : "画像"}
            </span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => insertAtCursor(MERMAID_TEMPLATE)}
            disabled={isPending}
            title="フローチャート（Mermaid）を挿入"
          >
            <GitBranch className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">フロー図</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => insertAtCursor(YOUTUBE_TEMPLATE)}
            disabled={isPending}
            title="YouTube動画を挿入"
          >
            <Youtube className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">動画</span>
          </ToolbarButton>
        </div>

        <div
          className={
            viewMode === "split"
              ? "grid grid-cols-1 md:grid-cols-2 gap-0 border rounded-b-md overflow-hidden"
              : "border rounded-b-md overflow-hidden"
          }
        >
          {(viewMode === "edit" || viewMode === "split") && (
            <Textarea
              ref={textareaRef}
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={"# 概要\n\n## 手順\n1. ..."}
              className="min-h-[500px] font-mono text-sm rounded-none border-0 focus-visible:ring-0 resize-none md:border-r"
              disabled={isPending}
            />
          )}
          {(viewMode === "preview" || viewMode === "split") && (
            <div className="min-h-[500px] max-h-[700px] overflow-auto p-4 bg-background">
              {body.trim() ? (
                <MarkdownRenderer source={body} />
              ) : (
                <div className="text-sm text-muted-foreground">
                  （プレビューがここに表示されます）
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="is_published"
          checked={isPublished}
          onCheckedChange={(c) => setIsPublished(c === true)}
          disabled={isPending}
        />
        <Label htmlFor="is_published" className="cursor-pointer">
          公開する（オフだと下書き扱い）
        </Label>
      </div>

      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={() => handleSubmit()}
                disabled={isPending}
              >
                <Save className="h-4 w-4 mr-1" />
                {isEdit ? "保存" : "作成"}
              </Button>
              {!isEdit && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSubmit(true)}
                  disabled={isPending}
                >
                  公開として作成
                </Button>
              )}
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
                    <AlertDialogTitle>マニュアルを削除</AlertDialogTitle>
                    <AlertDialogDescription>
                      「{manual!.title}」を削除します。この操作は元に戻せません。
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
