"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, GripVertical, Pencil } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type EventCategory, DEFAULT_CATEGORY_COLORS } from "@/types/database";
import {
  createEventCategory,
  updateEventCategory,
  deleteEventCategory,
  reorderEventCategories,
} from "../actions";

interface CategorySettingsProps {
  initialCategories: EventCategory[];
}

function SortableCategoryItem({
  category,
  onEdit,
  onDelete,
}: {
  category: EventCategory;
  onEdit: (category: EventCategory) => void;
  onDelete: (category: EventCategory) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 border rounded-lg bg-background"
    >
      <button
        {...attributes}
        {...listeners}
        className="flex-shrink-0 p-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        title="ドラッグして並び替え"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className={`w-6 h-6 rounded ${category.color}`} />

      <span className="flex-1 font-medium">{category.name}</span>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => onEdit(category)}
        className="h-8 w-8 p-0"
      >
        <Pencil className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => onDelete(category)}
        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="grid grid-cols-6 gap-2">
      {DEFAULT_CATEGORY_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className={`w-8 h-8 rounded ${color} ${
            value === color ? "ring-2 ring-offset-2 ring-primary" : ""
          }`}
        />
      ))}
    </div>
  );
}

export function CategorySettings({ initialCategories }: CategorySettingsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [categories, setCategories] = useState(initialCategories);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<EventCategory | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_CATEGORY_COLORS[0]);
  const [error, setError] = useState("");

  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setCategories((items) => {
        const oldIndex = items.findIndex((c) => c.id === active.id);
        const newIndex = items.findIndex((c) => c.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);

        startTransition(async () => {
          const categoryOrders = newItems.map((category, index) => ({
            id: category.id,
            sort_order: index,
          }));
          await reorderEventCategories(categoryOrders);
          router.refresh();
        });

        return newItems;
      });
    }
  };

  const openCreateModal = () => {
    setEditingCategory(null);
    setName("");
    setColor(DEFAULT_CATEGORY_COLORS[0]);
    setError("");
    setShowModal(true);
  };

  const openEditModal = (category: EventCategory) => {
    setEditingCategory(category);
    setName(category.name);
    setColor(category.color);
    setError("");
    setShowModal(true);
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      setError("名前を入力してください");
      return;
    }

    startTransition(async () => {
      if (editingCategory) {
        const result = await updateEventCategory(editingCategory.id, {
          name: name.trim(),
          color,
        });
        if (result.error) {
          setError(result.error);
          return;
        }
      } else {
        const result = await createEventCategory({
          name: name.trim(),
          color,
        });
        if (result.error) {
          setError(result.error);
          return;
        }
      }

      setShowModal(false);
      router.refresh();
    });
  };

  const handleDelete = (category: EventCategory) => {
    if (!confirm(`「${category.name}」を削除しますか？`)) return;

    startTransition(async () => {
      const result = await deleteEventCategory(category.id);
      if (result.error) {
        alert(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>イベント区分</CardTitle>
            <Button onClick={openCreateModal} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              追加
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {categories.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              区分がありません
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={categories.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                {categories.map((category) => (
                  <SortableCategoryItem
                    key={category.id}
                    category={category}
                    onEdit={openEditModal}
                    onDelete={handleDelete}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "区分を編集" : "区分を追加"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">名前</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 打ち合わせ"
              />
            </div>

            <div className="space-y-2">
              <Label>色</Label>
              <ColorPicker value={color} onChange={setColor} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
