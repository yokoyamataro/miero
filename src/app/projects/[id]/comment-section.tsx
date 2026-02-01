"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, Send, Trash2, ThumbsUp } from "lucide-react";
import { type Comment, type Employee, type CommentAcknowledgement } from "@/types/database";
import { createComment, deleteComment, acknowledgeComment, removeAcknowledgement } from "./actions";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CommentSectionProps {
  projectId: string;
  comments: Comment[];
  employees: Employee[];
  acknowledgementsByCommentId: Record<string, CommentAcknowledgement[]>;
  currentEmployeeId: string | null;
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
  acknowledgements,
  currentEmployeeId,
  projectId,
  onDelete,
}: {
  comment: Comment;
  employees: Employee[];
  acknowledgements: CommentAcknowledgement[];
  currentEmployeeId: string | null;
  projectId: string;
  onDelete: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const author = employees.find((e) => e.id === comment.author_id);
  const authorName = author?.name || comment.author_name || "匿名";

  // 自分のコメントかどうか
  const isOwnComment = currentEmployeeId && comment.author_id === currentEmployeeId;

  // 自分が確認済みかどうか
  const hasAcknowledged = currentEmployeeId && acknowledgements.some(
    (ack) => ack.employee_id === currentEmployeeId
  );

  // 確認者の名前リストを取得
  const acknowledgerNames = acknowledgements
    .map((ack) => {
      const emp = employees.find((e) => e.id === ack.employee_id);
      return emp?.name || "不明";
    })
    .join(", ");

  const handleAcknowledge = () => {
    if (!currentEmployeeId) return;

    startTransition(async () => {
      try {
        if (hasAcknowledged) {
          await removeAcknowledgement(comment.id, projectId);
        } else {
          await acknowledgeComment(comment.id, projectId);
        }
        router.refresh();
      } catch (error) {
        console.error("Error handling acknowledgement:", error);
      }
    });
  };

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

        {/* 確認ボタンと確認者表示 */}
        <div className="flex items-center gap-2 mt-2">
          {/* 自分のコメントでない場合のみ確認ボタンを表示 */}
          {!isOwnComment && currentEmployeeId && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={hasAcknowledged ? "default" : "outline"}
                    size="sm"
                    className={`h-7 px-2 gap-1 ${hasAcknowledged ? "bg-blue-500 hover:bg-blue-600" : ""}`}
                    onClick={handleAcknowledge}
                    disabled={isPending}
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                    <span className="text-xs">{acknowledgements.length || ""}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {hasAcknowledged ? "確認を取り消す" : "確認済みにする"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* 確認者がいる場合、確認者名を表示 */}
          {acknowledgements.length > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-muted-foreground cursor-help">
                    {acknowledgements.length}人が確認済み
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">{acknowledgerNames}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* 削除ボタン（自分のコメントのみ） */}
      {isOwnComment && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

export function CommentSection({
  projectId,
  comments,
  employees,
  acknowledgementsByCommentId,
  currentEmployeeId,
}: CommentSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [content, setContent] = useState("");

  const handleSubmit = () => {
    if (!content.trim()) return;

    startTransition(async () => {
      await createComment(projectId, content.trim());
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
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="コメントを入力..."
            rows={3}
            disabled={isPending || !currentEmployeeId}
          />

          <div className="flex justify-end">
            <Button
              onClick={handleSubmit}
              disabled={!content.trim() || isPending || !currentEmployeeId}
            >
              <Send className="h-4 w-4 mr-2" />
              送信
            </Button>
          </div>

          {!currentEmployeeId && (
            <p className="text-xs text-muted-foreground text-center">
              コメントするにはログインが必要です
            </p>
          )}
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
                acknowledgements={acknowledgementsByCommentId[comment.id] || []}
                currentEmployeeId={currentEmployeeId}
                projectId={projectId}
                onDelete={() => handleDelete(comment.id)}
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
