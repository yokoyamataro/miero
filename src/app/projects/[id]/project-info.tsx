"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MapPin,
  User,
  Calendar,
  CircleDollarSign,
  Building2,
} from "lucide-react";
import {
  PROJECT_CATEGORY_LABELS,
  PROJECT_STATUS_COLORS,
  type ProjectCategory,
  type ProjectStatus,
  type Project,
  type Contact,
  type Account,
  type Employee,
} from "@/types/database";
import { updateProject } from "./actions";

interface ProjectInfoProps {
  project: Project;
  contact: Contact | null;
  account: Account | null;
  manager: Employee | null;
  employees: Employee[];
}

const PROJECT_STATUSES: ProjectStatus[] = ["受注", "着手", "進行中", "完了", "請求済"];

// 日付フォーマット
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

// 金額フォーマット
function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return "-";
  return `¥${amount.toLocaleString()}`;
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
        className="text-2xl font-bold h-auto py-1"
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

// 編集可能なフィールドコンポーネント
function EditableField({
  label,
  value,
  displayValue,
  icon: Icon,
  type = "text",
  onSave,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  displayValue?: string;
  icon: React.ComponentType<{ className?: string }>;
  type?: "text" | "date" | "number" | "select";
  onSave: (value: string) => void;
  options?: { value: string; label: string }[];
  placeholder?: string;
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

  return (
    <div className="flex items-start gap-3">
      <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
      <div className="flex-1">
        <div className="text-sm text-muted-foreground">{label}</div>
        {isEditing ? (
          type === "select" && options ? (
            <Select
              value={inputValue}
              onValueChange={(val) => {
                setInputValue(val);
                onSave(val);
                setIsEditing(false);
              }}
            >
              <SelectTrigger className="h-8 mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">未選択</SelectItem>
                {options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              type={type}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              autoFocus
              className="h-8 mt-1"
              placeholder={placeholder}
            />
          )
        ) : (
          <div
            onClick={() => {
              setInputValue(value);
              setIsEditing(true);
            }}
            className="cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 py-0.5"
          >
            {displayValue || value || "-"}
          </div>
        )}
      </div>
    </div>
  );
}

export function ProjectInfo({
  project,
  contact,
  account,
  manager,
  employees,
}: ProjectInfoProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleUpdate = (field: string, value: string) => {
    startTransition(async () => {
      let updateValue: string | number | null = value;

      // フィールドに応じた変換
      if (field === "fee_tax_excluded") {
        updateValue = value ? parseInt(value, 10) : null;
      } else if (field === "manager_id" && value === "none") {
        updateValue = null;
      } else if ((field === "start_date" || field === "end_date") && !value) {
        updateValue = null;
      }

      await updateProject(project.id, { [field]: updateValue });
      router.refresh();
    });
  };

  // 顧客表示名
  const customerName = contact
    ? account
      ? `${account.company_name} (${contact.last_name} ${contact.first_name})`
      : `${contact.last_name} ${contact.first_name}`
    : "-";

  return (
    <div className={`space-y-6 ${isPending ? "opacity-50" : ""}`}>
      {/* ヘッダー情報 */}
      <div>
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <span className="font-mono text-muted-foreground">{project.code}</span>
          <Badge className="bg-blue-100 text-blue-800">
            {PROJECT_CATEGORY_LABELS[project.category]}
          </Badge>
          <Select
            value={project.status}
            onValueChange={(val) => handleUpdate("status", val)}
          >
            <SelectTrigger className="w-auto h-7 px-2 border-none shadow-none">
              <Badge className={PROJECT_STATUS_COLORS[project.status]}>
                {project.status}
              </Badge>
            </SelectTrigger>
            <SelectContent>
              {PROJECT_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  <Badge className={PROJECT_STATUS_COLORS[status]}>{status}</Badge>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <EditableTitle
          value={project.name}
          onSave={(val) => handleUpdate("name", val)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">基本情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <div className="text-sm text-muted-foreground">顧客</div>
              <div>{customerName}</div>
            </div>
          </div>

          <EditableField
            label="担当者"
            value={project.manager_id || "none"}
            displayValue={manager?.name || "-"}
            icon={User}
            type="select"
            options={employees.map((e) => ({ value: e.id, label: e.name }))}
            onSave={(val) => handleUpdate("manager_id", val)}
          />

          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <div className="text-sm text-muted-foreground">期間</div>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={project.start_date || ""}
                  onChange={(e) => handleUpdate("start_date", e.target.value)}
                  className="h-8 w-36"
                />
                <span className="text-muted-foreground">〜</span>
                <Input
                  type="date"
                  value={project.end_date || ""}
                  onChange={(e) => handleUpdate("end_date", e.target.value)}
                  className="h-8 w-36"
                />
              </div>
            </div>
          </div>

          <EditableField
            label="報酬（税抜）"
            value={project.fee_tax_excluded?.toString() || ""}
            displayValue={formatCurrency(project.fee_tax_excluded)}
            icon={CircleDollarSign}
            type="number"
            onSave={(val) => handleUpdate("fee_tax_excluded", val)}
            placeholder="金額を入力"
          />

          <EditableField
            label="所在地"
            value={project.location || ""}
            icon={MapPin}
            onSave={(val) => handleUpdate("location", val)}
            placeholder="所在地を入力"
          />
        </CardContent>
      </Card>

      {/* カテゴリ別詳細 */}
      {project.details && Object.keys(project.details).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">カテゴリ別詳細</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              {Object.entries(project.details).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <dt className="text-muted-foreground">{key}</dt>
                  <dd>{String(value)}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
