"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { Leave, LeaveWithEmployee, LeaveInsert, LeaveType, LeaveStatus, Employee, LeaveBalance, LeaveBalanceWithEmployee, LeaveCategory, LeaveBalanceSummary, LeaveHistoryItem } from "@/types/database";

// 現在のユーザー情報取得
export async function getCurrentEmployee(): Promise<{
  id: string;
  name: string;
  role: string;
} | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const adminClient = createAdminClient();
  const { data: employee } = await adminClient
    .from("employees")
    .select("id, name, role")
    .eq("auth_id", user.id)
    .single();

  return employee || null;
}

// 自分の休暇一覧取得
export async function getMyLeaves(): Promise<LeaveWithEmployee[]> {
  const supabase = await createClient();
  const employee = await getCurrentEmployee();

  if (!employee) return [];

  const { data, error } = await supabase
    .from("leaves")
    .select(`
      *,
      employee:employees!leaves_employee_id_fkey(id, name, email, role),
      approver:employees!leaves_approved_by_fkey(id, name, email, role)
    `)
    .eq("employee_id", employee.id)
    .order("leave_date", { ascending: false });

  if (error) {
    console.error("Error fetching leaves:", error);
    return [];
  }

  return (data || []) as LeaveWithEmployee[];
}

// 全休暇一覧取得（管理者/マネージャー用）
export async function getAllLeaves(): Promise<LeaveWithEmployee[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("leaves")
    .select(`
      *,
      employee:employees!leaves_employee_id_fkey(id, name, email, role),
      approver:employees!leaves_approved_by_fkey(id, name, email, role)
    `)
    .order("leave_date", { ascending: false });

  if (error) {
    console.error("Error fetching all leaves:", error);
    return [];
  }

  return (data || []) as LeaveWithEmployee[];
}

// 申請中の休暇数取得（管理者/マネージャー用）
export async function getPendingLeavesCount(): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("leaves")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  if (error) {
    console.error("Error fetching pending leaves count:", error);
    return 0;
  }

  return count || 0;
}

