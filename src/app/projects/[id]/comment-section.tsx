"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageSquare, Send, Trash2 } from "lucide-react";
import { type Comment, type Employee } from "@/types/database";
import { createComment, deleteComment } from "./actions";

interface CommentSectionProps {
  projectId: string;
  comments: Comment[];
  employees: Employee[];
}

// 日時フォーマット
function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "たった今";
  if (diffMins < 60) return `${diffMins}分前`;
  if (diffHours < 24) return `${diffHours}時間前`;
  if (diffDays < 7) return `${diffDays}日前`;

  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

// 名前からイニシャルを取得
function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((n) => n.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function CommentItem({
  comment,
  employees,
  onDelete,
}: {
  comment: Comment;
  employees: Employee[];
  onDelete: () => void;
}) {
  const author = employees.find((e) => e.id === comment.author_id);
  const authorName = author?.name || comment.author_name || "匿名";

  return (
    <div className="flex gap-3 p-3 rounded-lg hover:bg-muted/50 group">
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarFallback className="text-xs bg-primary/10">
          {getInitials(authorName)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm">{authorName}</span>
          <span className="text-xs text-muted-foreground">
            {formatDateTime(comment.created_at)}
          </span>
        </div>
        <p className="text-sm whitespace-pre-wrap break-words">{comment.content}</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onDelete}
        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function CommentSection({ projectId, comments, employees }: CommentSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [content, setContent] = useState("");
  const [authorMode, setAuthorMode] = useState<"select" | "manual">("select");
  const [selectedAuthorId, setSelectedAuthorId] = useState<string>("");
  const [manualAuthorName, setManualAuthorName] = useState("");

  const handleSubmit = () => {
    if (!content.trim()) return;

    const authorId = authorMode === "select" && selectedAuthorId ? selectedAuthorId : null;
    const authorName = authorMode === "manual" && manualAuthorName.trim() ? manualAuthorName.trim() : null;

    startTransition(async () => {
      await createComment({
        project_id: projectId,
        author_id: authorId,
        author_name: authorName,
        content: content.trim(),
      });
      setContent("");
      router.refresh();
    });
  };

  const handleDelete = (commentId: string) => {
    if (confirm("このコメントを削除しますか？")) {
      startTransition(async () => {
        await deleteComment(commentId);
        router.refresh();
      });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          コメント
          {comments.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              ({comments.length}件)
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* コメント入力 */}
        <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
          <div className="flex items-center gap-2">
            <Select
              value={authorMode}
              onValueChange={(v) => setAuthorMode(v as "select" | "manual")}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="select">社員選択</SelectItem>
                <SelectItem value="manual">名前入力</SelectItem>
              </SelectContent>
            </Select>

            {authorMode === "select" ? (
              <Select value={selectedAuthorId} onValueChange={setSelectedAuthorId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="投稿者を選択..." />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={manualAuthorName}
                onChange={(e) => setManualAuthorName(e.target.value)}
                placeholder="名前を入力..."
                className="flex-1"
              />
            )}
          </div>

          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="コメントを入力..."
            rows={3}
            disabled={isPending}
          />

          <div className="flex justify-end">
            <Button
              onClick={handleSubmit}
              disabled={!content.trim() || isPending}
            >
              <Send className="h-4 w-4 mr-2" />
              送信
            </Button>
          </div>
        </div>

        {/* コメント一覧 */}
        <div className="space-y-1">
          {comments.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              コメントはまだありません
            </p>
          ) : (
            comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                employees={employees}
                onDelete={() => handleDelete(comment.id)}
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
