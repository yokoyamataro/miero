"use client";

import { useState } from "react";
import {
  type InvoiceTemplateWithCategories,
} from "@/types/database";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

interface ItemInput {
  id: string;
  category_name: string;
  name: string;
  description: string | null;
  default_unit: string | null;
  default_unit_price: number | null;
  quantity: number;
  note: string;
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
  const [itemInputs, setItemInputs] = useState<ItemInput[]>([]);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);

    const template = templates.find((t) => t.id === templateId);
    if (template) {
      // 全項目を初期化（数量1、備考なし）
      const inputs: ItemInput[] = [];
      for (const category of template.categories) {
        for (const item of category.items) {
          inputs.push({
            id: item.id,
            category_name: category.name,
            name: item.name,
            description: item.description,
            default_unit: item.default_unit,
            default_unit_price: item.default_unit_price,
            quantity: 1,
            note: "",
          });
        }
      }
      setItemInputs(inputs);
    } else {
      setItemInputs([]);
    }
  };

  const handleQuantityChange = (itemId: string, quantity: number) => {
    setItemInputs((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, quantity } : item
      )
    );
  };

  const handleNoteChange = (itemId: string, note: string) => {
    setItemInputs((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, note } : item
      )
    );
  };

  const handleAddAll = () => {
    if (itemInputs.length === 0) return;

    const items: SelectedItem[] = itemInputs.map((input) => {
      const unitPrice = input.default_unit_price || 0;
      const quantity = input.quantity;
      return {
        item_template_id: input.id,
        category_name: input.category_name,
        name: input.name,
        description: input.note || input.description,
        unit: input.default_unit,
        quantity,
        unit_price: unitPrice,
        amount: Math.floor(quantity * unitPrice),
      };
    });

    onAddItems(items);
    // リセット
    setSelectedTemplateId("");
    setItemInputs([]);
  };

  if (templates.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-4 border rounded-md bg-muted/50">
        テンプレートが登録されていません。
        設定画面から見積・請求テンプレートを作成してください。
      </div>
    );
  }

  // カテゴリ別にグループ化
  const groupedInputs: { category: string; items: ItemInput[] }[] = [];
  for (const input of itemInputs) {
    const existing = groupedInputs.find((g) => g.category === input.category_name);
    if (existing) {
      existing.items.push(input);
    } else {
      groupedInputs.push({ category: input.category_name, items: [input] });
    }
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
        {itemInputs.length > 0 && (
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleAddAll}
          >
            全{itemInputs.length}項目を追加
          </Button>
        )}
      </div>

      {selectedTemplate && itemInputs.length > 0 && (
        <div className="border rounded-md p-4 space-y-4 max-h-[400px] overflow-y-auto">
          {groupedInputs.map((group) => (
            <div key={group.category} className="space-y-2">
              <h4 className="font-medium text-sm text-muted-foreground border-b pb-1">
                {group.category}
              </h4>
              <div className="space-y-2">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-[1fr_80px_1fr] gap-2 items-center py-1"
                  >
                    <div className="text-sm">
                      <span>{item.name}</span>
                      <span className="text-muted-foreground ml-2">
                        {item.default_unit && `(${item.default_unit})`}
                        {item.default_unit_price
                          ? ` ×${item.default_unit_price.toLocaleString()}円`
                          : ""}
                      </span>
                    </div>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) =>
                        handleQuantityChange(item.id, parseFloat(e.target.value) || 0)
                      }
                      className="h-8 text-right"
                      min={0}
                      step={0.01}
                      placeholder="数量"
                    />
                    <Input
                      value={item.note}
                      onChange={(e) => handleNoteChange(item.id, e.target.value)}
                      className="h-8"
                      placeholder="備考"
                    />
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
