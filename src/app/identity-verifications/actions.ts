"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type {
  IdentityVerification,
  IdentityVerificationInsert,
  IdentityVerificationTransaction,
  IdentityVerificationTransactionInsert,
  IdentityVerificationDocument,
  IdentityVerificationWithDetails,
  Employee,
} from "@/types/database";

const STORAGE_BUCKET = "identity-documents";

async function getCurrentEmployeeIdInternal(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_id", user.id)
    .single();
  return employee?.id || null;
}

// 一覧取得
export async function getIdentityVerifications(): Promise<IdentityVerification[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("identity_verifications")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching identity verifications:", error);
    return [];
  }
  return (data as IdentityVerification[]) || [];
}

// 1件取得（受託事務・身分証・作成者情報を含む）
export async function getIdentityVerification(
  id: string
): Promise<IdentityVerificationWithDetails | null> {
  const supabase = await createClient();

  const { data: verification, error } = await supabase
    .from("identity_verifications")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !verification) return null;

  const { data: transactions } = await supabase
    .from("identity_verification_transactions")
    .select("*")
    .eq("verification_id", id)
    .order("sort_order", { ascending: true });

  const { data: documents } = await supabase
    .from("identity_verification_documents")
    .select("*")
    .eq("verification_id", id)
    .order("uploaded_at", { ascending: true });

  let creator: Employee | null = null;
  const v = verification as IdentityVerification;
  if (v.created_by) {
    const { data: emp } = await supabase
      .from("employees")
      .select("*")
      .eq("id", v.created_by)
      .single();
    creator = (emp as Employee) || null;
  }

  return {
    ...v,
    transactions: (transactions as IdentityVerificationTransaction[]) || [],
    documents: (documents as IdentityVerificationDocument[]) || [],
    creator,
  };
}

// 新規作成
export async function createIdentityVerification(
  data: IdentityVerificationInsert,
  transactions: IdentityVerificationTransactionInsert[]
): Promise<{ success?: boolean; error?: string; id?: string }> {
  const supabase = await createClient();

  const employeeId = await getCurrentEmployeeIdInternal(supabase);
  if (!employeeId) return { error: "ログインが必要です" };

  const { data: created, error } = await supabase
    .from("identity_verifications")
    .insert({
      ...data,
      created_by: employeeId,
    } as never)
    .select("id")
    .single();

  if (error || !created) {
    console.error("Error creating identity verification:", error);
    return { error: error?.message || "作成に失敗しました" };
  }

  const verificationId = (created as { id: string }).id;

  const rows = transactions
    .filter(
      (t) => t.agency_name || t.reception_date || t.reception_number
    )
    .map((t, idx) => ({
      verification_id: verificationId,
      sort_order: t.sort_order ?? idx,
      agency_name: t.agency_name || null,
      reception_date: t.reception_date || null,
      reception_number: t.reception_number || null,
    }));

  if (rows.length > 0) {
    const { error: txError } = await supabase
      .from("identity_verification_transactions")
      .insert(rows as never);
    if (txError) {
      console.error("Error inserting transactions:", txError);
    }
  }

  revalidatePath("/identity-verifications");
  return { success: true, id: verificationId };
}

// 更新
export async function updateIdentityVerification(
  id: string,
  data: Partial<IdentityVerificationInsert>,
  transactions: IdentityVerificationTransactionInsert[]
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  const employeeId = await getCurrentEmployeeIdInternal(supabase);
  if (!employeeId) return { error: "ログインが必要です" };

  const { error } = await supabase
    .from("identity_verifications")
    .update(data as never)
    .eq("id", id);

  if (error) {
    console.error("Error updating identity verification:", error);
    return { error: "更新に失敗しました" };
  }

  // 受託事務は全削除→再挿入
  await supabase
    .from("identity_verification_transactions")
    .delete()
    .eq("verification_id", id);

  const rows = transactions
    .filter(
      (t) => t.agency_name || t.reception_date || t.reception_number
    )
    .map((t, idx) => ({
      verification_id: id,
      sort_order: t.sort_order ?? idx,
      agency_name: t.agency_name || null,
      reception_date: t.reception_date || null,
      reception_number: t.reception_number || null,
    }));

  if (rows.length > 0) {
    const { error: txError } = await supabase
      .from("identity_verification_transactions")
      .insert(rows as never);
    if (txError) {
      console.error("Error re-inserting transactions:", txError);
    }
  }

  revalidatePath("/identity-verifications");
  revalidatePath(`/identity-verifications/${id}`);
  return { success: true };
}

