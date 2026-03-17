"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Plus,
  CalendarDays,
  Clock,
  ChevronRight,
  Trash2,
} from "lucide-react";
import {
  type LeaveWithEmployee,
  type LeaveType,
  type LeaveBalanceSummary,
  type LeaveCategory,
  LEAVE_STATUS_LABELS,
  LEAVE_STATUS_COLORS,
} from "@/types/database";
import { createLeave, deleteLeave, getAvailableLeaveTypes } from "@/app/leaves/actions";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

interface MobileLeaveListProps {
  leaves: LeaveWithEmployee[];
  currentEmployee: { id: string; name: string; role: string };
  balanceSummaries: LeaveBalanceSummary[];
  initialAvailableLeaveTypes: {
    category: LeaveCategory | "無給休暇";
    remaining: number;
    leaveTypes: string[];
  }[];
}

export function MobileLeaveList({
  leaves,
  currentEmployee,
  balanceSummaries,
  initialAvailableLeaveTypes,
}: MobileLeaveListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // 申請シート
  const [showRequestSheet, setShowRequestSheet] = useState(false);
  const [requestForm, setRequestForm] = useState({
    leave_date: format(new Date(), "yyyy-MM-dd"),
    leave_type: "" as LeaveType,
    adjustment: "",
    reason: "",
  });
  const [availableLeaveTypes, setAvailableLeaveTypes] = useState(initialAvailableLeaveTypes);
  const [isLoadingLeaveTypes, setIsLoadingLeaveTypes] = useState(false);

  // 詳細シート
  const [selectedLeave, setSelectedLeave] = useState<LeaveWithEmployee | null>(null);

  // 休暇日が変更されたら利用可能な休暇種類を取得
  const handleDateChange = async (newDate: string) => {
    setRequestForm(prev => ({ ...prev, leave_date: newDate }));
    setIsLoadingLeaveTypes(true);
    try {
      const types = await getAvailableLeaveTypes(newDate);
      setAvailableLeaveTypes(types);
      // 選択中の休暇種類が利用不可になった場合はリセット
      const allTypes = types.flatMap((t) => t.leaveTypes);
      if (requestForm.leave_type && !allTypes.includes(requestForm.leave_type)) {
        setRequestForm((prev) => ({ ...prev, leave_type: "" as LeaveType }));
      }
    } finally {
      setIsLoadingLeaveTypes(false);
    }
  };

  // 自分の休暇のみ（使用のみ）
  const myLeaves = useMemo(() => {
    return leaves
      .filter((l) => l.entry_type === "use")
      .sort((a, b) => new Date(b.leave_date).getTime() - new Date(a.leave_date).getTime());
  }, [leaves]);

  // 休暇申請
  const handleRequest = () => {
    if (!requestForm.leave_type) {
      alert("休暇種類を選択してください");
      return;
    }
    startTransition(async () => {
      const result = await createLeave(requestForm);
      if (result.success) {
        setShowRequestSheet(false);
        setRequestForm({
          leave_date: format(new Date(), "yyyy-MM-dd"),
          leave_type: "" as LeaveType,
          adjustment: "",
          reason: "",
        });
        router.refresh();
      } else {
        alert(result.error);
      }
    });
  };

  // 削除
  const handleDelete = (leaveId: string) => {
    if (!confirm("この休暇申請を削除しますか？")) return;

    startTransition(async () => {
      const result = await deleteLeave(leaveId);
      if (result.success) {
        setSelectedLeave(null);
        router.refresh();
      } else {
        alert(result.error);
      }
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, "M/d（E）", { locale: ja });
  };

  const getStatusBadge = (status: string) => {
    return (
      <Badge className={`${LEAVE_STATUS_COLORS[status as keyof typeof LEAVE_STATUS_COLORS]} text-xs`}>
        {LEAVE_STATUS_LABELS[status as keyof typeof LEAVE_STATUS_LABELS]}
      </Badge>
    );
  };

  return (
    <div className={`p-4 space-y-4 ${isPending ? "opacity-50" : ""}`}>
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          <h1 className="text-lg font-bold">休暇申請</h1>
        </div>
        <Button size="sm" onClick={() => setShowRequestSheet(true)}>
          <Plus className="h-4 w-4 mr-1" />
          申請
        </Button>
      </div>

      {/* 残日数カード */}
      <div className="grid grid-cols-2 gap-3">
        {balanceSummaries.map((summary) => (
          <Card key={summary.leave_category}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{summary.leave_category}</div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className={`text-2xl font-bold ${summary.remaining < 0 ? "text-destructive" : ""}`}>
                  {summary.remaining}
                </span>
                <span className="text-sm text-muted-foreground">日</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                付与{summary.total_granted} / 使用{summary.total_used}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 申請履歴 */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-base">申請履歴</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {myLeaves.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              休暇申請がありません
            </div>
          ) : (
            <div className="divide-y">
              {myLeaves.map((leave) => (
                <div
                  key={leave.id}
                  className="flex items-center justify-between p-4 active:bg-muted/50"
                  onClick={() => setSelectedLeave(leave)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{formatDate(leave.leave_date)}</span>
                      {getStatusBadge(leave.status)}
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5">
                      {leave.leave_type}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 申請シート */}
      <Sheet open={showRequestSheet} onOpenChange={setShowRequestSheet}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-xl">
          <SheetHeader className="pb-4 border-b">
            <SheetTitle>休暇申請</SheetTitle>
          </SheetHeader>

          <div className="py-4 space-y-4 overflow-y-auto">
            <div className="space-y-2">
              <Label>休暇日</Label>
              <Input
                type="date"
                value={requestForm.leave_date}
                onChange={(e) => handleDateChange(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>休暇種類</Label>
              {isLoadingLeaveTypes ? (
                <div className="text-sm text-muted-foreground p-2">読み込み中...</div>
              ) : availableLeaveTypes.length === 0 ? (
                <div className="text-sm text-destructive p-2 bg-destructive/10 rounded-md">
                  この日に取得可能な休暇がありません
                </div>
              ) : (
                <Select
                  value={requestForm.leave_type}
                  onValueChange={(v) =>
                    setRequestForm({ ...requestForm, leave_type: v as LeaveType })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選択してください" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableLeaveTypes.map((category) => (
                      <div key={category.category}>
                        <div className="px-2 py-1 text-xs text-muted-foreground font-medium">
                          {category.category}
                          {category.remaining === -1 ? "" : `（残 ${category.remaining}日）`}
                        </div>
                        {category.leaveTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label>事前調整</Label>
              <Select
                value={requestForm.adjustment}
                onValueChange={(v) =>
                  setRequestForm({ ...requestForm, adjustment: v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="調整済">調整済</SelectItem>
                  <SelectItem value="調整不要：１日以内">調整不要：１日以内</SelectItem>
                  <SelectItem value="その他">その他</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>備考</Label>
              <Textarea
                value={requestForm.reason}
                onChange={(e) =>
                  setRequestForm({ ...requestForm, reason: e.target.value })
                }
                placeholder="遠方の場合は行先を入力"
                rows={3}
              />
            </div>
          </div>

          <SheetFooter className="pt-4 border-t">
            <Button
              className="w-full"
              onClick={handleRequest}
              disabled={isPending || !requestForm.leave_type || availableLeaveTypes.length === 0}
            >
              申請する
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* 詳細シート */}
      <Sheet open={!!selectedLeave} onOpenChange={(open) => !open && setSelectedLeave(null)}>
        <SheetContent side="bottom" className="h-[60vh] rounded-t-xl">
          {selectedLeave && (
            <>
              <SheetHeader className="pb-4 border-b">
                <SheetTitle className="flex items-center gap-2">
                  休暇詳細
                  {getStatusBadge(selectedLeave.status)}
                </SheetTitle>
              </SheetHeader>

              <div className="py-4 space-y-4">
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">休暇日</div>
                    <div className="font-medium">
                      {format(new Date(selectedLeave.leave_date), "yyyy年M月d日（E）", { locale: ja })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">休暇種類</div>
                    <div className="font-medium">{selectedLeave.leave_type}</div>
                  </div>
                </div>

                {selectedLeave.adjustment && (
                  <div className="pl-8">
                    <div className="text-sm text-muted-foreground">事前調整</div>
                    <div>{selectedLeave.adjustment}</div>
                  </div>
                )}

                {selectedLeave.reason && (
                  <div className="pl-8">
                    <div className="text-sm text-muted-foreground">備考</div>
                    <div className="whitespace-pre-wrap">{selectedLeave.reason}</div>
                  </div>
                )}

                {selectedLeave.status === "rejected" && selectedLeave.rejection_reason && (
                  <div className="bg-destructive/10 rounded-lg p-3">
                    <div className="text-sm text-destructive font-medium">差戻し理由</div>
                    <div className="text-sm mt-1">{selectedLeave.rejection_reason}</div>
                  </div>
                )}
              </div>

              {selectedLeave.status === "pending" && (
                <SheetFooter className="pt-4 border-t">
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => handleDelete(selectedLeave.id)}
                    disabled={isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    申請を取り消す
                  </Button>
                </SheetFooter>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
