"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  PROJECT_CATEGORY_LABELS,
  PROJECT_STATUS_COLORS,
  type Project,
} from "@/types/database";
import { updateProject } from "./actions";

interface ProjectHeaderProps {
  project: Project;
}

// 編集可能なタイトルコンポーネント
function EditableTitle({
  value,
  onSave,
}: {
  value: string;
  onSave: (value: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value);

  const handleSave = () => {
    if (inputValue !== value) {
      onSave(inputValue);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setInputValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <Input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        autoFocus
        className="text-2xl font-bold h-auto py-1 max-w-2xl"
      />
    );
  }

  return (
    <h1
      onClick={() => {
        setInputValue(value);
        setIsEditing(true);
      }}
      className="text-2xl font-bold cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 py-0.5"
    >
      {value}
    </h1>
  );
}

export function ProjectHeader({ project }: ProjectHeaderProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleUpdate = (field: string, value: string) => {
    startTransition(async () => {
      await updateProject(project.id, { [field]: value });
      router.refresh();
    });
  };

  return (
    <div className={`mb-4 ${isPending ? "opacity-50" : ""}`}>
      {/* 業務番号とカテゴリバッジ */}
      <div className="flex items-center gap-3 mb-2">
        <span className="font-mono text-muted-foreground">{project.code}</span>
        <Badge className="bg-blue-100 text-blue-800">
          {PROJECT_CATEGORY_LABELS[project.category]}
        </Badge>
        <Badge className={PROJECT_STATUS_COLORS[project.status]}>
          {project.status}
        </Badge>
      </div>
      {/* 業務タイトル（編集可能） */}
      <EditableTitle
        value={project.name}
        onSave={(val) => handleUpdate("name", val)}
      />
    </div>
  );
}
