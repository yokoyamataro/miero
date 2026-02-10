"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Pencil, X, Check } from "lucide-react";
import { updateProject } from "./actions";

interface ProjectNotesProps {
  projectId: string;
  notes: string | null;
}

export function ProjectNotes({ projectId, notes }: ProjectNotesProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(notes || "");

  const handleSave = () => {
    startTransition(async () => {
      await updateProject(projectId, { notes: editValue || null });
      setIsEditing(false);
      router.refresh();
    });
  };

  const handleCancel = () => {
    setEditValue(notes || "");
    setIsEditing(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            ノート
          </CardTitle>
          {!isEditing && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => {
                setEditValue(notes || "");
                setIsEditing(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5 mr-1" />
              編集
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-3">
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="業務に関するメモや詳細情報を入力..."
              rows={6}
              autoFocus
              disabled={isPending}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={isPending}
              >
                <X className="h-4 w-4 mr-1" />
                キャンセル
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isPending}
              >
                <Check className="h-4 w-4 mr-1" />
                保存
              </Button>
            </div>
          </div>
        ) : (
          <div
            className="text-sm whitespace-pre-wrap min-h-[60px] cursor-pointer hover:bg-muted/50 rounded p-2 -m-2"
            onClick={() => {
              setEditValue(notes || "");
              setIsEditing(true);
            }}
          >
            {notes ? (
              notes
            ) : (
              <span className="text-muted-foreground">
                クリックしてノートを追加...
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
