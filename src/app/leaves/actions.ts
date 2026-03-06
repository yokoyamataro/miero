"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type {
  LeaveWithEmployee,
  LeaveType,
  Employee,
  LeaveCategory,
  LeaveBalanceSummary,
} from "@/types/database";

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

// ============================================
// 休暇データ取得
// ============================================

// 全休暇一覧取得（統合テーブルから）
export async function getAllLeaves(): Promise<LeaveWithEmployee[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("leaves")
    .select(`
      *,
      employee:employees!leaves_employee_id_fkey(id, name, email, role),
      approver:employees!leaves_approved_by_fkey(id, name, email, role),
      granter:employees!leaves_granted_by_fkey(id, name, email, role)
    `)
    .order("leave_date", { ascending: false });

  if (error) {
    console.error("Error fetching all leaves:", error);
    return [];
  }

  return (data || []) as LeaveWithEmployee[];
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
      approver:employees!leaves_approved_by_fkey(id, name, email, role),
      granter:employees!leaves_granted_by_fkey(id, name, email, role)
    `)
    .eq("employee_id", employee.id)
    .order("leave_date", { ascending: false });

  if (error) {
    console.error("Error fetching leaves:", error);
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
    .eq("status", "pending")
    .eq("entry_type", "use");

  if (error) {
    console.error("Error fetching pending leaves count:", error);
    return 0;
  }

  return count || 0;
}

// ============================================
// 休暇申請（使用）
// ============================================

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

  // leave_type から leave_category と days を計算
  const leaveType = data.leave_type;
  let leaveCategory: LeaveCategory = "無給休暇";
  let days = -1;

  if (leaveType.startsWith("有給休暇")) {
    leaveCategory = "有給休暇";
  } else if (leaveType.startsWith("冬季休暇")) {
    leaveCategory = "冬季休暇";
  } else if (leaveType.startsWith("無給休暇")) {
    leaveCategory = "無給休暇";
  }

  if (leaveType.includes("全日")) {
    days = -1;
  } else if (leaveType.includes("午前") || leaveType.includes("午後")) {
    days = -0.5;
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
      entry_type: "use",
      leave_category: leaveCategory,
      days: days,
    });

  if (error) {
    console.error("Error creating leave:", error);
    return { success: false, error: "休暇申請に失敗しました" };
  }

  revalidatePath("/leaves");
  return { success: true };
}

// ============================================
// 休暇付与（管理者/マネージャー用）
// ============================================

// 休暇付与
export async function grantLeaveBalance(data: {
  employee_id: string;
  leave_category: LeaveCategory;
  granted_days: number;
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

  // 冬季休暇は付与日から翌年3月31日まで有効
  let expiresAt: string | null = null;

  if (data.leave_category === "冬季休暇") {
    const grantedDate = new Date(data.granted_at);
    const grantedYear = grantedDate.getFullYear();
    const grantedMonth = grantedDate.getMonth() + 1;
    const expiryYear = grantedMonth <= 3 ? grantedYear : grantedYear + 1;
    expiresAt = `${expiryYear}-03-31`;
  }

  const { error } = await supabase
    .from("leaves")
    .insert({
      employee_id: data.employee_id,
      leave_date: data.granted_at,
      leave_type: "有給休暇（全日）", // ダミー値（付与では使用しない）
      reason: data.note || null,
      status: "approved",
      entry_type: "grant",
      leave_category: data.leave_category,
      days: data.granted_days,
      expires_at: expiresAt,
      granted_by: currentEmployee.id,
    });

  if (error) {
    console.error("Error granting leave balance:", error);
    return { success: false, error: "休暇付与に失敗しました" };
  }

  revalidatePath("/leaves");
  return { success: true };
}

// ============================================
// 承認・差戻し・削除
// ============================================

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

// ============================================
// 社員取得
// ============================================

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
// 残日数計算（統合テーブルから）
// ============================================

// 休暇残日数サマリー取得
export async function getLeaveBalanceSummary(employeeId?: string): Promise<LeaveBalanceSummary[]> {
  const supabase = await createClient();
  const currentEmployee = await getCurrentEmployee();

  if (!currentEmployee) return [];

  const targetEmployeeId = employeeId || currentEmployee.id;

  // 管理者/マネージャー以外は自分のみ
  if (targetEmployeeId !== currentEmployee.id &&
      currentEmployee.role !== "admin" && currentEmployee.role !== "manager") {
    return [];
  }

  // 統合テーブルから取得
  const { data: leaves, error } = await supabase
    .from("leaves")
    .select("entry_type, leave_category, days, status")
    .eq("employee_id", targetEmployeeId);

  if (error) {
    console.error("Error fetching leaves:", error);
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

  for (const leave of leaves || []) {
    const category = leave.leave_category;
    if (!summaryMap[category]) continue;

    if (leave.entry_type === "grant") {
      summaryMap[category].granted += Number(leave.days);
    } else if (leave.entry_type === "use" && leave.status === "approved") {
      summaryMap[category].used += Math.abs(Number(leave.days));
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

  // 全休暇データを取得
  const { data: leaves, error: leaveError } = await supabase
    .from("leaves")
    .select("employee_id, entry_type, leave_category, days, status");

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

  for (const leave of leaves || []) {
    const empId = leave.employee_id;
    const category = leave.leave_category;
    if (!summaryMap[empId]?.[category]) continue;

    if (leave.entry_type === "grant") {
      summaryMap[empId][category].granted += Number(leave.days);
    } else if (leave.entry_type === "use" && leave.status === "approved") {
      summaryMap[empId][category].used += Math.abs(Number(leave.days));
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

// 指定日に取得可能な休暇種類を取得
export async function getAvailableLeaveTypes(leaveDate: string): Promise<{
  category: LeaveCategory;
  remaining: number;
  leaveTypes: string[];
}[]> {
  const supabase = await createClient();
  const currentEmployee = await getCurrentEmployee();

  if (!currentEmployee) return [];

  // 統合テーブルから取得
  const { data: leaves, error } = await supabase
    .from("leaves")
    .select("entry_type, leave_category, days, status, expires_at, leave_date")
    .eq("employee_id", currentEmployee.id);

  if (error) {
    console.error("Error fetching leaves:", error);
    return [];
  }

  const leaveDateObj = new Date(leaveDate);

  // カテゴリごとに集計
  const summaryMap: Record<string, number> = {
    "有給休暇": 0,
    "冬季休暇": 0,
  };

  for (const leave of leaves || []) {
    const category = leave.leave_category;
    if (!summaryMap.hasOwnProperty(category)) continue;

    if (leave.entry_type === "grant") {
      // 有効期限チェック
      if (leave.expires_at) {
        const expiresAtDate = new Date(leave.expires_at);
        if (leaveDateObj > expiresAtDate) continue;
      }
      // 付与日チェック（付与日より前は使用不可）
      const grantDate = new Date(leave.leave_date);
      if (leaveDateObj < grantDate) continue;

      summaryMap[category] += Number(leave.days);
    } else if (leave.entry_type === "use" && (leave.status === "approved" || leave.status === "pending")) {
      summaryMap[category] += Number(leave.days); // days はマイナス値
    }
  }

  // 残日数がある休暇種類のみ返す
  const result: { category: LeaveCategory; remaining: number; leaveTypes: string[] }[] = [];

  for (const [category, remaining] of Object.entries(summaryMap)) {
    if (remaining > 0) {
      result.push({
        category: category as LeaveCategory,
        remaining,
        leaveTypes: [
          `${category}（全日）`,
          `${category}（午前）`,
          `${category}（午後）`,
        ],
      });
    }
  }

  // 無給休暇は常に選択可能
  result.push({
    category: "無給休暇" as LeaveCategory,
    remaining: -1,
    leaveTypes: [
      "無給休暇（全日）",
      "無給休暇（午前）",
      "無給休暇（午後）",
    ],
  });

  return result;
}
