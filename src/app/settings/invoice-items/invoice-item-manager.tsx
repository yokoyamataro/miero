"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Plus,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import type {
  InvoiceItemCategoryWithTemplates,
  InvoiceItemTemplate,
} from "@/types/database";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  reorderTemplates,
} from "./actions";

interface InvoiceItemManagerProps {
  categories: InvoiceItemCategoryWithTemplates[];
}

interface TemplateFormData {
  name: string;
  description: string;
  default_note: string;
  default_unit: string;
  default_unit_price: string;
}

const emptyTemplateForm: TemplateFormData = {
  name: "",
  description: "",
  default_note: "",
  default_unit: "",
  default_unit_price: "",
};

export function InvoiceItemManager({ categories: initialCategories }: InvoiceItemManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [categories, setCategories] = useState(initialCategories);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(initialCategories.map((c) => c.id))
  );

  // カテゴリ追加ダイアログ
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  // カテゴリ編集ダイアログ
  const [editingCategory, setEditingCategory] = useState<{ id: string; name: string } | null>(null);

  // テンプレート追加ダイアログ
  const [addingTemplateTo, setAddingTemplateTo] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState<TemplateFormData>(emptyTemplateForm);

  // テンプレート編集ダイアログ
  const [editingTemplate, setEditingTemplate] = useState<{
    id: string;
    form: TemplateFormData;
  } | null>(null);

  const toggleExpand = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // カテゴリ追加
  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;

    startTransition(async () => {
      const result = await createCategory(newCategoryName.trim());
      if (result.success && result.id) {
        setCategories((prev) => [
          ...prev,
          {
            id: result.id!,
            name: newCategoryName.trim(),
            sort_order: prev.length + 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            templates: [],
          },
        ]);
        setExpandedCategories((prev) => {
          const next = new Set(prev);
          next.add(result.id!);
          return next;
        });
        setNewCategoryName("");
        setShowAddCategory(false);
      } else {
        alert(result.error || "エラーが発生しました");
      }
    });
  };

  // カテゴリ更新
  const handleUpdateCategory = () => {
    if (!editingCategory || !editingCategory.name.trim()) return;

    startTransition(async () => {
      const result = await updateCategory(editingCategory.id, editingCategory.name.trim());
      if (result.success) {
        setCategories((prev) =>
          prev.map((c) =>
            c.id === editingCategory.id ? { ...c, name: editingCategory.name.trim() } : c
          )
        );
        setEditingCategory(null);
      } else {
        alert(result.error || "エラーが発生しました");
      }
    });
  };

  // カテゴリ削除
  const handleDeleteCategory = (id: string) => {
    startTransition(async () => {
      const result = await deleteCategory(id);
      if (result.success) {
        setCategories((prev) => prev.filter((c) => c.id !== id));
      } else {
        alert(result.error || "エラーが発生しました");
      }
    });
  };

  // カテゴリの並び替え（上へ）
  const moveCategoryUp = (index: number) => {
    if (index === 0) return;

    const newCategories = [...categories];
    [newCategories[index - 1], newCategories[index]] = [newCategories[index], newCategories[index - 1]];

    const updatedCategories = newCategories.map((cat, idx) => ({
      ...cat,
      sort_order: idx + 1,
    }));

    setCategories(updatedCategories);

    startTransition(async () => {
      await reorderCategories(updatedCategories.map((c) => ({ id: c.id, sort_order: c.sort_order })));
    });
  };

  // カテゴリの並び替え（下へ）
  const moveCategoryDown = (index: number) => {
    if (index === categories.length - 1) return;

    const newCategories = [...categories];
    [newCategories[index], newCategories[index + 1]] = [newCategories[index + 1], newCategories[index]];

    const updatedCategories = newCategories.map((cat, idx) => ({
      ...cat,
      sort_order: idx + 1,
    }));

    setCategories(updatedCategories);

    startTransition(async () => {
      await reorderCategories(updatedCategories.map((c) => ({ id: c.id, sort_order: c.sort_order })));
    });
  };

  // テンプレート追加
  const handleAddTemplate = () => {
    if (!addingTemplateTo || !templateForm.name.trim()) return;

    startTransition(async () => {
      const result = await createTemplate(addingTemplateTo, {
        name: templateForm.name.trim(),
        description: templateForm.description.trim() || null,
        default_note: templateForm.default_note.trim() || null,
        default_unit: templateForm.default_unit.trim() || null,
        default_unit_price: templateForm.default_unit_price ? Number(templateForm.default_unit_price) : null,
      });
      if (result.success && result.id) {
        setCategories((prev) =>
          prev.map((c) => {
            if (c.id !== addingTemplateTo) return c;
            return {
              ...c,
              templates: [
                ...c.templates,
                {
                  id: result.id!,
                  category_id: addingTemplateTo,
                  name: templateForm.name.trim(),
                  description: templateForm.description.trim() || null,
                  default_note: templateForm.default_note.trim() || null,
                  default_unit: templateForm.default_unit.trim() || null,
                  default_unit_price: templateForm.default_unit_price ? Number(templateForm.default_unit_price) : null,
                  sort_order: c.templates.length + 1,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
              ],
            };
          })
        );
        setTemplateForm(emptyTemplateForm);
        setAddingTemplateTo(null);
      } else {
        alert(result.error || "エラーが発生しました");
      }
    });
  };

  // テンプレート編集を開始
  const startEditTemplate = (template: InvoiceItemTemplate) => {
    setEditingTemplate({
      id: template.id,
      form: {
        name: template.name,
        description: template.description || "",
        default_note: template.default_note || "",
        default_unit: template.default_unit || "",
        default_unit_price: template.default_unit_price?.toString() || "",
      },
    });
  };

  // テンプレート更新
  const handleUpdateTemplate = () => {
    if (!editingTemplate || !editingTemplate.form.name.trim()) return;

    startTransition(async () => {
      const result = await updateTemplate(editingTemplate.id, {
        name: editingTemplate.form.name.trim(),
        description: editingTemplate.form.description.trim() || null,
        default_note: editingTemplate.form.default_note.trim() || null,
        default_unit: editingTemplate.form.default_unit.trim() || null,
        default_unit_price: editingTemplate.form.default_unit_price
          ? Number(editingTemplate.form.default_unit_price)
          : null,
      });
      if (result.success) {
        setCategories((prev) =>
          prev.map((c) => ({
            ...c,
            templates: c.templates.map((t) =>
              t.id === editingTemplate.id
                ? {
                    ...t,
                    name: editingTemplate.form.name.trim(),
                    description: editingTemplate.form.description.trim() || null,
                    default_note: editingTemplate.form.default_note.trim() || null,
                    default_unit: editingTemplate.form.default_unit.trim() || null,
                    default_unit_price: editingTemplate.form.default_unit_price
                      ? Number(editingTemplate.form.default_unit_price)
                      : null,
                  }
                : t
            ),
          }))
        );
        setEditingTemplate(null);
      } else {
        alert(result.error || "エラーが発生しました");
      }
    });
  };

  // テンプレート削除
  const handleDeleteTemplate = (templateId: string) => {
    startTransition(async () => {
      const result = await deleteTemplate(templateId);
      if (result.success) {
        setCategories((prev) =>
          prev.map((c) => ({
            ...c,
            templates: c.templates.filter((t) => t.id !== templateId),
          }))
        );
      } else {
        alert(result.error || "エラーが発生しました");
      }
    });
  };

  // テンプレートの並び替え（上へ）
  const moveTemplateUp = (categoryId: string, index: number) => {
    if (index === 0) return;

    const category = categories.find((c) => c.id === categoryId);
    if (!category) return;

    const newTemplates = [...category.templates];
    [newTemplates[index - 1], newTemplates[index]] = [newTemplates[index], newTemplates[index - 1]];

    const updatedTemplates = newTemplates.map((t, idx) => ({
      ...t,
      sort_order: idx + 1,
    }));

    setCategories((prev) =>
      prev.map((c) => (c.id === categoryId ? { ...c, templates: updatedTemplates } : c))
    );

    startTransition(async () => {
      await reorderTemplates(updatedTemplates.map((t) => ({ id: t.id, sort_order: t.sort_order })));
    });
  };

  // テンプレートの並び替え（下へ）
  const moveTemplateDown = (categoryId: string, index: number) => {
    const category = categories.find((c) => c.id === categoryId);
    if (!category || index === category.templates.length - 1) return;

    const newTemplates = [...category.templates];
    [newTemplates[index], newTemplates[index + 1]] = [newTemplates[index + 1], newTemplates[index]];

    const updatedTemplates = newTemplates.map((t, idx) => ({
      ...t,
      sort_order: idx + 1,
    }));

    setCategories((prev) =>
      prev.map((c) => (c.id === categoryId ? { ...c, templates: updatedTemplates } : c))
    );

    startTransition(async () => {
      await reorderTemplates(updatedTemplates.map((t) => ({ id: t.id, sort_order: t.sort_order })));
    });
  };

  // 金額フォーマット
  const formatPrice = (price: number | null) => {
    if (price === null) return "-";
    return price.toLocaleString() + "円";
  };

  return (
    <div className="space-y-4">
      {/* カテゴリ追加ボタン */}
      <div className="flex justify-end">
        <Button onClick={() => setShowAddCategory(true)}>
          <Plus className="h-4 w-4 mr-2" />
          新規種別
        </Button>
      </div>

      {/* カテゴリ一覧 */}
      {categories.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            種別がありません。新規種別を追加してください。
          </CardContent>
        </Card>
      ) : (
        categories.map((category, categoryIndex) => {
          const isExpanded = expandedCategories.has(category.id);

          return (
            <Card key={category.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div
                    className="flex items-center gap-2 cursor-pointer flex-1"
                    onClick={() => toggleExpand(category.id)}
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                    <CardTitle className="text-lg">{category.name}</CardTitle>
                    <span className="text-sm text-muted-foreground">
                      ({(category.templates || []).length}項目)
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* カテゴリの並び替え */}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => moveCategoryUp(categoryIndex)}
                      disabled={categoryIndex === 0}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => moveCategoryDown(categoryIndex)}
                      disabled={categoryIndex === categories.length - 1}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditingCategory({ id: category.id, name: category.name })}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {(category.templates || []).length === 0 ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>種別の削除</AlertDialogTitle>
                            <AlertDialogDescription>
                              「{category.name}」を削除しますか？
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>キャンセル</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteCategory(category.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              削除
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : (
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled
                        title="全ての項目を削除してから種別を削除してください"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {(category.templates || []).map((template, index) => (
                      <div
                        key={template.id}
                        className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex flex-col">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-5 w-5"
                            onClick={() => moveTemplateUp(category.id, index)}
                            disabled={index === 0}
                          >
                            <ChevronUp className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-5 w-5"
                            onClick={() => moveTemplateDown(category.id, index)}
                            disabled={index === (category.templates || []).length - 1}
                          >
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{template.name}</span>
                            <span className="text-sm text-muted-foreground">
                              {formatPrice(template.default_unit_price)}
                              {template.default_unit && ` / ${template.default_unit}`}
                            </span>
                          </div>
                          {template.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              説明: {template.description}
                            </p>
                          )}
                          {template.default_note && (
                            <p className="text-sm text-blue-600 mt-1">
                              備考: {template.default_note}
                            </p>
                          )}
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 flex-shrink-0"
                          onClick={() => startEditTemplate(template)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8 flex-shrink-0">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>項目の削除</AlertDialogTitle>
                              <AlertDialogDescription>
                                「{template.name}」を削除しますか？
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>キャンセル</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteTemplate(template.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                削除
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))}

                    {/* 項目追加ボタン */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => {
                        setTemplateForm(emptyTemplateForm);
                        setAddingTemplateTo(category.id);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      項目を追加
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })
      )}

      {/* カテゴリ追加ダイアログ */}
      <Dialog open={showAddCategory} onOpenChange={setShowAddCategory}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新規種別</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="種別名（例: 測量、登記、経費）"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddCategory();
              }}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddCategory(false)}>
                キャンセル
              </Button>
              <Button onClick={handleAddCategory} disabled={!newCategoryName.trim() || isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "作成"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* カテゴリ編集ダイアログ */}
      <Dialog open={!!editingCategory} onOpenChange={() => setEditingCategory(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>種別名の編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="種別名"
              value={editingCategory?.name || ""}
              onChange={(e) =>
                setEditingCategory((prev) => (prev ? { ...prev, name: e.target.value } : null))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") handleUpdateCategory();
              }}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingCategory(null)}>
                キャンセル
              </Button>
              <Button
                onClick={handleUpdateCategory}
                disabled={!editingCategory?.name.trim() || isPending}
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "更新"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* テンプレート追加ダイアログ */}
      <Dialog open={!!addingTemplateTo} onOpenChange={() => setAddingTemplateTo(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>項目を追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>項目名 *</Label>
              <Input
                placeholder="例: 分筆登記申請"
                value={templateForm.name}
                onChange={(e) => setTemplateForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>単位</Label>
                <Input
                  placeholder="例: 式、筆、件"
                  value={templateForm.default_unit}
                  onChange={(e) => setTemplateForm((prev) => ({ ...prev, default_unit: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>標準単価（円）</Label>
                <Input
                  type="number"
                  placeholder="例: 30000"
                  value={templateForm.default_unit_price}
                  onChange={(e) => setTemplateForm((prev) => ({ ...prev, default_unit_price: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>説明（社内向け）</Label>
              <Textarea
                placeholder="項目の意味や使い方の説明"
                value={templateForm.description}
                onChange={(e) => setTemplateForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>備考（顧客向け）</Label>
              <Textarea
                placeholder="請求書に表示する備考"
                value={templateForm.default_note}
                onChange={(e) => setTemplateForm((prev) => ({ ...prev, default_note: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddingTemplateTo(null)}>
                キャンセル
              </Button>
              <Button onClick={handleAddTemplate} disabled={!templateForm.name.trim() || isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "追加"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* テンプレート編集ダイアログ */}
      <Dialog open={!!editingTemplate} onOpenChange={() => setEditingTemplate(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>項目の編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>項目名 *</Label>
              <Input
                placeholder="例: 分筆登記申請"
                value={editingTemplate?.form.name || ""}
                onChange={(e) =>
                  setEditingTemplate((prev) =>
                    prev ? { ...prev, form: { ...prev.form, name: e.target.value } } : null
                  )
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>単位</Label>
                <Input
                  placeholder="例: 式、筆、件"
                  value={editingTemplate?.form.default_unit || ""}
                  onChange={(e) =>
                    setEditingTemplate((prev) =>
                      prev ? { ...prev, form: { ...prev.form, default_unit: e.target.value } } : null
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>標準単価（円）</Label>
                <Input
                  type="number"
                  placeholder="例: 30000"
                  value={editingTemplate?.form.default_unit_price || ""}
                  onChange={(e) =>
                    setEditingTemplate((prev) =>
                      prev ? { ...prev, form: { ...prev.form, default_unit_price: e.target.value } } : null
                    )
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>説明（社内向け）</Label>
              <Textarea
                placeholder="項目の意味や使い方の説明"
                value={editingTemplate?.form.description || ""}
                onChange={(e) =>
                  setEditingTemplate((prev) =>
                    prev ? { ...prev, form: { ...prev.form, description: e.target.value } } : null
                  )
                }
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>備考（顧客向け）</Label>
              <Textarea
                placeholder="請求書に表示する備考"
                value={editingTemplate?.form.default_note || ""}
                onChange={(e) =>
                  setEditingTemplate((prev) =>
                    prev ? { ...prev, form: { ...prev.form, default_note: e.target.value } } : null
                  )
                }
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingTemplate(null)}>
                キャンセル
              </Button>
              <Button
                onClick={handleUpdateTemplate}
                disabled={!editingTemplate?.form.name.trim() || isPending}
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "更新"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
