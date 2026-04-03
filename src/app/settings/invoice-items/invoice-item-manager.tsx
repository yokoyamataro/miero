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
  FileText,
} from "lucide-react";
import type {
  InvoiceTemplateWithCategories,
  InvoiceItemCategoryWithItems,
  InvoiceItemTemplate,
} from "@/types/database";
import {
  createInvoiceTemplate,
  updateInvoiceTemplate,
  deleteInvoiceTemplate,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
  createItem,
  updateItem,
  deleteItem,
  reorderItems,
} from "./actions";

interface InvoiceItemManagerProps {
  templates: InvoiceTemplateWithCategories[];
}

interface ItemFormData {
  name: string;
  description: string;
  default_unit: string;
  default_unit_price: string;
}

const emptyItemForm: ItemFormData = {
  name: "",
  description: "",
  default_unit: "",
  default_unit_price: "",
};

export function InvoiceItemManager({ templates: initialTemplates }: InvoiceItemManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [templates, setTemplates] = useState(initialTemplates);
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(
    new Set(initialTemplates.map((t) => t.id))
  );
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(initialTemplates.flatMap((t) => t.categories.map((c) => c.id)))
  );

  // テンプレート追加ダイアログ
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");

  // テンプレート編集ダイアログ
  const [editingTemplate, setEditingTemplate] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // カテゴリ追加ダイアログ
  const [addingCategoryTo, setAddingCategoryTo] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");

  // カテゴリ編集ダイアログ
  const [editingCategory, setEditingCategory] = useState<{ id: string; name: string } | null>(null);

  // 項目追加ダイアログ
  const [addingItemTo, setAddingItemTo] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<ItemFormData>(emptyItemForm);

  // 項目編集ダイアログ
  const [editingItem, setEditingItem] = useState<{
    id: string;
    form: ItemFormData;
  } | null>(null);

  const toggleTemplateExpand = (templateId: string) => {
    setExpandedTemplates((prev) => {
      const next = new Set(prev);
      if (next.has(templateId)) {
        next.delete(templateId);
      } else {
        next.add(templateId);
      }
      return next;
    });
  };

  const toggleCategoryExpand = (categoryId: string) => {
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

  // テンプレート追加
  const handleAddTemplate = () => {
    if (!newTemplateName.trim()) return;

    startTransition(async () => {
      const result = await createInvoiceTemplate(newTemplateName.trim());
      if (result.success && result.id) {
        setTemplates((prev) => [
          ...prev,
          {
            id: result.id!,
            name: newTemplateName.trim(),
            sort_order: prev.length + 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            categories: [],
          },
        ]);
        setExpandedTemplates((prev) => {
          const next = new Set(prev);
          next.add(result.id!);
          return next;
        });
        setNewTemplateName("");
        setShowAddTemplate(false);
      } else {
        alert(result.error || "エラーが発生しました");
      }
    });
  };

  // テンプレート更新
  const handleUpdateTemplate = () => {
    if (!editingTemplate || !editingTemplate.name.trim()) return;

    startTransition(async () => {
      const result = await updateInvoiceTemplate(
        editingTemplate.id,
        editingTemplate.name.trim()
      );
      if (result.success) {
        setTemplates((prev) =>
          prev.map((t) =>
            t.id === editingTemplate.id
              ? { ...t, name: editingTemplate.name.trim() }
              : t
          )
        );
        setEditingTemplate(null);
      } else {
        alert(result.error || "エラーが発生しました");
      }
    });
  };

  // テンプレート削除
  const handleDeleteTemplate = (id: string) => {
    startTransition(async () => {
      const result = await deleteInvoiceTemplate(id);
      if (result.success) {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
      } else {
        alert(result.error || "エラーが発生しました");
      }
    });
  };

  // カテゴリ追加
  const handleAddCategory = () => {
    if (!addingCategoryTo || !newCategoryName.trim()) return;

    startTransition(async () => {
      const result = await createCategory(addingCategoryTo, newCategoryName.trim());
      if (result.success && result.id) {
        setTemplates((prev) =>
          prev.map((t) => {
            if (t.id !== addingCategoryTo) return t;
            return {
              ...t,
              categories: [
                ...t.categories,
                {
                  id: result.id!,
                  template_id: addingCategoryTo,
                  name: newCategoryName.trim(),
                  sort_order: t.categories.length + 1,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  items: [],
                },
              ],
            };
          })
        );
        setExpandedCategories((prev) => {
          const next = new Set(prev);
          next.add(result.id!);
          return next;
        });
        setNewCategoryName("");
        setAddingCategoryTo(null);
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
        setTemplates((prev) =>
          prev.map((t) => ({
            ...t,
            categories: t.categories.map((c) =>
              c.id === editingCategory.id ? { ...c, name: editingCategory.name.trim() } : c
            ),
          }))
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
        setTemplates((prev) =>
          prev.map((t) => ({
            ...t,
            categories: t.categories.filter((c) => c.id !== id),
          }))
        );
      } else {
        alert(result.error || "エラーが発生しました");
      }
    });
  };

  // カテゴリの並び替え
  const moveCategoryUp = (templateId: string, index: number) => {
    if (index === 0) return;

    const template = templates.find((t) => t.id === templateId);
    if (!template) return;

    const newCategories = [...template.categories];
    [newCategories[index - 1], newCategories[index]] = [newCategories[index], newCategories[index - 1]];

    const updatedCategories = newCategories.map((c, idx) => ({
      ...c,
      sort_order: idx + 1,
    }));

    setTemplates((prev) =>
      prev.map((t) => (t.id === templateId ? { ...t, categories: updatedCategories } : t))
    );

    startTransition(async () => {
      await reorderCategories(updatedCategories.map((c) => ({ id: c.id, sort_order: c.sort_order })));
    });
  };

  const moveCategoryDown = (templateId: string, index: number) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template || index === template.categories.length - 1) return;

    const newCategories = [...template.categories];
    [newCategories[index], newCategories[index + 1]] = [newCategories[index + 1], newCategories[index]];

    const updatedCategories = newCategories.map((c, idx) => ({
      ...c,
      sort_order: idx + 1,
    }));

    setTemplates((prev) =>
      prev.map((t) => (t.id === templateId ? { ...t, categories: updatedCategories } : t))
    );

    startTransition(async () => {
      await reorderCategories(updatedCategories.map((c) => ({ id: c.id, sort_order: c.sort_order })));
    });
  };

  // 項目追加
  const handleAddItem = () => {
    if (!addingItemTo || !itemForm.name.trim()) return;

    startTransition(async () => {
      const result = await createItem(addingItemTo, {
        name: itemForm.name.trim(),
        description: itemForm.description.trim() || null,
        default_unit: itemForm.default_unit.trim() || null,
        default_unit_price: itemForm.default_unit_price ? Number(itemForm.default_unit_price) : null,
      });
      if (result.success && result.id) {
        setTemplates((prev) =>
          prev.map((t) => ({
            ...t,
            categories: t.categories.map((c) => {
              if (c.id !== addingItemTo) return c;
              return {
                ...c,
                items: [
                  ...c.items,
                  {
                    id: result.id!,
                    category_id: addingItemTo,
                    name: itemForm.name.trim(),
                    description: itemForm.description.trim() || null,
                    default_unit: itemForm.default_unit.trim() || null,
                    default_unit_price: itemForm.default_unit_price ? Number(itemForm.default_unit_price) : null,
                    sort_order: c.items.length + 1,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  },
                ],
              };
            }),
          }))
        );
        setItemForm(emptyItemForm);
        setAddingItemTo(null);
      } else {
        alert(result.error || "エラーが発生しました");
      }
    });
  };

  // 項目編集開始
  const startEditItem = (item: InvoiceItemTemplate) => {
    setEditingItem({
      id: item.id,
      form: {
        name: item.name,
        description: item.description || "",
        default_unit: item.default_unit || "",
        default_unit_price: item.default_unit_price?.toString() || "",
      },
    });
  };

  // 項目更新
  const handleUpdateItem = () => {
    if (!editingItem || !editingItem.form.name.trim()) return;

    startTransition(async () => {
      const result = await updateItem(editingItem.id, {
        name: editingItem.form.name.trim(),
        description: editingItem.form.description.trim() || null,
        default_unit: editingItem.form.default_unit.trim() || null,
        default_unit_price: editingItem.form.default_unit_price
          ? Number(editingItem.form.default_unit_price)
          : null,
      });
      if (result.success) {
        setTemplates((prev) =>
          prev.map((t) => ({
            ...t,
            categories: t.categories.map((c) => ({
              ...c,
              items: c.items.map((item) =>
                item.id === editingItem.id
                  ? {
                      ...item,
                      name: editingItem.form.name.trim(),
                      description: editingItem.form.description.trim() || null,
                      default_unit: editingItem.form.default_unit.trim() || null,
                      default_unit_price: editingItem.form.default_unit_price
                        ? Number(editingItem.form.default_unit_price)
                        : null,
                    }
                  : item
              ),
            })),
          }))
        );
        setEditingItem(null);
      } else {
        alert(result.error || "エラーが発生しました");
      }
    });
  };

  // 項目削除
  const handleDeleteItem = (itemId: string) => {
    startTransition(async () => {
      const result = await deleteItem(itemId);
      if (result.success) {
        setTemplates((prev) =>
          prev.map((t) => ({
            ...t,
            categories: t.categories.map((c) => ({
              ...c,
              items: c.items.filter((item) => item.id !== itemId),
            })),
          }))
        );
      } else {
        alert(result.error || "エラーが発生しました");
      }
    });
  };

  // 項目の並び替え
  const moveItemUp = (categoryId: string, index: number) => {
    if (index === 0) return;

    let category: InvoiceItemCategoryWithItems | undefined;
    for (const t of templates) {
      category = t.categories.find((c) => c.id === categoryId);
      if (category) break;
    }
    if (!category) return;

    const newItems = [...category.items];
    [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];

    const updatedItems = newItems.map((item, idx) => ({
      ...item,
      sort_order: idx + 1,
    }));

    setTemplates((prev) =>
      prev.map((t) => ({
        ...t,
        categories: t.categories.map((c) =>
          c.id === categoryId ? { ...c, items: updatedItems } : c
        ),
      }))
    );

    startTransition(async () => {
      await reorderItems(updatedItems.map((item) => ({ id: item.id, sort_order: item.sort_order })));
    });
  };

  const moveItemDown = (categoryId: string, index: number) => {
    let category: InvoiceItemCategoryWithItems | undefined;
    for (const t of templates) {
      category = t.categories.find((c) => c.id === categoryId);
      if (category) break;
    }
    if (!category || index === category.items.length - 1) return;

    const newItems = [...category.items];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];

    const updatedItems = newItems.map((item, idx) => ({
      ...item,
      sort_order: idx + 1,
    }));

    setTemplates((prev) =>
      prev.map((t) => ({
        ...t,
        categories: t.categories.map((c) =>
          c.id === categoryId ? { ...c, items: updatedItems } : c
        ),
      }))
    );

    startTransition(async () => {
      await reorderItems(updatedItems.map((item) => ({ id: item.id, sort_order: item.sort_order })));
    });
  };

  // 金額フォーマット
  const formatPrice = (price: number | null) => {
    if (price === null) return "-";
    return price.toLocaleString() + "円";
  };

  return (
    <div className="space-y-4">
      {/* テンプレート追加ボタン */}
      <div className="flex justify-end">
        <Button onClick={() => setShowAddTemplate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          新規テンプレート
        </Button>
      </div>

      {/* テンプレート一覧 */}
      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            テンプレートがありません。新規テンプレートを追加してください。
          </CardContent>
        </Card>
      ) : (
        templates.map((template) => {
          const isTemplateExpanded = expandedTemplates.has(template.id);
          const totalCategories = template.categories.length;
          const totalItems = template.categories.reduce((sum, c) => sum + c.items.length, 0);

          return (
            <Card key={template.id} className="border-2">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div
                    className="flex items-center gap-2 cursor-pointer flex-1"
                    onClick={() => toggleTemplateExpand(template.id)}
                  >
                    {isTemplateExpanded ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                    <FileText className="h-5 w-5 text-blue-500" />
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <span className="text-sm text-muted-foreground">
                      ({totalCategories}種別 / {totalItems}項目)
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        setEditingTemplate({
                          id: template.id,
                          name: template.name,
                        })
                      }
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {totalCategories === 0 ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>テンプレートの削除</AlertDialogTitle>
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
                    ) : (
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled
                        title="全ての種別を削除してからテンプレートを削除してください"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              {isTemplateExpanded && (
                <CardContent className="pt-0 pl-8">
                  <div className="space-y-3">
                    {/* カテゴリ一覧 */}
                    {template.categories.map((category, categoryIndex) => {
                      const isCategoryExpanded = expandedCategories.has(category.id);

                      return (
                        <div key={category.id} className="border rounded-lg bg-muted/30">
                          <div className="flex items-center justify-between p-2">
                            <div
                              className="flex items-center gap-2 cursor-pointer flex-1"
                              onClick={() => toggleCategoryExpand(category.id)}
                            >
                              {isCategoryExpanded ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="font-medium">{category.name}</span>
                              <span className="text-sm text-muted-foreground">
                                ({category.items.length}項目)
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => moveCategoryUp(template.id, categoryIndex)}
                                disabled={categoryIndex === 0}
                              >
                                <ChevronUp className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => moveCategoryDown(template.id, categoryIndex)}
                                disabled={categoryIndex === template.categories.length - 1}
                              >
                                <ChevronDown className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() =>
                                  setEditingCategory({ id: category.id, name: category.name })
                                }
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              {category.items.length === 0 ? (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-7 w-7">
                                      <Trash2 className="h-3 w-3 text-destructive" />
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
                                  className="h-7 w-7"
                                  disabled
                                  title="全ての項目を削除してから種別を削除してください"
                                >
                                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                                </Button>
                              )}
                            </div>
                          </div>

                          {isCategoryExpanded && (
                            <div className="px-3 pb-3 space-y-2">
                              {category.items.map((item, itemIndex) => (
                                <div
                                  key={item.id}
                                  className="flex items-start gap-2 p-2 bg-background rounded border"
                                >
                                  <div className="flex flex-col">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-5 w-5"
                                      onClick={() => moveItemUp(category.id, itemIndex)}
                                      disabled={itemIndex === 0}
                                    >
                                      <ChevronUp className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-5 w-5"
                                      onClick={() => moveItemDown(category.id, itemIndex)}
                                      disabled={itemIndex === category.items.length - 1}
                                    >
                                      <ChevronDown className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-sm">{item.name}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {formatPrice(item.default_unit_price)}
                                        {item.default_unit && ` / ${item.default_unit}`}
                                      </span>
                                    </div>
                                    {item.description && (
                                      <p className="text-xs text-muted-foreground mt-0.5">
                                        説明: {item.description}
                                      </p>
                                    )}
                                  </div>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 flex-shrink-0"
                                    onClick={() => startEditItem(item)}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button size="icon" variant="ghost" className="h-7 w-7 flex-shrink-0">
                                        <Trash2 className="h-3 w-3 text-destructive" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>項目の削除</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          「{item.name}」を削除しますか？
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleDeleteItem(item.id)}
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
                                className="w-full"
                                onClick={() => {
                                  setItemForm(emptyItemForm);
                                  setAddingItemTo(category.id);
                                }}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                項目を追加
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* 種別追加ボタン */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setNewCategoryName("");
                        setAddingCategoryTo(template.id);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      種別を追加
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })
      )}

      {/* テンプレート追加ダイアログ */}
      <Dialog open={showAddTemplate} onOpenChange={setShowAddTemplate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新規テンプレート</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>テンプレート名</Label>
              <Input
                placeholder="例: 土地測量用、登記用、建設業者用"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddTemplate(false)}>
                キャンセル
              </Button>
              <Button onClick={handleAddTemplate} disabled={!newTemplateName.trim() || isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "作成"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* テンプレート編集ダイアログ */}
      <Dialog open={!!editingTemplate} onOpenChange={() => setEditingTemplate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>テンプレートの編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>テンプレート名</Label>
              <Input
                placeholder="テンプレート名"
                value={editingTemplate?.name || ""}
                onChange={(e) =>
                  setEditingTemplate((prev) => (prev ? { ...prev, name: e.target.value } : null))
                }
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingTemplate(null)}>
                キャンセル
              </Button>
              <Button
                onClick={handleUpdateTemplate}
                disabled={!editingTemplate?.name.trim() || isPending}
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "更新"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* カテゴリ追加ダイアログ */}
      <Dialog open={!!addingCategoryTo} onOpenChange={() => setAddingCategoryTo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>種別を追加</DialogTitle>
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
              <Button variant="outline" onClick={() => setAddingCategoryTo(null)}>
                キャンセル
              </Button>
              <Button onClick={handleAddCategory} disabled={!newCategoryName.trim() || isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "追加"}
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

      {/* 項目追加ダイアログ */}
      <Dialog open={!!addingItemTo} onOpenChange={() => setAddingItemTo(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>項目を追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>項目名 *</Label>
              <Input
                placeholder="例: 分筆登記申請"
                value={itemForm.name}
                onChange={(e) => setItemForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>単位</Label>
                <Input
                  placeholder="例: 式、筆、件"
                  value={itemForm.default_unit}
                  onChange={(e) => setItemForm((prev) => ({ ...prev, default_unit: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>標準単価（円）</Label>
                <Input
                  type="number"
                  placeholder="例: 30000"
                  value={itemForm.default_unit_price}
                  onChange={(e) => setItemForm((prev) => ({ ...prev, default_unit_price: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>説明（社内向け）</Label>
              <Textarea
                placeholder="項目の意味や使い方の説明"
                value={itemForm.description}
                onChange={(e) => setItemForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddingItemTo(null)}>
                キャンセル
              </Button>
              <Button onClick={handleAddItem} disabled={!itemForm.name.trim() || isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "追加"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 項目編集ダイアログ */}
      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>項目の編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>項目名 *</Label>
              <Input
                placeholder="例: 分筆登記申請"
                value={editingItem?.form.name || ""}
                onChange={(e) =>
                  setEditingItem((prev) =>
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
                  value={editingItem?.form.default_unit || ""}
                  onChange={(e) =>
                    setEditingItem((prev) =>
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
                  value={editingItem?.form.default_unit_price || ""}
                  onChange={(e) =>
                    setEditingItem((prev) =>
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
                value={editingItem?.form.description || ""}
                onChange={(e) =>
                  setEditingItem((prev) =>
                    prev ? { ...prev, form: { ...prev.form, description: e.target.value } } : null
                  )
                }
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingItem(null)}>
                キャンセル
              </Button>
              <Button
                onClick={handleUpdateItem}
                disabled={!editingItem?.form.name.trim() || isPending}
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
