"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
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
import type { SkillCategoryWithItems } from "@/types/database";
import {
  createSkillCategory,
  updateSkillCategory,
  deleteSkillCategory,
  createSkillItem,
  updateSkillItem,
  deleteSkillItem,
} from "../actions";

interface Props {
  initialCategories: SkillCategoryWithItems[];
}

export function SkillSettingsManager({ initialCategories }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");

  const handleAddCategory = () => {
    const name = newCategoryName.trim();
    if (!name) return;
    setError(null);
    startTransition(async () => {
      const result = await createSkillCategory(name);
      if (result.error) {
        setError(result.error);
        return;
      }
      setNewCategoryName("");
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

      {/* 新規カテゴリ追加 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="新しいカテゴリ名（例: 測量）"
              disabled={isPending}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddCategory();
              }}
            />
            <Button
              type="button"
              onClick={handleAddCategory}
              disabled={isPending || !newCategoryName.trim()}
            >
              <Plus className="h-4 w-4 mr-1" />
              カテゴリ追加
            </Button>
          </div>
        </CardContent>
      </Card>

      {initialCategories.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            カテゴリが未登録です。上から追加してください。
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {initialCategories.map((cat) => (
            <CategoryBlock
              key={cat.id}
              category={cat}
              onChanged={() => router.refresh()}
              setError={setError}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryBlock({
  category,
  onChanged,
  setError,
}: {
  category: SkillCategoryWithItems;
  onChanged: () => void;
  setError: (s: string | null) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [editingCat, setEditingCat] = useState(false);
  const [catName, setCatName] = useState(category.name);
  const [newItemName, setNewItemName] = useState("");

  const saveCatName = () => {
    const name = catName.trim();
    if (!name || name === category.name) {
      setEditingCat(false);
      setCatName(category.name);
      return;
    }
    startTransition(async () => {
      const result = await updateSkillCategory(category.id, name);
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditingCat(false);
      onChanged();
    });
  };

  const handleDeleteCategory = () => {
    startTransition(async () => {
      const result = await deleteSkillCategory(category.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      onChanged();
    });
  };

  const handleAddItem = () => {
    const name = newItemName.trim();
    if (!name) return;
    startTransition(async () => {
      const result = await createSkillItem(category.id, name);
      if (result.error) {
        setError(result.error);
        return;
      }
      setNewItemName("");
      onChanged();
    });
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* カテゴリ名 */}
        <div className="flex items-center gap-2">
          {editingCat ? (
            <>
              <Input
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                disabled={isPending}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveCatName();
                  if (e.key === "Escape") {
                    setEditingCat(false);
                    setCatName(category.name);
                  }
                }}
              />
              <Button size="sm" onClick={saveCatName} disabled={isPending}>
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditingCat(false);
                  setCatName(category.name);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <h3 className="text-lg font-bold flex-1">{category.name}</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingCat(true)}
                disabled={isPending}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" disabled={isPending}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>カテゴリを削除</AlertDialogTitle>
                    <AlertDialogDescription>
                      「{category.name}」とそのスキル項目(
                      {category.items.length}件)、
                      および関連する全社員の評価データを削除します。この操作は元に戻せません。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>キャンセル</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteCategory}
                      className="bg-red-500 hover:bg-red-600"
                    >
                      削除する
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>

        {/* 項目リスト */}
        <div className="pl-4 border-l-2 border-muted space-y-1">
          {category.items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-1">
              （項目がありません）
            </p>
          ) : (
            category.items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                onChanged={onChanged}
                setError={setError}
              />
            ))
          )}
        </div>

        {/* 項目追加 */}
        <div className="flex items-center gap-2 pl-4">
          <Input
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="工程名（例: 現地踏査）"
            disabled={isPending}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddItem();
            }}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={handleAddItem}
            disabled={isPending || !newItemName.trim()}
          >
            <Plus className="h-4 w-4 mr-1" />
            項目追加
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ItemRow({
  item,
  onChanged,
  setError,
}: {
  item: { id: string; name: string; description: string | null };
  onChanged: () => void;
  setError: (s: string | null) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);

  const save = () => {
    const n = name.trim();
    if (!n || n === item.name) {
      setEditing(false);
      setName(item.name);
      return;
    }
    startTransition(async () => {
      const result = await updateSkillItem(item.id, n);
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
      onChanged();
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteSkillItem(item.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      onChanged();
    });
  };

  return (
    <div className="flex items-center gap-2 py-1">
      {editing ? (
        <>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isPending}
            autoFocus
            className="h-8"
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") {
                setEditing(false);
                setName(item.name);
              }
            }}
          />
          <Button size="sm" variant="ghost" onClick={save} disabled={isPending}>
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(false);
              setName(item.name);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <>
          <span className="flex-1 text-sm">{item.name}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditing(true)}
            disabled={isPending}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" disabled={isPending}>
                <Trash2 className="h-3.5 w-3.5 text-red-500" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>スキル項目を削除</AlertDialogTitle>
                <AlertDialogDescription>
                  「{item.name}」とこの項目の全社員評価を削除します。
                  この操作は元に戻せません。
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
        </>
      )}
    </div>
  );
}
