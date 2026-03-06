"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Check,
  X,
  Trash2,
  CalendarDays,
  AlertCircle,
} from "lucide-react";
import {
  type LeaveWithEmployee,
  type Employee,
  type LeaveType,
  type LeaveBalanceSummary,
  type LeaveCategory,
  LEAVE_STATUS_LABELS,
  LEAVE_STATUS_COLORS,
  LEAVE_CATEGORY_OPTIONS,
} from "@/types/database";
import {
  createLeave,
  approveLeave,
  rejectLeave,
  deleteLeave,
  grantLeaveBalance,
  getAvailableLeaveTypes,
} from "./actions";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

interface LeaveListProps {
  leaves: LeaveWithEmployee[];
  currentEmployee: { id: string; name: string; role: string };
  isManager: boolean;
  employees: Employee[];
  balanceSummaries: LeaveBalanceSummary[];
}

export function LeaveList({
  leaves,
  currentEmployee,
  isManager,
  employees,
  balanceSummaries,
}: LeaveListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // 申請ダイアログ
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [requestForm, setRequestForm] = useState({
    leave_date: format(new Date(), "yyyy-MM-dd"),
    leave_type: "" as LeaveType,
    adjustment: "",
    reason: "",
  });
  const [availableLeaveTypes, setAvailableLeaveTypes] = useState<{
    category: LeaveCategory | "無給休暇";
    remaining: number;
    leaveTypes: string[];
  }[]>([]);
  const [isLoadingLeaveTypes, setIsLoadingLeaveTypes] = useState(false);

  // 休暇日が変更されたら利用可能な休暇種類を取得
  useEffect(() => {
    if (showRequestDialog && requestForm.leave_date) {
      setIsLoadingLeaveTypes(true);
      getAvailableLeaveTypes(requestForm.leave_date)
        .then((types) => {
          setAvailableLeaveTypes(types);
          // 選択中の休暇種類が利用不可になった場合はリセット
          const allTypes = types.flatMap((t) => t.leaveTypes);
          if (requestForm.leave_type && !allTypes.includes(requestForm.leave_type)) {
            setRequestForm((prev) => ({ ...prev, leave_type: "" as LeaveType }));
          }
        })
        .finally(() => setIsLoadingLeaveTypes(false));
    }
  }, [showRequestDialog, requestForm.leave_date]);

  // 管理者用付与ダイアログ
  const [showGrantDialog, setShowGrantDialog] = useState(false);
  const [grantForm, setGrantForm] = useState({
    employee_id: "",
    leave_category: "有給休暇" as LeaveCategory,
    granted_days: 10,
    granted_at: format(new Date(), "yyyy-MM-dd"),
    note: "",
  });

  // 差戻しダイアログ
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectingLeaveId, setRejectingLeaveId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // 削除ダイアログ
  const [deletingLeaveId, setDeletingLeaveId] = useState<string | null>(null);

  // 休暇履歴の社員フィルター（管理者用）
  const [historyEmployeeFilter, setHistoryEmployeeFilter] = useState<string>("all");

  // 申請中の休暇をフィルタ（管理者用）
  const pendingLeaves = useMemo(
    () => leaves.filter((l) => l.status === "pending"),
    [leaves]
  );

  // その他の休暇
  const otherLeaves = useMemo(
    () => leaves.filter((l) => l.status !== "pending"),
    [leaves]
  );

  // 時系列でソートした休暇履歴（付与・使用両方含む）
  const sortedLeaveHistory = useMemo(() => {
    // 時系列順（新しい順）にソート
    let sorted = [...leaves].sort((a, b) => {
      const dateA = new Date(a.leave_date);
      const dateB = new Date(b.leave_date);
      return dateB.getTime() - dateA.getTime();
    });

    // 管理者でない場合は自分のデータのみ
    if (!isManager) {
      sorted = sorted.filter((l) => l.employee_id === currentEmployee.id);
    } else if (historyEmployeeFilter !== "all") {
      // 管理者の場合、社員フィルターを適用
      sorted = sorted.filter((l) => l.employee_id === historyEmployeeFilter);
    }
    return sorted;
  }, [leaves, isManager, currentEmployee.id, historyEmployeeFilter]);

  // 各レコードの残高を計算するための累積計算
  const leaveHistoryWithBalance = useMemo(() => {
    // 古い順でソートして累積を計算
    const chronological = [...sortedLeaveHistory].reverse();

    // 社員ごとの残高を追跡
    const balances: Record<string, { 有給休暇: number; 冬季休暇: number }> = {};

    const withBalance = chronological.map((leave) => {
      if (!balances[leave.employee_id]) {
        balances[leave.employee_id] = { 有給休暇: 0, 冬季休暇: 0 };
      }

      const category = leave.leave_category;
      if (category === "有給休暇" || category === "冬季休暇") {
        if (leave.entry_type === "grant") {
          balances[leave.employee_id][category] += Number(leave.days);
        } else if (leave.status === "approved") {
          balances[leave.employee_id][category] += Number(leave.days); // daysはマイナス値
        }
      }

      return {
        ...leave,
        balance_after: { ...balances[leave.employee_id] },
      };
    });

    // 新しい順に戻す
    return withBalance.reverse();
  }, [sortedLeaveHistory]);

  // 休暇申請
  const handleRequest = () => {
    if (!requestForm.leave_type) {
      alert("休暇種類を選択してください");
      return;
    }
    startTransition(async () => {
      const result = await createLeave(requestForm);
      if (result.success) {
        setShowRequestDialog(false);
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

  // 管理者による休暇付与
  const handleGrant = () => {
    if (!grantForm.employee_id) {
      alert("社員を選択してください");
      return;
    }

    startTransition(async () => {
      const result = await grantLeaveBalance(grantForm);
      if (result.success) {
        setShowGrantDialog(false);
        setGrantForm({
          employee_id: "",
          leave_category: "有給休暇",
          granted_days: 10,
          granted_at: format(new Date(), "yyyy-MM-dd"),
          note: "",
        });
        router.refresh();
      } else {
        alert(result.error);
      }
    });
  };

  // 承認
  const handleApprove = (leaveId: string) => {
    startTransition(async () => {
      const result = await approveLeave(leaveId);
      if (!result.success) {
        alert(result.error);
      }
      router.refresh();
    });
  };

  // 差戻し
  const handleReject = () => {
    if (!rejectingLeaveId) return;

    startTransition(async () => {
      const result = await rejectLeave(rejectingLeaveId, rejectReason);
      if (result.success) {
        setShowRejectDialog(false);
        setRejectingLeaveId(null);
        setRejectReason("");
        router.refresh();
      } else {
        alert(result.error);
      }
    });
  };

  // 削除
  const handleDelete = () => {
    if (!deletingLeaveId) return;

    startTransition(async () => {
      const result = await deleteLeave(deletingLeaveId);
      if (result.success) {
        setDeletingLeaveId(null);
        router.refresh();
      } else {
        alert(result.error);
      }
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, "yyyy/MM/dd (E)", { locale: ja });
  };

  return (
    <div className={`space-y-6 ${isPending ? "opacity-50" : ""}`}>
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-6 w-6" />
          <h1 className="text-2xl font-bold">休暇管理</h1>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowRequestDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            休暇申請
          </Button>
          {isManager && (
            <Button variant="outline" onClick={() => setShowGrantDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              休暇付与
            </Button>
          )}
        </div>
      </div>

      {/* 残日数サマリー */}
      <Card>
        <CardHeader>
          <CardTitle>残日数</CardTitle>
        </CardHeader>
        <CardContent>
          {isManager ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>社員名</TableHead>
                  <TableHead className="text-right">有給休暇（付与）</TableHead>
                  <TableHead className="text-right">有給休暇（使用）</TableHead>
                  <TableHead className="text-right">有給休暇（残）</TableHead>
                  <TableHead className="text-right">冬季休暇（付与）</TableHead>
                  <TableHead className="text-right">冬季休暇（使用）</TableHead>
                  <TableHead className="text-right">冬季休暇（残）</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  // 社員ごとにグループ化（無給休暇は残日数管理しないので除外）
                  const groupedByEmployee: Record<string, { name: string; 有給休暇?: LeaveBalanceSummary; 冬季休暇?: LeaveBalanceSummary }> = {};
                  for (const summary of balanceSummaries) {
                    // 無給休暇はサマリーに表示しない
                    if (summary.leave_category === "無給休暇") continue;
                    if (!groupedByEmployee[summary.employee_id]) {
                      groupedByEmployee[summary.employee_id] = { name: summary.employee_name };
                    }
                    if (summary.leave_category === "有給休暇") {
                      groupedByEmployee[summary.employee_id].有給休暇 = summary;
                    } else if (summary.leave_category === "冬季休暇") {
                      groupedByEmployee[summary.employee_id].冬季休暇 = summary;
                    }
                  }
                  return Object.entries(groupedByEmployee).map(([empId, data]) => (
                    <TableRow key={empId}>
                      <TableCell className="font-medium">{data.name}</TableCell>
                      <TableCell className="text-right">{data.有給休暇?.total_granted ?? 0}</TableCell>
                      <TableCell className="text-right">{data.有給休暇?.total_used ?? 0}</TableCell>
                      <TableCell className="text-right font-bold">
                        {(data.有給休暇?.remaining ?? 0) < 0 ? (
                          <span className="text-destructive">{data.有給休暇?.remaining ?? 0}</span>
                        ) : (
                          data.有給休暇?.remaining ?? 0
                        )}
                      </TableCell>
                      <TableCell className="text-right">{data.冬季休暇?.total_granted ?? 0}</TableCell>
                      <TableCell className="text-right">{data.冬季休暇?.total_used ?? 0}</TableCell>
                      <TableCell className="text-right font-bold">
                        {(data.冬季休暇?.remaining ?? 0) < 0 ? (
                          <span className="text-destructive">{data.冬季休暇?.remaining ?? 0}</span>
                        ) : (
                          data.冬季休暇?.remaining ?? 0
                        )}
                      </TableCell>
                    </TableRow>
                  ));
                })()}
              </TableBody>
            </Table>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {balanceSummaries.map((summary) => (
                <div key={summary.leave_category} className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground">{summary.leave_category}</div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-bold">
                      {summary.remaining < 0 ? (
                        <span className="text-destructive">{summary.remaining}</span>
                      ) : (
                        summary.remaining
                      )}
                    </span>
                    <span className="text-muted-foreground">日</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    付与: {summary.total_granted}日 / 使用: {summary.total_used}日
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 申請中の休暇（管理者向けに目立つように表示） */}
      {isManager && pendingLeaves.length > 0 && (
        <Card className="border-yellow-500 border-2">
          <CardHeader className="bg-yellow-50">
            <CardTitle className="flex items-center gap-2 text-yellow-800">
              <AlertCircle className="h-5 w-5" />
              申請中の休暇 ({pendingLeaves.length}件)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>申請者</TableHead>
                  <TableHead>休暇日</TableHead>
                  <TableHead>種類</TableHead>
                  <TableHead>事前調整</TableHead>
                  <TableHead>理由・備考</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingLeaves.map((leave) => (
                  <TableRow key={leave.id} className="bg-yellow-50/50">
                    <TableCell className="font-medium">
                      {leave.employee?.name}
                    </TableCell>
                    <TableCell>{formatDate(leave.leave_date)}</TableCell>
                    <TableCell>{leave.leave_type}</TableCell>
                    <TableCell>{leave.adjustment || "-"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {leave.reason || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleApprove(leave.id)}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          承認
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setRejectingLeaveId(leave.id);
                            setShowRejectDialog(true);
                          }}
                        >
                          <X className="h-4 w-4 mr-1" />
                          差戻し
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 休暇履歴（時系列） */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>
            {isManager ? "休暇履歴（時系列）" : "休暇履歴"}
          </CardTitle>
          {isManager && (
            <Select
              value={historyEmployeeFilter}
              onValueChange={setHistoryEmployeeFilter}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="社員を選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全員</SelectItem>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {leaveHistoryWithBalance.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              休暇履歴がありません
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {isManager && <TableHead>社員名</TableHead>}
                  <TableHead>日付</TableHead>
                  <TableHead>区分</TableHead>
                  <TableHead>種類</TableHead>
                  <TableHead className="text-right">日数</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead className="text-right">有給残</TableHead>
                  <TableHead className="text-right">冬季休暇残</TableHead>
                  <TableHead>備考</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaveHistoryWithBalance.map((item) => (
                  <TableRow
                    key={item.id}
                    className={item.entry_type === "grant" ? "bg-blue-50" : ""}
                  >
                    {isManager && (
                      <TableCell className="font-medium">
                        {item.employee?.name}
                      </TableCell>
                    )}
                    <TableCell>{formatDate(item.leave_date)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={item.entry_type === "grant" ? "default" : "secondary"}
                        className={item.entry_type === "grant" ? "bg-blue-500" : ""}
                      >
                        {item.entry_type === "grant" ? "付与" : "使用"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.entry_type === "grant"
                        ? item.leave_category
                        : item.leave_type}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {item.entry_type === "grant" ? (
                        <span className="text-blue-600">+{item.days}</span>
                      ) : (
                        <span className="text-red-600">{item.days}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.entry_type === "use" && (
                        <Badge className={LEAVE_STATUS_COLORS[item.status]}>
                          {LEAVE_STATUS_LABELS[item.status]}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {item.balance_after.有給休暇}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {item.balance_after.冬季休暇}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate">
                      {item.reason || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.entry_type === "use" &&
                        (isManager || (item.status === "pending" && item.employee_id === currentEmployee.id)) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeletingLeaveId(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 休暇申請ダイアログ */}
      <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>休暇申請</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>休暇日 *</Label>
              <Input
                type="date"
                value={requestForm.leave_date}
                onChange={(e) =>
                  setRequestForm({ ...requestForm, leave_date: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>休暇種類 *</Label>
              {isLoadingLeaveTypes ? (
                <div className="text-sm text-muted-foreground p-2">読み込み中...</div>
              ) : availableLeaveTypes.length === 0 ? (
                <div className="text-sm text-destructive p-2 bg-destructive/10 rounded-md">
                  この日に取得可能な休暇がありません。残日数をご確認ください。
                </div>
              ) : (
                <>
                  <Select
                    value={requestForm.leave_type}
                    onValueChange={(v) =>
                      setRequestForm({ ...requestForm, leave_type: v as LeaveType })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="休暇種類を選択" />
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
                </>
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
                placeholder="遠方の場合は行先を入力してください"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRequestDialog(false)}>
              キャンセル
            </Button>
            <Button
              onClick={handleRequest}
              disabled={isPending || !requestForm.leave_type || availableLeaveTypes.length === 0}
            >
              申請する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 管理者用付与ダイアログ */}
      <Dialog open={showGrantDialog} onOpenChange={setShowGrantDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>休暇付与</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>社員 *</Label>
              <Select
                value={grantForm.employee_id}
                onValueChange={(v) =>
                  setGrantForm({ ...grantForm, employee_id: v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="社員を選択" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>休暇種類 *</Label>
              <Select
                value={grantForm.leave_category}
                onValueChange={(v) =>
                  setGrantForm({ ...grantForm, leave_category: v as LeaveCategory })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAVE_CATEGORY_OPTIONS.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>付与日数 *</Label>
              <Input
                type="number"
                step="0.5"
                min="0.5"
                value={grantForm.granted_days}
                onChange={(e) =>
                  setGrantForm({ ...grantForm, granted_days: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>付与日 *</Label>
              <Input
                type="date"
                value={grantForm.granted_at}
                onChange={(e) =>
                  setGrantForm({ ...grantForm, granted_at: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>備考</Label>
              <Textarea
                value={grantForm.note}
                onChange={(e) =>
                  setGrantForm({ ...grantForm, note: e.target.value })
                }
                placeholder="備考を入力してください"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGrantDialog(false)}>
              キャンセル
            </Button>
            <Button onClick={handleGrant} disabled={isPending}>
              付与する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 差戻しダイアログ */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>休暇申請の差戻し</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>差戻し理由 *</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="差戻しの理由を入力してください"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectDialog(false);
                setRejectingLeaveId(null);
                setRejectReason("");
              }}
            >
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isPending || !rejectReason.trim()}
            >
              差戻す
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <AlertDialog
        open={!!deletingLeaveId}
        onOpenChange={(open) => !open && setDeletingLeaveId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>休暇を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