// 削除（画像もStorageから削除）
export async function deleteIdentityVerification(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  const employeeId = await getCurrentEmployeeIdInternal(supabase);
  if (!employeeId) return { error: "ログインが必要です" };

  // 画像パス取得 → Storageから削除
  const { data: docs } = await supabase
    .from("identity_verification_documents")
    .select("storage_path")
    .eq("verification_id", id);

  const paths = (docs as { storage_path: string }[] | null)?.map((d) => d.storage_path) || [];
  if (paths.length > 0) {
    await supabase.storage.from(STORAGE_BUCKET).remove(paths);
  }

  const { error } = await supabase
    .from("identity_verifications")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting identity verification:", error);
    return { error: "削除に失敗しました" };
  }

  revalidatePath("/identity-verifications");
  return { success: true };
}

// 身分証画像レコードを登録（Storageアップロードはクライアント側で実施）
export async function addIdentityDocument(
  verificationId: string,
  storagePath: string,
  fileName: string,
  mimeType: string | null,
  fileSize: number | null
): Promise<{ success?: boolean; error?: string; document?: IdentityVerificationDocument }> {
  const supabase = await createClient();

  const employeeId = await getCurrentEmployeeIdInternal(supabase);
  if (!employeeId) return { error: "ログインが必要です" };

  const { data, error } = await supabase
    .from("identity_verification_documents")
    .insert({
      verification_id: verificationId,
      storage_path: storagePath,
      file_name: fileName,
      mime_type: mimeType,
      file_size: fileSize,
      uploaded_by: employeeId,
    } as never)
    .select("*")
    .single();

  if (error || !data) {
    console.error("Error adding identity document:", error);
    return { error: "画像の登録に失敗しました" };
  }

  revalidatePath(`/identity-verifications/${verificationId}`);
  return { success: true, document: data as IdentityVerificationDocument };
}

// 身分証画像を削除
export async function deleteIdentityDocument(
  documentId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  const employeeId = await getCurrentEmployeeIdInternal(supabase);
  if (!employeeId) return { error: "ログインが必要です" };

  const { data: doc } = await supabase
    .from("identity_verification_documents")
    .select("storage_path, verification_id")
    .eq("id", documentId)
    .single();

  if (!doc) return { error: "画像が見つかりません" };

  const d = doc as { storage_path: string; verification_id: string };

  await supabase.storage.from(STORAGE_BUCKET).remove([d.storage_path]);

  const { error } = await supabase
    .from("identity_verification_documents")
    .delete()
    .eq("id", documentId);

  if (error) {
    console.error("Error deleting identity document:", error);
    return { error: "削除に失敗しました" };
  }

  revalidatePath(`/identity-verifications/${d.verification_id}`);
  return { success: true };
}

// 画像の署名付きURLを取得（プライベートバケット閲覧用）
export async function getDocumentSignedUrl(
  storagePath: string
): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, 60 * 60); // 1時間

  if (error || !data) {
    return { error: error?.message || "URLの取得に失敗しました" };
  }
  return { url: data.signedUrl };
}

// 本人署名のメタ情報をDBに保存（画像自体はクライアントからStorageへ直接アップロード済み前提）
export async function saveSignature(
  verificationId: string,
  storagePath: string,
  signedAt: string,
  latitude: number | null,
  longitude: number | null,
  accuracy: number | null
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const employeeId = await getCurrentEmployeeIdInternal(supabase);
  if (!employeeId) return { error: "ログインが必要です" };

  const { error } = await supabase
    .from("identity_verifications")
    .update({
      signature_storage_path: storagePath,
      signature_signed_at: signedAt,
      signature_latitude: latitude,
      signature_longitude: longitude,
      signature_accuracy: accuracy,
    } as never)
    .eq("id", verificationId);

  if (error) {
    console.error("Error saving signature:", error);
    return { error: "署名の保存に失敗しました" };
  }
  revalidatePath(`/identity-verifications/${verificationId}`);
  return { success: true };
}

// 本人署名を削除（Storageからも削除）
export async function deleteSignature(
  verificationId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const employeeId = await getCurrentEmployeeIdInternal(supabase);
  if (!employeeId) return { error: "ログインが必要です" };

  const { data: current } = await supabase
    .from("identity_verifications")
    .select("signature_storage_path")
    .eq("id", verificationId)
    .single();

  const path = (current as { signature_storage_path: string | null } | null)
    ?.signature_storage_path;
  if (path) {
    await supabase.storage.from(STORAGE_BUCKET).remove([path]);
  }

  const { error } = await supabase
    .from("identity_verifications")
    .update({
      signature_storage_path: null,
      signature_signed_at: null,
      signature_latitude: null,
      signature_longitude: null,
      signature_accuracy: null,
    } as never)
    .eq("id", verificationId);

  if (error) return { error: "削除に失敗しました" };

  revalidatePath(`/identity-verifications/${verificationId}`);
  return { success: true };
}

// 社員一覧（記入担当者プルダウン用）
export async function getEmployeesForRecorder() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("employees")
    .select("id, name")
    .order("name");
  return (data as { id: string; name: string }[]) || [];
}
