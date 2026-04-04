"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  GripVertical,
  Loader2,
} from "lucide-react";
import type { StandardTaskTemplateWithItems, StandardTaskItem } from "@/types/database";
import {
  createTemplate,
  updateTemplate,
  deleteTemplate,
  createItem,
  updateItem,
  deleteItem,
  reorderItems,
  reorderTemplates,
} from "./actions";

interface StandardTaskManagerProps {
  templates: StandardTaskTemplateWithItems[];
}

export function StandardTaskManager({ templates: initialTemplates }: StandardTaskManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [templates, setTemplates] = useState(initialTemplates);
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(
    new Set(initialTemplates.map((t) => t.id))
  );

  // テンプレート追加ダイアログ
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");

  // テンプレート編集ダイアログ
  const [editingTemplate, setEditingTemplate] = useState<{ id: string; name: string } | null>(null);

  // 項目追加ダイアログ
  const [addingItemTo, setAddingItemTo] = useState<string | null>(null);
  const [newItemTitle, setNewItemTitle] = useState("");

  // 項目編集ダイアログ
  const [editingItem, setEditingItem] = useState<{ id: string; title: string } | null>(null);

  const toggleExpand = (templateId: string) => {
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

  // テンプレート追加
  const handleAddTemplate = () => {
    if (!newTemplateName.trim()) return;

    startTransition(async () => {
      const result = await createTemplate(newTemplateName.trim());
      if (result.success && result.id) {
        setTemplates((prev) => [
          ...prev,
          {
            id: result.id!,
            name: newTemplateName.trim(),
            sort_order: prev.length + 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            items: [],
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
      const result = await updateTemplate(editingTemplate.id, editingTemplate.name.trim());
      if (result.success) {
        setTemplates((prev) =>
          prev.map((t) =>
            t.id === editingTemplate.id ? { ...t, name: editingTemplate.name.trim() } : t
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
      const result = await deleteTemplate(id);
      if (result.success) {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
      } else {
        alert(result.error || "エラーが発生しました");
      }
    });
  };

  // 項目追加
  const handleAddItem = () => {
    if (!addingItemTo || !newItemTitle.trim()) return;

    startTransition(async () => {
      const result = await createItem(addingItemTo, newItemTitle.trim());
      if (result.success && result.id) {
        setTemplates((prev) =>
          prev.map((t) => {
            if (t.id !== addingItemTo) return t;
            return {
              ...t,
              items: [
                ...t.items,
                {
                  id: result.id!,
                  template_id: addingItemTo,
                  title: newItemTitle.trim(),
                  sort_order: t.items.length + 1,
                  created_at: new Date().toISOString(),
                },
              ],
            };
          })
        );
        setNewItemTitle("");
        setAddingItemTo(null);
      } else {
        alert(result.error || "エラーが発生しました");
      }
    });
  };

  // 項目更新
  const handleUpdateItem = () => {
    if (!editingItem || !editingItem.title.trim()) return;

    startTransition(async () => {
      const result = await updateItem(editingItem.id, editingItem.title.trim());
      if (result.success) {
        setTemplates((prev) =>
          prev.map((t) => ({
            ...t,
            items: t.items.map((item) =>
              item.id === editingItem.id ? { ...item, title: editingItem.title.trim() } : item
            ),
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
            items: t.items.filter((item) => item.id !== itemId),
          }))
        );
      } else {
        alert(result.error || "エラーが発生しました");
      }
    });
  };

  // テンプレートの並び替え（上へ）
  const moveTemplateUp = (templateIndex: number) => {
    if (templateIndex === 0) return;

    const newTemplates = [...templates];
    [newTemplates[templateIndex - 1], newTemplates[templateIndex]] = [
      newTemplates[templateIndex],
      newTemplates[templateIndex - 1],
    ];

    // sort_orderを更新
    const updatedTemplates = newTemplates.map((t, idx) => ({
      ...t,
      sort_order: idx + 1,
    }));

    setTemplates(updatedTemplates);

    startTransition(async () => {
      await reorderTemplates(
        updatedTemplates.map((t) => ({ id: t.id, sort_order: t.sort_order }))
      );
    });
  };

  // テンプレートの並び替え（下へ）
  const moveTemplateDown = (templateIndex: number) => {
    if (templateIndex === templates.length - 1) return;

    const newTemplates = [...templates];
    [newTemplates[templateIndex], newTemplates[templateIndex + 1]] = [
      newTemplates[templateIndex + 1],
      newTemplates[templateIndex],
    ];

    // sort_orderを更新
    const updatedTemplates = newTemplates.map((t, idx) => ({
      ...t,
      sort_order: idx + 1,
    }));

    setTemplates(updatedTemplates);

    startTransition(async () => {
      await reorderTemplates(
        updatedTemplates.map((t) => ({ id: t.id, sort_order: t.sort_order }))
      );
    });
  };

  // 項目の並び替え（上へ）
  const moveItemUp = (templateId: string, itemIndex: number) => {
    if (itemIndex === 0) return;

    const template = templates.find((t) => t.id === templateId);
    if (!template) return;

    const newItems = [...template.items];
    [newItems[itemIndex - 1], newItems[itemIndex]] = [newItems[itemIndex], newItems[itemIndex - 1]];

    // sort_orderを更新
    const updatedItems = newItems.map((item, idx) => ({
      ...item,
      sort_order: idx + 1,
    }));

    setTemplates((prev) =>
      prev.map((t) => (t.id === templateId ? { ...t, items: updatedItems } : t))
    );

    startTransition(async () => {
      await reorderItems(updatedItems.map((item) => ({ id: item.id, sort_order: item.sort_order })));
    });
  };

  // 項目の並び替え（下へ）
  const moveItemDown = (templateId: string, itemIndex: number) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template || itemIndex === template.items.length - 1) return;

    const newItems = [...template.items];
    [newItems[itemIndex], newItems[itemIndex + 1]] = [newItems[itemIndex + 1], newItems[itemIndex]];

    // sort_orderを更新
    const updatedItems = newItems.map((item, idx) => ({
      ...item,
      sort_order: idx + 1,
    }));

    setTemplates((prev) =>
      prev.map((t) => (t.id === templateId ? { ...t, items: updatedItems } : t))
    );

    startTransition(async () => {
      await reorderItems(updatedItems.map((item) => ({ id: item.id, sort_order: item.sort_order })));
    });
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
        templates.map((template, templateIndex) => {
          const isExpanded = expandedTemplates.has(template.id);

          return (
            <Card key={template.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {/* テンプレート並べ替えボタン */}
                    <div className="flex flex-col">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5"
                        onClick={() => moveTemplateUp(templateIndex)}
                        disabled={templateIndex === 0}
                      >
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5"
                        onClick={() => moveTemplateDown(templateIndex)}
                        disabled={templateIndex === templates.length - 1}
                      >
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </div>
                    <div
                      className="flex items-center gap-2 cursor-pointer flex-1"
                      onClick={() => toggleExpand(template.id)}
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <span className="text-sm text-muted-foreground">
                        ({(template.items || []).length}項目)
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditingTemplate({ id: template.id, name: template.name })}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {(template.items || []).length === 0 ? (
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
                              既にプロジェクトに割り当てられている場合、その進捗データも削除されます。
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
                        title="全ての項目を削除してからテンプレートを削除してください"
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
                    {(template.items || []).map((item, index) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg"
                      >
                        <div className="flex flex-col">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-5 w-5"
                            onClick={() => moveItemUp(template.id, index)}
                            disabled={index === 0}
                          >
                            <ChevronUp className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-5 w-5"
                            onClick={() => moveItemDown(template.id, index)}
                            disabled={index === (template.items || []).length - 1}
                          >
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </div>
                        <span className="text-sm text-muted-foreground w-6">
                          {index + 1}.
                        </span>
                        <span className="flex-1">{item.title}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => setEditingItem({ id: item.id, title: item.title })}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>項目の削除</AlertDialogTitle>
                              <AlertDialogDescription>
                                「{item.title}」を削除しますか？
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
                      className="w-full mt-2"
                      onClick={() => setAddingItemTo(template.id)}
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

      {/* テンプレート追加ダイアログ */}
      <Dialog open={showAddTemplate} onOpenChange={setShowAddTemplate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新規テンプレート</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="テンプレート名（例: 分筆登記）"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddTemplate();
              }}
            />
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
            <DialogTitle>テンプレート名の編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="テンプレート名"
              value={editingTemplate?.name || ""}
              onChange={(e) =>
                setEditingTemplate((prev) => (prev ? { ...prev, name: e.target.value } : null))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") handleUpdateTemplate();
              }}
            />
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

      {/* 項目追加ダイアログ */}
      <Dialog open={!!addingItemTo} onOpenChange={() => setAddingItemTo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>項目を追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="項目名（例: 見積、受託、資料調査）"
              value={newItemTitle}
              onChange={(e) => setNewItemTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddItem();
              }}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddingItemTo(null)}>
                キャンセル
              </Button>
              <Button onClick={handleAddItem} disabled={!newItemTitle.trim() || isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "追加"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 項目編集ダイアログ */}
      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>項目名の編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="項目名"
              value={editingItem?.title || ""}
              onChange={(e) =>
                setEditingItem((prev) => (prev ? { ...prev, title: e.target.value } : null))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") handleUpdateItem();
              }}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingItem(null)}>
                キャンセル
              </Button>
              <Button onClick={handleUpdateItem} disabled={!editingItem?.title.trim() || isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "更新"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
