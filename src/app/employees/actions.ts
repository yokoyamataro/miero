"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { EmployeeRole } from "@/types/database";

export interface EmployeeData {
  name: string;
  email: string;
  role: EmployeeRole;
}

export async function getEmployeeById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching employee:", error);
    return null;
  }

  return data;
}

// 社員と認証ユーザーを同時に作成
export async function createEmployeeWithAuth(data: EmployeeData, password: string) {
  const supabase = await createClient();

  try {
    const adminClient = createAdminClient();

    // 1. 認証ユーザーを作成
    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
      email: data.email,
      password: password,
      email_confirm: true, // メール確認をスキップ
    });

    if (authError) {
      console.error("Error creating auth user:", authError);
      if (authError.message.includes("already been registered")) {
        return { error: "このメールアドレスは既に登録されています" };
      }
      return { error: authError.message };
    }

    // 2. 社員テーブルに登録（auth_idと紐付け）
    const { error: employeeError } = await supabase.from("employees").insert({
      name: data.name,
      email: data.email,
      role: data.role,
      auth_id: authUser.user.id,
    });

    if (employeeError) {
      // 社員登録に失敗した場合、認証ユーザーを削除
      await adminClient.auth.admin.deleteUser(authUser.user.id);
      console.error("Error creating employee:", employeeError);
      return { error: employeeError.message };
    }

    revalidatePath("/employees");
    return { success: true };
  } catch (error) {
    console.error("Error in createEmployeeWithAuth:", error);
    return { error: "社員の作成に失敗しました" };
  }
}

// 既存の社員作成（認証なし）- 互換性のため残す
export async function createEmployee(data: EmployeeData) {
  const supabase = await createClient();

  const { error } = await supabase.from("employees").insert({
    name: data.name,
    email: data.email,
    role: data.role,
  });

  if (error) {
    console.error("Error creating employee:", error);
    return { error: error.message };
  }

  revalidatePath("/employees");
  return { success: true };
}

export async function updateEmployee(id: string, data: EmployeeData) {
  const supabase = await createClient();

  // 現在の社員情報を取得
  const { data: currentEmployee } = await supabase
    .from("employees")
    .select("email, auth_id")
    .eq("id", id)
    .single();

  // メールアドレスが変更された場合、Supabase Authも更新
  if (currentEmployee?.auth_id && currentEmployee.email !== data.email) {
    try {
      const adminClient = createAdminClient();
      const { error: authError } = await adminClient.auth.admin.updateUserById(
        currentEmployee.auth_id,
        { email: data.email }
      );

      if (authError) {
        console.error("Error updating auth email:", authError);
        if (authError.message.includes("already been registered")) {
          return { error: "このメールアドレスは既に使用されています" };
        }
        return { error: "メールアドレスの更新に失敗しました: " + authError.message };
      }
    } catch (error) {
      console.error("Error updating auth email:", error);
      return { error: "メールアドレスの更新に失敗しました" };
    }
  }

  // 社員テーブルを更新
  const { error } = await supabase
    .from("employees")
    .update({
      name: data.name,
      email: data.email,
      role: data.role,
    })
    .eq("id", id);

  if (error) {
    console.error("Error updating employee:", error);
    return { error: error.message };
  }

  revalidatePath("/employees");
  return { success: true };
}

export async function deleteEmployee(id: string) {
  const supabase = await createClient();

  // まず社員のauth_idを取得
  const { data: employee } = await supabase
    .from("employees")
    .select("auth_id")
    .eq("id", id)
    .single();

  // 社員を削除
  const { error } = await supabase.from("employees").delete().eq("id", id);

  if (error) {
    console.error("Error deleting employee:", error);
    return { error: error.message };
  }

  // 認証ユーザーも削除
  if (employee?.auth_id) {
    try {
      const adminClient = createAdminClient();
      await adminClient.auth.admin.deleteUser(employee.auth_id);
    } catch (authError) {
      console.error("Error deleting auth user:", authError);
      // 認証ユーザーの削除に失敗しても、社員は削除済みなので続行
    }
  }

  revalidatePath("/employees");
  return { success: true };
}

// パスワードリセット
export async function resetEmployeePassword(employeeId: string, newPassword: string) {
  const supabase = await createClient();

  // 社員のauth_idを取得
  const { data: employee } = await supabase
    .from("employees")
    .select("auth_id")
    .eq("id", employeeId)
    .single();

  if (!employee?.auth_id) {
    return { error: "この社員にはログインアカウントが設定されていません" };
  }

  try {
    const adminClient = createAdminClient();
    const { error } = await adminClient.auth.admin.updateUserById(employee.auth_id, {
      password: newPassword,
    });

    if (error) {
      console.error("Error resetting password:", error);
      return { error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Error in resetEmployeePassword:", error);
    return { error: "パスワードのリセットに失敗しました" };
  }
}
