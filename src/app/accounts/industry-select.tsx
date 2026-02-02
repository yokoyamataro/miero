"use client";

import { useState, useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2 } from "lucide-react";
import type { Industry } from "@/types/database";
import { createIndustry } from "./actions";

interface IndustrySelectProps {
  industries: Industry[];
  value: string;
  onChange: (value: string) => void;
}

export function IndustrySelect({
  industries: initialIndustries,
  value,
  onChange,
}: IndustrySelectProps) {
  const [industries, setIndustries] = useState(initialIndustries);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newIndustryName, setNewIndustryName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleAddIndustry = () => {
    if (!newIndustryName.trim()) {
      setError("業種名を入力してください");
      return;
    }

    // 重複チェック
    if (industries.some((i) => i.name === newIndustryName.trim())) {
      setError("同じ名前の業種が既に存在します");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await createIndustry(newIndustryName.trim());
      if (result.error) {
        setError(result.error);
      } else if (result.industry) {
        setIndustries([...industries, result.industry]);
        onChange(result.industry.name);
        setIsDialogOpen(false);
        setNewIndustryName("");
      }
    });
  };

  return (
    <>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="業種を選択" />
        </SelectTrigger>
        <SelectContent>
          {industries.map((industry) => (
            <SelectItem key={industry.id} value={industry.name}>
              {industry.name}
            </SelectItem>
          ))}
          <div className="border-t mt-1 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              業種を追加
            </Button>
          </div>
        </SelectContent>
      </Select>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新しい業種を追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="new_industry_name">業種名</Label>
              <Input
                id="new_industry_name"
                value={newIndustryName}
                onChange={(e) => setNewIndustryName(e.target.value)}
                placeholder="例: 製造業"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddIndustry();
                  }
                }}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false);
                setNewIndustryName("");
                setError(null);
              }}
            >
              キャンセル
            </Button>
            <Button
              type="button"
              onClick={handleAddIndustry}
              disabled={isPending}
            >
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              追加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
