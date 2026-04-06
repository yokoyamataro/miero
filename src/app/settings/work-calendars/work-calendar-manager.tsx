"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Calendar, Clock, Users, ChevronLeft, ChevronRight } from "lucide-react";
import type {
  WorkCalendarSet,
  WorkCalendarHoliday,
  WorkCalendarMonthlyHours,
  Employee,
  getFiscalYear,
} from "@/types/database";
import {
  createWorkCalendarSet,
  updateWorkCalendarSet,
  deleteWorkCalendarSet,
  getWorkCalendarSetWithDetails,
  addHolidaysBulk,
  syncHolidays,
  setMonthlyHoursBulk,
  assignCalendarSetToEmployee,
  getJapaneseHolidays,
} from "./actions";

interface WorkCalendarManagerProps {
  initialSets: WorkCalendarSet[];
  employees: (Employee & { workCalendarSet?: WorkCalendarSet | null })[];
}

export function WorkCalendarManager({
  initialSets,
  employees,
}: WorkCalendarManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sets, setSets] = useState(initialSets);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(
    initialSets[0]?.id || null
  );
  const [selectedSet, setSelectedSet] = useState<{
    set: WorkCalendarSet;
    holidays: WorkCalendarHoliday[];
    monthlyHours: WorkCalendarMonthlyHours[];
  } | null>(null);

  // 年度選択（デフォルトは現在の年度）
  const currentFiscalYear = new Date().getMonth() < 3
    ? new Date().getFullYear() - 1
    : new Date().getFullYear();
  const [fiscalYear, setFiscalYear] = useState(currentFiscalYear);

  // ダイアログ状態
  const [showSetDialog, setShowSetDialog] = useState(false);
  const [editingSet, setEditingSet] = useState<WorkCalendarSet | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkCalendarSet | null>(null);

  // フォーム状態
  const [setName, setSetName] = useState("");
  const [setDescription, setSetDescription] = useState("");
  const [setIsDefault, setSetIsDefault] = useState(false);

  // 選択されたセットの詳細を読み込む
  useEffect(() => {
    if (selectedSetId) {
      loadSetDetails(selectedSetId, fiscalYear);
    }
  }, [selectedSetId, fiscalYear]);

  const loadSetDetails = async (setId: string, year: number) => {
    const details = await getWorkCalendarSetWithDetails(setId, year);
    if (details) {
      setSelectedSet({
        set: details,
        holidays: details.holidays,
        monthlyHours: details.monthlyHours,
      });
    }
  };

  // セット作成/編集ダイアログを開く
  const openSetDialog = (set?: WorkCalendarSet) => {
    if (set) {
      setEditingSet(set);
      setSetName(set.name);
      setSetDescription(set.description || "");
      setSetIsDefault(set.is_default);
    } else {
      setEditingSet(null);
      setSetName("");
      setSetDescription("");
      setSetIsDefault(false);
    }
    setShowSetDialog(true);
  };

  // セット保存
  const handleSaveSet = async () => {
    startTransition(async () => {
      if (editingSet) {
        await updateWorkCalendarSet(editingSet.id, {
          name: setName,
          description: setDescription || null,
          is_default: setIsDefault,
        });
      } else {
        const { set } = await createWorkCalendarSet({
          name: setName,
          description: setDescription || null,
          is_default: setIsDefault,
        });
        if (set) {
          setSets([...sets, set]);
          setSelectedSetId(set.id);
        }
      }
      setShowSetDialog(false);
      router.refresh();
    });
  };

  // セット削除
  const handleDeleteSet = async () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      await deleteWorkCalendarSet(deleteTarget.id);
      setSets(sets.filter((s) => s.id !== deleteTarget.id));
      if (selectedSetId === deleteTarget.id) {
        setSelectedSetId(sets[0]?.id || null);
      }
      setDeleteTarget(null);
      router.refresh();
    });
  };

  // 年度オプション
  const yearOptions = [
    currentFiscalYear - 1,
    currentFiscalYear,
    currentFiscalYear + 1,
  ];

  return (
    <div className="space-y-6">
      {/* カレンダーセット選択 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              カレンダーセット
            </CardTitle>
            <Button onClick={() => openSetDialog()} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              新規セット
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {sets.map((set) => (
              <div
                key={set.id}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer
                  transition-colors
                  ${selectedSetId === set.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "hover:bg-muted"
                  }
                `}
                onClick={() => setSelectedSetId(set.id)}
              >
                <span>{set.name}</span>
                {set.is_default && (
                  <Badge variant="secondary" className="text-xs">
                    デフォルト
                  </Badge>
                )}
                <div className="flex gap-1 ml-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      openSetDialog(set);
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(set);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 選択されたセットの設定 */}
      {selectedSet && (
        <Tabs defaultValue="holidays" className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="holidays" className="gap-2">
                <Calendar className="h-4 w-4" />
                休日設定
              </TabsTrigger>
              <TabsTrigger value="hours" className="gap-2">
                <Clock className="h-4 w-4" />
                勤務時間
              </TabsTrigger>
              <TabsTrigger value="employees" className="gap-2">
                <Users className="h-4 w-4" />
                社員割り当て
              </TabsTrigger>
            </TabsList>

            {/* 年度選択 */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFiscalYear((y) => y - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Select
                value={String(fiscalYear)}
                onValueChange={(v) => setFiscalYear(parseInt(v))}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}年度
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFiscalYear((y) => y + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <TabsContent value="holidays">
            <HolidaySettings
              calendarSetId={selectedSetId!}
              fiscalYear={fiscalYear}
              holidays={selectedSet.holidays}
              onUpdate={() => loadSetDetails(selectedSetId!, fiscalYear)}
            />
          </TabsContent>

          <TabsContent value="hours">
            <MonthlyHoursSettings
              calendarSetId={selectedSetId!}
              fiscalYear={fiscalYear}
              monthlyHours={selectedSet.monthlyHours}
              onUpdate={() => loadSetDetails(selectedSetId!, fiscalYear)}
            />
          </TabsContent>

          <TabsContent value="employees">
            <EmployeeAssignment
              calendarSets={sets}
              employees={employees}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* セット作成/編集ダイアログ */}
      <Dialog open={showSetDialog} onOpenChange={setShowSetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSet ? "カレンダーセットを編集" : "新規カレンダーセット"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>セット名 *</Label>
              <Input
                value={setName}
                onChange={(e) => setSetName(e.target.value)}
                placeholder="例: 本社標準"
              />
            </div>
            <div className="space-y-2">
              <Label>説明</Label>
              <Textarea
                value={setDescription}
                onChange={(e) => setSetDescription(e.target.value)}
                placeholder="例: 土日祝日休み、9:00-18:00勤務"
                rows={2}
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={setIsDefault}
                onCheckedChange={(checked) => setSetIsDefault(checked === true)}
              />
              <span className="text-sm">デフォルトセットに設定</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSetDialog(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSaveSet} disabled={isPending || !setName}>
              {editingSet ? "保存" : "作成"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>カレンダーセットを削除</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.name}」を削除しますか？
              このセットに割り当てられている社員は未割り当てになります。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSet}
              className="bg-destructive text-destructive-foreground"
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================
// 休日設定コンポーネント
// ============================================
function HolidaySettings({
  calendarSetId,
  fiscalYear,
  holidays,
  onUpdate,
}: {
  calendarSetId: string;
  fiscalYear: number;
  holidays: WorkCalendarHoliday[];
  onUpdate: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedDates, setSelectedDates] = useState<Set<string>>(
    new Set(holidays.map((h) => h.holiday_date))
  );

  // 年度が変わったら選択をリセット
  useEffect(() => {
    setSelectedDates(new Set(holidays.map((h) => h.holiday_date)));
  }, [holidays, fiscalYear]);

  // 祝日を自動追加
  const handleAddNationalHolidays = async () => {
    startTransition(async () => {
      const nationalHolidays = await getJapaneseHolidays(fiscalYear);
      const holidaysToAdd = nationalHolidays.map((h) => ({
        calendar_set_id: calendarSetId,
        fiscal_year: fiscalYear,
        holiday_date: h.date,
        holiday_name: h.name,
      }));
      await addHolidaysBulk(holidaysToAdd);
      onUpdate();
    });
  };

  // 選択を保存（追加・削除を同期）
  const handleSaveHolidays = async () => {
    startTransition(async () => {
      const existingHolidays = holidays.map((h) => ({
        id: h.id,
        holiday_date: h.holiday_date,
        holiday_name: h.holiday_name,
      }));
      await syncHolidays(
        calendarSetId,
        fiscalYear,
        Array.from(selectedDates),
        existingHolidays
      );
      onUpdate();
    });
  };

  // 月のカレンダーを生成
  const generateCalendar = (monthOffset: number) => {
    const year = Math.floor(monthOffset / 12);
    const month = monthOffset % 12;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];
    // 前月の空白
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    // 当月の日付
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }

    return { year, month, days };
  };

  const toggleDate = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    const newSelected = new Set(selectedDates);
    if (newSelected.has(dateStr)) {
      newSelected.delete(dateStr);
    } else {
      newSelected.add(dateStr);
    }
    setSelectedDates(newSelected);
  };

  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  const monthNames = [
    "1月", "2月", "3月", "4月", "5月", "6月",
    "7月", "8月", "9月", "10月", "11月", "12月",
  ];

  const dayNames = ["日", "月", "火", "水", "木", "金", "土"];

  // 年度の12ヶ月分（4月〜翌3月）を表示
  const fiscalYearMonths = [
    fiscalYear * 12 + 3,  // 4月
    fiscalYear * 12 + 4,  // 5月
    fiscalYear * 12 + 5,  // 6月
    fiscalYear * 12 + 6,  // 7月
    fiscalYear * 12 + 7,  // 8月
    fiscalYear * 12 + 8,  // 9月
    fiscalYear * 12 + 9,  // 10月
    fiscalYear * 12 + 10, // 11月
    fiscalYear * 12 + 11, // 12月
    (fiscalYear + 1) * 12 + 0, // 1月
    (fiscalYear + 1) * 12 + 1, // 2月
    (fiscalYear + 1) * 12 + 2, // 3月
  ];
  const calendars = fiscalYearMonths.map((m) => generateCalendar(m));

  // 土日を含む総休日数を計算
  const countTotalHolidays = () => {
    let weekendCount = 0;
    let holidayOnlyCount = 0; // 土日以外の休日
    const weekendDates = new Set<string>();

    // 年度の全日付をチェック
    const startDate = new Date(fiscalYear, 3, 1); // 4月1日
    const endDate = new Date(fiscalYear + 1, 2, 31); // 翌3月31日

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];
      if (isWeekend(d)) {
        weekendCount++;
        weekendDates.add(dateStr);
      }
    }

    // 土日以外の休日をカウント
    Array.from(selectedDates).forEach((dateStr) => {
      if (!weekendDates.has(dateStr)) {
        holidayOnlyCount++;
      }
    });

    return {
      weekendCount,
      holidayOnlyCount,
      total: weekendCount + holidayOnlyCount,
    };
  };

  const holidayCounts = countTotalHolidays();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>休日設定（{fiscalYear}年度）</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddNationalHolidays}
              disabled={isPending}
            >
              祝日を自動追加
            </Button>
            <Button size="sm" onClick={handleSaveHolidays} disabled={isPending}>
              保存
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* 総休日数表示 */}
        <div className="flex items-center gap-6 mb-4 p-3 bg-muted rounded-lg">
          <div className="text-sm">
            <span className="text-muted-foreground">土日: </span>
            <span className="font-bold">{holidayCounts.weekendCount}日</span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">祝日等: </span>
            <span className="font-bold">{holidayCounts.holidayOnlyCount}日</span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">総休日数: </span>
            <span className="font-bold text-lg">{holidayCounts.total}日</span>
          </div>
        </div>

        {/* カレンダーグリッド（4列×3行 = 12ヶ月） */}
        <div className="grid grid-cols-4 gap-3">
          {calendars.map((cal, idx) => (
            <div key={idx} className="border rounded-lg p-2">
              <div className="text-center font-medium mb-1 text-sm">
                {cal.year}年{monthNames[cal.month]}
              </div>
              <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
                {dayNames.map((day, i) => (
                  <div
                    key={day}
                    className={`py-0.5 font-medium ${
                      i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : ""
                    }`}
                  >
                    {day}
                  </div>
                ))}
                {cal.days.map((date, i) => {
                  if (!date) {
                    return <div key={`empty-${i}`} />;
                  }
                  const dateStr = date.toISOString().split("T")[0];
                  const isSelected = selectedDates.has(dateStr);
                  const weekend = isWeekend(date);
                  const holiday = holidays.find((h) => h.holiday_date === dateStr);

                  return (
                    <button
                      key={dateStr}
                      type="button"
                      onClick={() => toggleDate(date)}
                      className={`
                        py-0.5 text-xs transition-colors
                        ${weekend ? "border-2 border-red-400 rounded" : ""}
                        ${isSelected ? "bg-red-500 text-white rounded" : ""}
                        ${!isSelected && !weekend ? "hover:bg-gray-100 rounded" : ""}
                      `}
                      title={holiday?.holiday_name || undefined}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* 凡例 */}
        <div className="flex gap-4 mt-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-2 border-red-400" />
            <span>土日</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-500" />
            <span>休日（祝日等）</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// 月別勤務時間設定コンポーネント
// ============================================
function MonthlyHoursSettings({
  calendarSetId,
  fiscalYear,
  monthlyHours,
  onUpdate,
}: {
  calendarSetId: string;
  fiscalYear: number;
  monthlyHours: WorkCalendarMonthlyHours[];
  onUpdate: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [settings, setSettings] = useState<
    { month: number; work_start_time: string; work_end_time: string; break_minutes: number }[]
  >([]);

  // 初期値設定
  useEffect(() => {
    const months = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
    setSettings(
      months.map((month) => {
        const existing = monthlyHours.find((h) => h.month === month);
        return {
          month,
          work_start_time: existing?.work_start_time || "09:00",
          work_end_time: existing?.work_end_time || "18:00",
          break_minutes: existing?.break_minutes ?? 60,
        };
      })
    );
  }, [monthlyHours]);

  const handleSave = async () => {
    startTransition(async () => {
      await setMonthlyHoursBulk(calendarSetId, fiscalYear, settings);
      onUpdate();
    });
  };

  const updateSetting = (
    month: number,
    field: "work_start_time" | "work_end_time" | "break_minutes",
    value: string | number
  ) => {
    setSettings((prev) =>
      prev.map((s) => (s.month === month ? { ...s, [field]: value } : s))
    );
  };

  // 全月に一括適用
  const applyToAll = (source: typeof settings[0]) => {
    setSettings((prev) =>
      prev.map((s) => ({
        ...s,
        work_start_time: source.work_start_time,
        work_end_time: source.work_end_time,
        break_minutes: source.break_minutes,
      }))
    );
  };

  const monthNames = [
    "", "1月", "2月", "3月", "4月", "5月", "6月",
    "7月", "8月", "9月", "10月", "11月", "12月",
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>月別勤務時間設定（{fiscalYear}年度）</CardTitle>
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            保存
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">月</TableHead>
              <TableHead className="w-[120px]">出勤時刻</TableHead>
              <TableHead className="w-[120px]">退勤時刻</TableHead>
              <TableHead className="w-[120px]">休憩時間（分）</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {settings.map((setting, index) => (
              <TableRow key={setting.month}>
                <TableCell className="font-medium">
                  {setting.month >= 4 ? fiscalYear : fiscalYear + 1}年
                  {monthNames[setting.month]}
                </TableCell>
                <TableCell>
                  <Input
                    type="time"
                    value={setting.work_start_time}
                    onChange={(e) =>
                      updateSetting(setting.month, "work_start_time", e.target.value)
                    }
                    className="w-full"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="time"
                    value={setting.work_end_time}
                    onChange={(e) =>
                      updateSetting(setting.month, "work_end_time", e.target.value)
                    }
                    className="w-full"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={setting.break_minutes}
                    onChange={(e) =>
                      updateSetting(setting.month, "break_minutes", parseInt(e.target.value) || 0)
                    }
                    className="w-full"
                    min={0}
                  />
                </TableCell>
                <TableCell>
                  {index === 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => applyToAll(setting)}
                    >
                      全月に適用
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ============================================
// 社員割り当てコンポーネント
// ============================================
function EmployeeAssignment({
  calendarSets,
  employees,
}: {
  calendarSets: WorkCalendarSet[];
  employees: (Employee & { workCalendarSet?: WorkCalendarSet | null })[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleAssign = (employeeId: string, calendarSetId: string | null) => {
    startTransition(async () => {
      await assignCalendarSetToEmployee(employeeId, calendarSetId);
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>社員へのカレンダーセット割り当て</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>社員名</TableHead>
              <TableHead>メールアドレス</TableHead>
              <TableHead className="w-[250px]">カレンダーセット</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((employee) => (
              <TableRow key={employee.id}>
                <TableCell className="font-medium">{employee.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {employee.email}
                </TableCell>
                <TableCell>
                  <Select
                    value={employee.work_calendar_set_id || "__none__"}
                    onValueChange={(value) =>
                      handleAssign(
                        employee.id,
                        value === "__none__" ? null : value
                      )
                    }
                    disabled={isPending}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="未割り当て" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">未割り当て</SelectItem>
                      {calendarSets.map((set) => (
                        <SelectItem key={set.id} value={set.id}>
                          {set.name}
                          {set.is_default && " (デフォルト)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
