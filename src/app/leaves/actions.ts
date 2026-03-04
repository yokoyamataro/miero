"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { Leave, LeaveWithEmployee, LeaveInsert, LeaveType, Employee } from "@/types/database";

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
