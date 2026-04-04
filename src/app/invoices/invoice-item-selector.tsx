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
import { Minus } from "lucide-react";

export interface SelectedItem {
  item_template_id: string | null;
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
  quantity: number;
  unit_price: number;
  note: string;
  isDiscount?: boolean;
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
  const [discountAmount, setDiscountAmount] = useState<number>(0);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);

    const template = templates.find((t) => t.id === templateId);
    if (template) {
      // 全項目を初期化（数量0、備考なし）
      const inputs: ItemInput[] = [];
      for (const category of template.categories) {
        for (const item of category.items) {
          inputs.push({
            id: item.id,
            category_name: category.name,
            name: item.name,
            description: item.description,
            default_unit: item.default_unit,
            quantity: 0,
            unit_price: item.default_unit_price || 0,
            note: "",
          });
        }
      }
      setItemInputs(inputs);
      setDiscountAmount(0);
    } else {
      setItemInputs([]);
      setDiscountAmount(0);
    }
  };

  const handleQuantityChange = (itemId: string, quantity: number) => {
    setItemInputs((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, quantity } : item
      )
    );
  };

  const handleUnitPriceChange = (itemId: string, unitPrice: number) => {
    setItemInputs((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, unit_price: unitPrice } : item
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

  // 小計計算
  const subtotal = itemInputs.reduce((sum, item) => {
    return sum + Math.floor(item.quantity * item.unit_price);
  }, 0);

  // 値引き後の合計
  const totalAfterDiscount = subtotal - discountAmount;

  const handleAddAll = () => {
    if (itemInputs.length === 0) return;

    const items: SelectedItem[] = itemInputs.map((input) => {
      return {
        item_template_id: input.id,
        category_name: input.category_name,
        name: input.name,
        description: input.note || input.description,
        unit: input.default_unit,
        quantity: input.quantity,
        unit_price: input.unit_price,
        amount: Math.floor(input.quantity * input.unit_price),
      };
    });

    // 値引きがある場合は値引き項目を追加
    if (discountAmount > 0) {
      items.push({
        item_template_id: null,
        category_name: "",
        name: "値引き",
        description: null,
        unit: "式",
        quantity: 1,
        unit_price: -discountAmount,
        amount: -discountAmount,
      });
    }

    onAddItems(items);
    // リセット
    setSelectedTemplateId("");
    setItemInputs([]);
    setDiscountAmount(0);
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

  // 金額フォーマット
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ja-JP").format(amount);
  };

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
            {discountAmount > 0 ? `全${itemInputs.length + 1}項目を追加` : `全${itemInputs.length}項目を追加`}
          </Button>
        )}
      </div>

      {selectedTemplate && itemInputs.length > 0 && (
        <div className="border rounded-md p-4 space-y-4 max-h-[450px] overflow-y-auto">
          {/* ヘッダー */}
          <div className="grid grid-cols-[1fr_70px_100px_100px_1fr] gap-2 text-xs text-muted-foreground border-b pb-2">
            <span>項目名</span>
            <span className="text-right">数量</span>
            <span className="text-right">単価</span>
            <span className="text-right">小計</span>
            <span>備考</span>
          </div>

          {groupedInputs.map((group) => (
            <div key={group.category} className="space-y-2">
              <h4 className="font-medium text-sm text-muted-foreground">
                {group.category}
              </h4>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const itemSubtotal = Math.floor(item.quantity * item.unit_price);
                  return (
                    <div
                      key={item.id}
                      className="grid grid-cols-[1fr_70px_100px_100px_1fr] gap-2 items-center"
                    >
                      <div className="text-sm truncate" title={item.name}>
                        {item.name}
                        {item.default_unit && (
                          <span className="text-muted-foreground ml-1">
                            ({item.default_unit})
                          </span>
                        )}
                      </div>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => {
                          handleQuantityChange(item.id, parseInt(e.target.value) || 0);
                        }}
                        className="h-7 text-right text-sm"
                        min={0}
                        step={1}
                      />
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={item.unit_price || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          handleUnitPriceChange(item.id, val === "" ? 0 : parseInt(val) || 0);
                        }}
                        className="h-7 text-right text-sm"
                        placeholder="0"
                      />
                      <div className="text-sm text-right">
                        {itemSubtotal > 0 ? formatCurrency(itemSubtotal) : "-"}
                      </div>
                      <Input
                        value={item.note}
                        onChange={(e) => handleNoteChange(item.id, e.target.value)}
                        className="h-7 text-sm"
                        placeholder="備考"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* 値引き入力欄 */}
          <div className="border-t pt-3 space-y-2">
            <div className="grid grid-cols-[1fr_70px_100px_100px_1fr] gap-2 items-center">
              <div className="text-sm flex items-center gap-1">
                <Minus className="h-4 w-4 text-muted-foreground" />
                値引き
              </div>
              <div></div>
              <Input
                type="text"
                inputMode="numeric"
                value={discountAmount || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setDiscountAmount(val === "" ? 0 : parseInt(val) || 0);
                }}
                className="h-7 text-right text-sm"
                placeholder="0"
              />
              <div className="text-sm text-right text-red-600">
                {discountAmount > 0 ? `-${formatCurrency(discountAmount)}` : "-"}
              </div>
              <div></div>
            </div>
          </div>

          {/* 合計表示 */}
          <div className="border-t pt-3 flex justify-end">
            <div className="text-sm space-y-1">
              <div className="flex justify-between gap-8">
                <span className="text-muted-foreground">小計</span>
                <span>{formatCurrency(subtotal)}円</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between gap-8">
                  <span className="text-muted-foreground">値引き後</span>
                  <span className="font-medium">{formatCurrency(totalAfterDiscount)}円</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
