"use client";

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

interface InvoiceItemSelectorProps {
  templates: InvoiceTemplateWithCategories[];
  onAddItems: (items: SelectedItem[]) => void;
}

export function InvoiceItemSelector({
  templates,
  onAddItems,
}: InvoiceItemSelectorProps) {

  const handleTemplateChange = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;

    // テンプレートの全項目を即座に追加（数量0、金額0で）
    const items: SelectedItem[] = [];
    for (const category of template.categories) {
      for (const item of category.items) {
        items.push({
          item_template_id: item.id,
          category_name: category.name,
          name: item.name,
          description: item.description,
          unit: item.default_unit,
          quantity: 0,
          unit_price: item.default_unit_price || 0,
          amount: 0,
        });
      }
    }

    console.log("Template selected, adding items:", items.length);
    onAddItems(items);
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
    <Select onValueChange={handleTemplateChange}>
      <SelectTrigger className="w-[250px]">
        <SelectValue placeholder="テンプレートを選択して追加" />
      </SelectTrigger>
      <SelectContent>
        {templates.map((template) => (
          <SelectItem key={template.id} value={template.id}>
            {template.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
