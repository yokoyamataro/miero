"use client";

import { useState, useTransition, useMemo } from "react";
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
  LEAVE_TYPE_OPTIONS,
  LEAVE_STATUS_LABELS,
  LEAVE_STATUS_COLORS,
} from "@/types/database";
import {
  createLeave,
  addLeaveByManager,
  approveLeave,
  rejectLeave,
  deleteLeave,
} from "./actions";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

interface LeaveListProps {
  leaves: LeaveWithEmployee[];
  currentEmployee: { id: string; name: string; role: string };
  isManager: boolean;
  employees: Employee[];
}

export function LeaveList({
  leaves,
  currentEmployee,
  isManager,
  employees,
}: LeaveListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // 申請ダイアログ
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [requestForm, setRequestForm] = useState({
    leave_date: format(new Date(), "yyyy-MM-dd"),
    leave_type: "有給休暇（全日）" as LeaveType,
    adjustment: "",
    reason: "",
  });

  // 管理者用追加ダイアログ
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addForm, setAddForm] = useState({
    employee_id: "",
    leave_date: format(new Date(), "yyyy-MM-dd"),
    leave_type: "有給休暇（全日）" as LeaveType,
    adjustment: "",
    reason: "",
    status: "approved" as "pending" | "approved",
  });

  // 差戻しダイアログ
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectingLeaveId, setRejectingLeaveId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // 削除ダイアログ
  const [deletingLeaveId, setDeletingLeaveId] = useState<string | null>(null);

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

  // 休暇申請
  const handleRequest = () => {
    startTransition(async () => {
      const result = await createLeave(requestForm);
      if (result.success) {
        setShowRequestDialog(false);
        setRequestForm({
          leave_date: format(new Date(), "yyyy-MM-dd"),
          leave_type: "有給休暇（全日）",
          adjustment: "",
          reason: "",
        });
        router.refresh();
      } else {
        alert(result.error);
      }
    });
  };

  // 管理者による追加
  const handleAdd = () => {
    if (!addForm.employee_id) {
      alert("社員を選択してください");
      return;
    }

    startTransition(async () => {
      const result = await addLeaveByManager(addForm);
      if (result.success) {
        setShowAddDialog(false);
        setAddForm({
          employee_id: "",
          leave_date: format(new Date(), "yyyy-MM-dd"),
          leave_type: "有給休暇（全日）",
          adjustment: "",
          reason: "",
          status: "approved",
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
            <Button variant="outline" onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              休暇追加
            </Button>
          )}
        </div>
      </div>

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

      {/* 休暇一覧 */}
      <Card>
        <CardHeader>
          <CardTitle>
            {isManager ? "全休暇一覧" : "自分の休暇"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {leaves.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              休暇がありません
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {isManager && <TableHead>申請者</TableHead>}
                  <TableHead>休暇日</TableHead>
                  <TableHead>種類</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead>事前調整</TableHead>
                  <TableHead>理由・備考</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(isManager ? otherLeaves : leaves).map((leave) => (
                  <TableRow key={leave.id}>
                    {isManager && (
                      <TableCell className="font-medium">
                        {leave.employee?.name}
                      </TableCell>
                    )}
                    <TableCell>{formatDate(leave.leave_date)}</TableCell>
                    <TableCell>{leave.leave_type}</TableCell>
                    <TableCell>
                      <Badge className={LEAVE_STATUS_COLORS[leave.status]}>
                        {LEAVE_STATUS_LABELS[leave.status]}
                      </Badge>
                      {leave.status === "rejected" && leave.rejection_reason && (
                        <div className="text-xs text-destructive mt-1">
                          理由: {leave.rejection_reason}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{leave.adjustment || "-"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {leave.reason || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {(isManager || (leave.status === "pending" && leave.employee_id === currentEmployee.id)) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeletingLeaveId(leave.id)}
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
              <Select
                value={requestForm.leave_type}
                onValueChange={(v) =>
                  setRequestForm({ ...requestForm, leave_type: v as LeaveType })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAVE_TYPE_OPTIONS.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Label>理由・備考</Label>
              <Textarea
                value={requestForm.reason}
                onChange={(e) =>
                  setRequestForm({ ...requestForm, reason: e.target.value })
                }
                placeholder="休暇の理由を入力してください"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRequestDialog(false)}>
              キャンセル
            </Button>
            <Button onClick={handleRequest} disabled={isPending}>
              申請する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 管理者用追加ダイアログ */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>休暇追加（管理者）</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>社員 *</Label>
              <Select
                value={addForm.employee_id}
                onValueChange={(v) =>
                  setAddForm({ ...addForm, employee_id: v })
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
              <Label>休暇日 *</Label>
              <Input
                type="date"
                value={addForm.leave_date}
                onChange={(e) =>
                  setAddForm({ ...addForm, leave_date: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>休暇種類 *</Label>
              <Select
                value={addForm.leave_type}
                onValueChange={(v) =>
                  setAddForm({ ...addForm, leave_type: v as LeaveType })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAVE_TYPE_OPTIONS.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>事前調整</Label>
              <Select
                value={addForm.adjustment}
                onValueChange={(v) =>
                  setAddForm({ ...addForm, adjustment: v })
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
              <Label>理由・備考</Label>
              <Textarea
                value={addForm.reason}
                onChange={(e) =>
                  setAddForm({ ...addForm, reason: e.target.value })
                }
                placeholder="休暇の理由を入力してください"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>ステータス</Label>
              <Select
                value={addForm.status}
                onValueChange={(v) =>
                  setAddForm({ ...addForm, status: v as "pending" | "approved" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">承認済み</SelectItem>
                  <SelectItem value="pending">申請中</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              キャンセル
            </Button>
            <Button onClick={handleAdd} disabled={isPending}>
              追加する
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
