"use client";

import { useState } from "react";
import {
  type InvoiceTemplateWithCategories,
  type InvoiceItemTemplate,
} from "@/types/database";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export interface SelectedItem {
  item_template_id: string;
  category_name: string;
  name: string;
  description: string | null;
  unit: string | null;
  quantity: number;
  unit_price: number;
  amount: number;
}

interface InvoiceItemSelectorProps {
  templates: InvoiceTemplateWithCategories[];
  onAddItems: (items: SelectedItem[]) => void;
}

export function InvoiceItemSelector({
  templates,
  onAddItems,
}: InvoiceItemSelectorProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setSelectedItemIds(new Set());
  };

  const handleItemToggle = (itemId: string, checked: boolean) => {
    const newSet = new Set(selectedItemIds);
    if (checked) {
      newSet.add(itemId);
    } else {
      newSet.delete(itemId);
    }
    setSelectedItemIds(newSet);
  };

  const handleAddSelected = () => {
    if (!selectedTemplate || selectedItemIds.size === 0) return;

    const items: SelectedItem[] = [];

    for (const category of selectedTemplate.categories) {
      for (const item of category.items) {
        if (selectedItemIds.has(item.id)) {
          items.push({
            item_template_id: item.id,
            category_name: category.name,
            name: item.name,
            description: item.description,
            unit: item.default_unit,
            quantity: 1,
            unit_price: item.default_unit_price || 0,
            amount: item.default_unit_price || 0,
          });
        }
      }
    }

    onAddItems(items);
    setSelectedItemIds(new Set());
  };

  const getAllItemsInTemplate = (): InvoiceItemTemplate[] => {
    if (!selectedTemplate) return [];
    return selectedTemplate.categories.flatMap((c) => c.items);
  };

  const handleSelectAll = () => {
    const allItems = getAllItemsInTemplate();
    setSelectedItemIds(new Set(allItems.map((item) => item.id)));
  };

  const handleDeselectAll = () => {
    setSelectedItemIds(new Set());
  };

  if (templates.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-4 border rounded-md bg-muted/50">
        テンプレートが登録されていません。
        設定画面から見積・請求テンプレートを作成してください。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="テンプレートを選択" />
          </SelectTrigger>
          <SelectContent>
            {templates.map((template) => (
              <SelectItem key={template.id} value={template.id}>
                {template.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddSelected}
          disabled={selectedItemIds.size === 0}
        >
          選択項目を追加
        </Button>
      </div>

      {selectedTemplate && (
        <div className="border rounded-md p-4 space-y-4 max-h-[300px] overflow-y-auto">
          <div className="flex items-center gap-2 pb-2 border-b">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
            >
              すべて選択
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDeselectAll}
            >
              選択解除
            </Button>
          </div>

          {selectedTemplate.categories.map((category) => (
            <div key={category.id} className="space-y-2">
              <h4 className="font-medium text-sm text-muted-foreground">
                {category.name}
              </h4>
              <div className="space-y-1 pl-2">
                {category.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 py-1"
                  >
                    <Checkbox
                      id={`item-${item.id}`}
                      checked={selectedItemIds.has(item.id)}
                      onCheckedChange={(checked) =>
                        handleItemToggle(item.id, checked as boolean)
                      }
                    />
                    <Label
                      htmlFor={`item-${item.id}`}
                      className="flex-1 cursor-pointer text-sm"
                    >
                      {item.name}
                    </Label>
                    <span className="text-sm text-muted-foreground">
                      {item.default_unit && `${item.default_unit} × `}
                      {item.default_unit_price?.toLocaleString() || 0}円
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