// 休暇申請
export async function createLeave(data: {
  leave_date: string;
  leave_type: LeaveType;
  adjustment?: string;
  reason?: string;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const employee = await getCurrentEmployee();

  if (!employee) {
    return { success: false, error: "ログインが必要です" };
  }

  const { error } = await supabase
    .from("leaves")
    .insert({
      employee_id: employee.id,
      leave_date: data.leave_date,
      leave_type: data.leave_type,
      adjustment: data.adjustment || null,
      reason: data.reason || null,
      status: "pending",
    });

  if (error) {
    console.error("Error creating leave:", error);
    return { success: false, error: "休暇申請に失敗しました" };
  }

  revalidatePath("/leaves");
  return { success: true };
}

// 休暇追加（管理者/マネージャー用 - 他の社員の休暇も追加可能）
export async function addLeaveByManager(data: {
  employee_id: string;
  leave_date: string;
  leave_type: LeaveType;
  adjustment?: string;
  reason?: string;
  status?: "pending" | "approved";
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const currentEmployee = await getCurrentEmployee();

  if (!currentEmployee) {
    return { success: false, error: "ログインが必要です" };
  }

  if (currentEmployee.role !== "admin" && currentEmployee.role !== "manager") {
    return { success: false, error: "権限がありません" };
  }

  const insertData: LeaveInsert = {
    employee_id: data.employee_id,
    leave_date: data.leave_date,
    leave_type: data.leave_type,
    adjustment: data.adjustment || null,
    reason: data.reason || null,
    status: data.status || "approved",
  };

  const { error } = await supabase.from("leaves").insert(insertData);

  if (error) {
    console.error("Error adding leave:", error);
    return { success: false, error: "休暇追加に失敗しました" };
  }

  revalidatePath("/leaves");
  return { success: true };
}

// 休暇承認
export async function approveLeave(leaveId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const currentEmployee = await getCurrentEmployee();

  if (!currentEmployee) {
    return { success: false, error: "ログインが必要です" };
  }

  if (currentEmployee.role !== "admin" && currentEmployee.role !== "manager") {
    return { success: false, error: "権限がありません" };
  }

  const { error } = await supabase
    .from("leaves")
    .update({
      status: "approved",
      approved_by: currentEmployee.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", leaveId);

  if (error) {
    console.error("Error approving leave:", error);
    return { success: false, error: "承認に失敗しました" };
  }

  revalidatePath("/leaves");
  return { success: true };
}

// 休暇差戻し
export async function rejectLeave(
  leaveId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const currentEmployee = await getCurrentEmployee();

  if (!currentEmployee) {
    return { success: false, error: "ログインが必要です" };
  }

  if (currentEmployee.role !== "admin" && currentEmployee.role !== "manager") {
    return { success: false, error: "権限がありません" };
  }

  const { error } = await supabase
    .from("leaves")
    .update({
      status: "rejected",
      approved_by: currentEmployee.id,
      approved_at: new Date().toISOString(),
      rejection_reason: reason,
    })
    .eq("id", leaveId);

  if (error) {
    console.error("Error rejecting leave:", error);
    return { success: false, error: "差戻しに失敗しました" };
  }

  revalidatePath("/leaves");
  return { success: true };
}

// 休暇削除
export async function deleteLeave(leaveId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("leaves")
    .delete()
    .eq("id", leaveId);

  if (error) {
    console.error("Error deleting leave:", error);
    return { success: false, error: "削除に失敗しました" };
  }

  revalidatePath("/leaves");
  return { success: true };
}

// 全社員取得（管理者/マネージャー用）
export async function getEmployeesForLeave(): Promise<Employee[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .order("name");

  if (error) {
    console.error("Error fetching employees:", error);
    return [];
  }

  return (data || []) as Employee[];
}

// ============================================
// 休暇残日数管理
// ============================================

// 休暇残日数一覧取得（管理者/マネージャー用）
export async function getAllLeaveBalances(): Promise<LeaveBalanceWithEmployee[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("leave_balances")
    .select(`
      *,
      employee:employees!leave_balances_employee_id_fkey(id, name, email, role),
      creator:employees!leave_balances_created_by_fkey(id, name, email, role)
    `)
    .order("granted_at", { ascending: false });

  if (error) {
    console.error("Error fetching leave balances:", error);
    return [];
  }

  return (data || []) as LeaveBalanceWithEmployee[];
}

// 自分の休暇残日数取得
export async function getMyLeaveBalances(): Promise<LeaveBalanceWithEmployee[]> {
  const supabase = await createClient();
  const employee = await getCurrentEmployee();

  if (!employee) return [];

  const { data, error } = await supabase
    .from("leave_balances")
    .select(`
      *,
      employee:employees!leave_balances_employee_id_fkey(id, name, email, role),
      creator:employees!leave_balances_created_by_fkey(id, name, email, role)
    `)
    .eq("employee_id", employee.id)
    .order("granted_at", { ascending: false });

  if (error) {
    console.error("Error fetching my leave balances:", error);
    return [];
  }

  return (data || []) as LeaveBalanceWithEmployee[];
}

// 休暇付与（管理者/マネージャー用）
export async function grantLeaveBalance(data: {
  employee_id: string;
  leave_category: LeaveCategory;
  granted_days: number;
  fiscal_year: number;
  granted_at: string;
  note?: string;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const currentEmployee = await getCurrentEmployee();

  if (!currentEmployee) {
    return { success: false, error: "ログインが必要です" };
  }

  if (currentEmployee.role !== "admin" && currentEmployee.role !== "manager") {
    return { success: false, error: "権限がありません" };
  }

  // 冬季休暇は1月〜3月のみ有効
  let validFrom: string | null = null;
  let expiresAt: string | null = null;

  if (data.leave_category === "冬季休暇") {
    // 年度に対応する1月1日〜3月31日を設定
    // 例: 2024年度の冬季休暇 → 2025年1月1日〜2025年3月31日
    const year = data.fiscal_year + 1;
    validFrom = `${year}-01-01`;
    expiresAt = `${year}-03-31`;
  }

  const { error } = await supabase
    .from("leave_balances")
    .insert({
      employee_id: data.employee_id,
      leave_category: data.leave_category,
      granted_days: data.granted_days,
      fiscal_year: data.fiscal_year,
      granted_at: data.granted_at,
      valid_from: validFrom,
      expires_at: expiresAt,
      note: data.note || null,
      created_by: currentEmployee.id,
    });

  if (error) {
    console.error("Error granting leave balance:", error);
    return { success: false, error: "休暇付与に失敗しました" };
  }

  revalidatePath("/leaves");
  return { success: true };
}

// 休暇付与削除（管理者/マネージャー用）
export async function deleteLeaveBalance(balanceId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const currentEmployee = await getCurrentEmployee();

  if (!currentEmployee) {
    return { success: false, error: "ログインが必要です" };
  }

  if (currentEmployee.role !== "admin" && currentEmployee.role !== "manager") {
    return { success: false, error: "権限がありません" };
  }

  const { error } = await supabase
    .from("leave_balances")
    .delete()
    .eq("id", balanceId);

  if (error) {
    console.error("Error deleting leave balance:", error);
    return { success: false, error: "削除に失敗しました" };
  }

  revalidatePath("/leaves");
  return { success: true };
}

// 休暇残日数サマリー取得
export async function getLeaveBalanceSummary(employeeId?: string): Promise<LeaveBalanceSummary[]> {
  const supabase = await createClient();
  const currentEmployee = await getCurrentEmployee();

  if (!currentEmployee) return [];

  // 対象社員ID（指定がなければ自分）
  const targetEmployeeId = employeeId || currentEmployee.id;

  // 管理者/マネージャー以外は自分のみ
  if (targetEmployeeId !== currentEmployee.id &&
      currentEmployee.role !== "admin" && currentEmployee.role !== "manager") {
    return [];
  }

  // 付与日数を取得
  const { data: balances, error: balanceError } = await supabase
    .from("leave_balances")
    .select("employee_id, leave_category, granted_days")
    .eq("employee_id", targetEmployeeId);

  if (balanceError) {
    console.error("Error fetching balances:", balanceError);
    return [];
  }

  // 使用日数を取得（承認済みの休暇のみ）
  const { data: leaves, error: leaveError } = await supabase
    .from("leaves")
    .select("employee_id, leave_type")
    .eq("employee_id", targetEmployeeId)
    .eq("status", "approved");

  if (leaveError) {
    console.error("Error fetching leaves:", leaveError);
    return [];
  }

  // 社員名を取得
  const adminClient = createAdminClient();
  const { data: employee } = await adminClient
    .from("employees")
    .select("name")
    .eq("id", targetEmployeeId)
    .single();

  const employeeName = employee?.name || "";

  // カテゴリごとに集計
  const summaryMap: Record<string, { granted: number; used: number }> = {
    "有給休暇": { granted: 0, used: 0 },
    "冬季休暇": { granted: 0, used: 0 },
  };

  // 付与日数を集計
  for (const balance of balances || []) {
    const category = balance.leave_category as LeaveCategory;
    if (summaryMap[category]) {
      summaryMap[category].granted += Number(balance.granted_days);
    }
  }

  // 使用日数を集計
  for (const leave of leaves || []) {
    const leaveType = leave.leave_type as string;
    let category: LeaveCategory | null = null;
    let days = 0;

    if (leaveType.startsWith("有給休暇")) {
      category = "有給休暇";
    } else if (leaveType.startsWith("冬季休暇")) {
      category = "冬季休暇";
    }

    if (leaveType.includes("全日")) {
      days = 1;
    } else if (leaveType.includes("午前") || leaveType.includes("午後")) {
      days = 0.5;
    }

    if (category && summaryMap[category]) {
      summaryMap[category].used += days;
    }
  }

  // サマリーを生成
  const result: LeaveBalanceSummary[] = [];
  for (const [category, data] of Object.entries(summaryMap)) {
    result.push({
      employee_id: targetEmployeeId,
      employee_name: employeeName,
      leave_category: category as LeaveCategory,
      total_granted: data.granted,
      total_used: data.used,
      remaining: data.granted - data.used,
    });
  }

  return result;
}

// 指定日に取得可能な休暇種類を取得（残日数があり、有効期間内のもの）
export async function getAvailableLeaveTypes(leaveDate: string): Promise<{
  category: LeaveCategory | "無給休暇";
  remaining: number;
  leaveTypes: string[];
}[]> {
  const supabase = await createClient();
  const currentEmployee = await getCurrentEmployee();

  if (!currentEmployee) return [];

  // 付与日数を取得（有効期間内のもののみ）
  const { data: balances, error: balanceError } = await supabase
    .from("leave_balances")
    .select("leave_category, granted_days, valid_from, expires_at")
    .eq("employee_id", currentEmployee.id);

  if (balanceError) {
    console.error("Error fetching balances:", balanceError);
    return [];
  }

  // 使用日数を取得（承認済み + 申請中の休暇）
  const { data: leaves, error: leaveError } = await supabase
    .from("leaves")
    .select("leave_type")
    .eq("employee_id", currentEmployee.id)
    .in("status", ["approved", "pending"]);

  if (leaveError) {
    console.error("Error fetching leaves:", leaveError);
    return [];
  }

  // カテゴリごとに集計（有効期間内のもののみ）
  const summaryMap: Record<LeaveCategory, number> = {
    "有給休暇": 0,
    "冬季休暇": 0,
  };

  const leaveDateObj = new Date(leaveDate);

  for (const balance of balances || []) {
    const category = balance.leave_category as LeaveCategory;
    const validFrom = balance.valid_from;
    const expiresAt = balance.expires_at;

    // 有効期間チェック（Date オブジェクトで比較）
    if (validFrom) {
      const validFromDate = new Date(validFrom);
      if (leaveDateObj < validFromDate) continue;
    }
    if (expiresAt) {
      const expiresAtDate = new Date(expiresAt);
      if (leaveDateObj > expiresAtDate) continue;
    }

    if (summaryMap[category] !== undefined) {
      summaryMap[category] += Number(balance.granted_days);
    }
  }

  // 使用日数を減算
  for (const leave of leaves || []) {
    const leaveType = leave.leave_type as string;
    let category: LeaveCategory | null = null;
    let days = 0;

    if (leaveType.startsWith("有給休暇")) {
      category = "有給休暇";
    } else if (leaveType.startsWith("冬季休暇")) {
      category = "冬季休暇";
    }

    if (leaveType.includes("全日")) {
      days = 1;
    } else if (leaveType.includes("午前") || leaveType.includes("午後")) {
      days = 0.5;
    }

    if (category && summaryMap[category] !== undefined) {
      summaryMap[category] -= days;
    }
  }

  // 残日数がある休暇種類のみ返す
  const result: { category: LeaveCategory | "無給休暇"; remaining: number; leaveTypes: string[] }[] = [];

  for (const [category, remaining] of Object.entries(summaryMap)) {
    if (remaining > 0) {
      const leaveTypes = [
        `${category}（全日）`,
        `${category}（午前）`,
        `${category}（午後）`,
      ];
      result.push({
        category: category as LeaveCategory,
        remaining,
        leaveTypes,
      });
    }
  }

  // 無給休暇は常に選択可能（残日数制限なし）
  result.push({
    category: "無給休暇",
    remaining: -1, // -1は無制限を示す
    leaveTypes: [
      "無給休暇（全日）",
      "無給休暇（午前）",
      "無給休暇（午後）",
    ],
  });

  return result;
}

// 全社員の休暇残日数サマリー取得（管理者/マネージャー用）
export async function getAllLeaveBalanceSummaries(): Promise<LeaveBalanceSummary[]> {
  const supabase = await createClient();
  const currentEmployee = await getCurrentEmployee();

  if (!currentEmployee) return [];

  if (currentEmployee.role !== "admin" && currentEmployee.role !== "manager") {
    return [];
  }

  // 全社員を取得
  const { data: employees, error: empError } = await supabase
    .from("employees")
    .select("id, name")
    .order("name");

  if (empError || !employees) {
    console.error("Error fetching employees:", empError);
    return [];
  }

  // 全付与日数を取得
  const { data: balances, error: balanceError } = await supabase
    .from("leave_balances")
    .select("employee_id, leave_category, granted_days");

  if (balanceError) {
    console.error("Error fetching balances:", balanceError);
    return [];
  }

  // 全使用日数を取得（承認済みの休暇のみ）
  const { data: leaves, error: leaveError } = await supabase
    .from("leaves")
    .select("employee_id, leave_type")
    .eq("status", "approved");

  if (leaveError) {
    console.error("Error fetching leaves:", leaveError);
    return [];
  }

  // 社員ごと・カテゴリごとに集計
  const summaryMap: Record<string, Record<string, { granted: number; used: number; name: string }>> = {};

  for (const emp of employees) {
    summaryMap[emp.id] = {
      "有給休暇": { granted: 0, used: 0, name: emp.name },
      "冬季休暇": { granted: 0, used: 0, name: emp.name },
    };
  }

  // 付与日数を集計
  for (const balance of balances || []) {
    const empId = balance.employee_id;
    const category = balance.leave_category as LeaveCategory;
    if (summaryMap[empId]?.[category]) {
      summaryMap[empId][category].granted += Number(balance.granted_days);
    }
  }

  // 使用日数を集計
  for (const leave of leaves || []) {
    const empId = leave.employee_id;
    const leaveType = leave.leave_type as string;
    let category: LeaveCategory | null = null;
    let days = 0;

    if (leaveType.startsWith("有給休暇")) {
      category = "有給休暇";
    } else if (leaveType.startsWith("冬季休暇")) {
      category = "冬季休暇";
    }

    if (leaveType.includes("全日")) {
      days = 1;
    } else if (leaveType.includes("午前") || leaveType.includes("午後")) {
      days = 0.5;
    }

    if (category && summaryMap[empId]?.[category]) {
      summaryMap[empId][category].used += days;
    }
  }

  // サマリーを生成
  const result: LeaveBalanceSummary[] = [];
  for (const [empId, categories] of Object.entries(summaryMap)) {
    for (const [category, data] of Object.entries(categories)) {
      result.push({
        employee_id: empId,
        employee_name: data.name,
        leave_category: category as LeaveCategory,
        total_granted: data.granted,
        total_used: data.used,
        remaining: data.granted - data.used,
      });
    }
  }

  return result;
}

// 休暇履歴取得（付与と使用を統合した時系列データ）
export async function getLeaveHistory(employeeId?: string): Promise<LeaveHistoryItem[]> {
  const supabase = await createClient();
  const currentEmployee = await getCurrentEmployee();

  if (!currentEmployee) return [];

  const isManager = currentEmployee.role === "admin" || currentEmployee.role === "manager";

  // 管理者/マネージャーは全員分、一般社員は自分のみ
  let balancesQuery = supabase
    .from("leave_balances")
    .select("id, employee_id, leave_category, granted_days, fiscal_year, granted_at, note")
    .order("granted_at", { ascending: true });

  let leavesQuery = supabase
    .from("leaves")
    .select("id, employee_id, leave_date, leave_type, status, reason")
    .order("leave_date", { ascending: true });

  if (!isManager) {
    balancesQuery = balancesQuery.eq("employee_id", currentEmployee.id);
    leavesQuery = leavesQuery.eq("employee_id", currentEmployee.id);
  } else if (employeeId) {
    balancesQuery = balancesQuery.eq("employee_id", employeeId);
    leavesQuery = leavesQuery.eq("employee_id", employeeId);
  }

  const [{ data: balances, error: balanceError }, { data: leaves, error: leaveError }] = await Promise.all([
    balancesQuery,
    leavesQuery,
  ]);

  if (balanceError || leaveError) {
    console.error("Error fetching history:", balanceError || leaveError);
    return [];
  }

  // 社員名を取得
  const employeeIds = new Set<string>();
  (balances || []).forEach((b) => employeeIds.add(b.employee_id));
  (leaves || []).forEach((l) => employeeIds.add(l.employee_id));

  const adminClient = createAdminClient();
  const { data: employees } = await adminClient
    .from("employees")
    .select("id, name")
    .in("id", Array.from(employeeIds));

  const employeeNameMap: Record<string, string> = {};
  (employees || []).forEach((e) => {
    employeeNameMap[e.id] = e.name;
  });

  // 付与と使用を統合
  const historyItems: {
    id: string;
    date: string;
    type: "grant" | "use";
    employee_id: string;
    leave_category: LeaveCategory | "無給休暇";
    days: number;
    leave_type?: string;
    status?: string;
    note?: string | null;
    fiscal_year?: number;
  }[] = [];

  // 付与を追加
  for (const balance of balances || []) {
    historyItems.push({
      id: balance.id,
      date: balance.granted_at,
      type: "grant",
      employee_id: balance.employee_id,
      leave_category: balance.leave_category as LeaveCategory,
      days: Number(balance.granted_days),
      note: balance.note,
      fiscal_year: balance.fiscal_year,
    });
  }

  // 使用を追加
  for (const leave of leaves || []) {
    const leaveType = leave.leave_type as string;
    let category: LeaveCategory | "無給休暇" | null = null;
    let days = 0;

    if (leaveType.startsWith("有給休暇")) {
      category = "有給休暇";
    } else if (leaveType.startsWith("冬季休暇")) {
      category = "冬季休暇";
    } else if (leaveType.startsWith("無給休暇")) {
      category = "無給休暇";
    }

    if (leaveType.includes("全日")) {
      days = 1;
    } else if (leaveType.includes("午前") || leaveType.includes("午後")) {
      days = 0.5;
    }

    if (category) {
      historyItems.push({
        id: leave.id,
        date: leave.leave_date,
        type: "use",
        employee_id: leave.employee_id,
        leave_category: category,
        days: -days,  // 使用はマイナス
        leave_type: leave.leave_type,
        status: leave.status,
        note: leave.reason,
      });
    }
  }

  // 日付でソート（古い順）
  historyItems.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    // 同じ日付なら付与を先に
    if (a.type === "grant" && b.type === "use") return -1;
    if (a.type === "use" && b.type === "grant") return 1;
    return 0;
  });

  // 残日数を計算しながら結果を生成
  const balanceMap: Record<string, { 有給休暇: number; 冬季休暇: number }> = {};

  const historyResult: LeaveHistoryItem[] = [];

  for (const item of historyItems) {
    // 社員ごとの残日数を初期化
    if (!balanceMap[item.employee_id]) {
      balanceMap[item.employee_id] = { 有給休暇: 0, 冬季休暇: 0 };
    }

    // 承認済みの使用、または付与のみ残日数に影響（無給休暇は残日数に影響しない）
    if (item.leave_category !== "無給休暇") {
      if (item.type === "grant" || (item.type === "use" && item.status === "approved")) {
        balanceMap[item.employee_id][item.leave_category] += item.days;
      }
    }

    historyResult.push({
      id: item.id,
      date: item.date,
      type: item.type,
      employee_id: item.employee_id,
      employee_name: employeeNameMap[item.employee_id] || "",
      leave_category: item.leave_category,
      days: item.days,
      leave_type: item.leave_type as LeaveType | undefined,
      status: item.status as LeaveStatus | undefined,
      note: item.note,
      fiscal_year: item.fiscal_year,
      balance_after: { ...balanceMap[item.employee_id] },
    });
  }

  // 新しい順に並べ替え
  historyResult.reverse();

  return historyResult;
}
