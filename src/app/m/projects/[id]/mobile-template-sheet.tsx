"use client";

import { useState, useEffect } from "react";
import { FileText, Loader2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getTaskTemplateSets, createTasksFromTemplateSet } from "./actions";

interface TaskTemplateSetWithItems {
  id: string;
  name: string;
  items: { id: string; title: string; sort_order: number }[];
}

interface MobileTemplateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onTasksCreated: (count: number) => void;
}

export function MobileTemplateSheet({
  open,
  onOpenChange,
  projectId,
  onTasksCreated,
}: MobileTemplateSheetProps) {
  const [templates, setTemplates] = useState<TaskTemplateSetWithItems[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open]);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const data = await getTaskTemplateSets();
      setTemplates(data);
    } catch (error) {
      console.error("Error loading templates:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectTemplate = async (setId: string) => {
    setIsCreating(setId);
    try {
      const result = await createTasksFromTemplateSet(projectId, setId);
      if (result.success && result.created) {
        onTasksCreated(result.created);
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Error creating tasks from template:", error);
    } finally {
      setIsCreating(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[60vh] rounded-t-xl">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="text-left">テンプレートから読込</SheetTitle>
        </SheetHeader>

        <div className="py-4 overflow-y-auto h-full">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                テンプレートがありません
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PC版でテンプレートを作成してください
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template.id)}
                  disabled={isCreating !== null}
                  className="w-full flex items-center gap-3 p-4 rounded-lg border bg-background hover:bg-muted/50 transition-colors text-left disabled:opacity-50"
                >
                  <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm">{template.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {template.items.length}件のタスク
                    </p>
                  </div>
                  {isCreating === template.id ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
