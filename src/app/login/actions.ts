"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function login(email: string, password: string) {
  const supabase = await createClient();

  // Supabase認証でログイン
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: "メールアドレスまたはパスワードが正しくありません" };
  }

  // RLSをバイパスして社員確認（ログイン直後はセッションが不安定なため）
  const adminClient = createAdminClient();
  const { data: employee, error: employeeError } = await adminClient
    .from("employees")
    .select("id, name, auth_id")
    .eq("auth_id", data.user.id)
    .single();

  console.log("Login check - user.id:", data.user.id);
  console.log("Login check - employee:", employee);
  console.log("Login check - employeeError:", employeeError);

  if (employeeError || !employee) {
    // 社員として登録されていない場合はログアウト
    await supabase.auth.signOut();
    return { error: `このアカウントは社員として登録されていません (user.id: ${data.user.id})` };
  }

  return { success: true, employee };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

export async function getCurrentEmployee() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("*")
    .eq("auth_id", user.id)
    .single();

  return employee;
}
