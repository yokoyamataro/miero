"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
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
  Loader2,
  Plus,
  Trash2,
  Camera,
  Save,
  ArrowLeft,
  ExternalLink,
  PenLine,
  MapPin,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import {
  IDENTITY_DELIVERY_METHOD_OPTIONS,
  IDENTITY_DOCUMENT_TYPE_OPTIONS,
  IDENTITY_PAYMENT_METHOD_OPTIONS,
  IDENTITY_VERIFICATION_METHOD_OPTIONS,
  AGENT_RELATIONSHIP_OPTIONS,
  type IdentityVerificationInsert,
  type IdentityVerificationTransactionInsert,
  type IdentityVerificationDocument,
} from "@/types/database";
import { createClient } from "@/lib/supabase/client";
import { lookupAddressByPostalCode } from "@/lib/ai/postal-code";
import {
  createIdentityVerification,
  updateIdentityVerification,
  addIdentityDocument,
  deleteIdentityDocument,
  deleteIdentityVerification,
  deleteSignature,
  saveSignature,
  getDocumentSignedUrl,
} from "./actions";
import { SignaturePad } from "./signature-pad";

const STORAGE_BUCKET = "identity-documents";

interface RecorderOption {
  id: string;
  name: string;
}

interface Props {
  mode: "new" | "edit";
  verificationId?: string;
  initialData?: IdentityVerificationInsert & {
    signature_storage_path?: string | null;
    signature_signed_at?: string | null;
    signature_latitude?: number | null;
    signature_longitude?: number | null;
    signature_accuracy?: number | null;
    recorder_id?: string | null;
  };
  initialTransactions?: IdentityVerificationTransactionInsert[];
  initialDocuments?: IdentityVerificationDocument[];
  employees: RecorderOption[];
}

interface PendingSignature {
  blob: Blob;
  signedAt: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
}

type TxRow = IdentityVerificationTransactionInsert & { key: string };

function makeEmptyTx(): TxRow {
  return {
    key: crypto.randomUUID(),
    agency_name: "",
    reception_date: "",
    reception_number: "",
  };
}

export function VerificationForm({
  mode,
  verificationId,
  initialData,
  initialTransactions,
  initialDocuments,
  employees,
}: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // 基本情報
  const [name, setName] = useState(initialData?.name || "");
  const [postalCode, setPostalCode] = useState(initialData?.postal_code || "");
  const [address, setAddress] = useState(initialData?.address || "");
  const [birthDate, setBirthDate] = useState(initialData?.birth_date || "");
  const [phone, setPhone] = useState(initialData?.phone || "");
  const [workplace, setWorkplace] = useState(initialData?.workplace || "");
  const [email, setEmail] = useState(initialData?.email || "");

  // 代理人
  const [agentAddress, setAgentAddress] = useState(initialData?.agent_address || "");
  const [agentName, setAgentName] = useState(initialData?.agent_name || "");
  const [agentRelationship, setAgentRelationship] = useState(
    initialData?.agent_relationship || ""
  );
  const [agentRelationshipDetail, setAgentRelationshipDetail] = useState(
    initialData?.agent_relationship_detail || ""
  );
  const [agentPhone, setAgentPhone] = useState(initialData?.agent_phone || "");

  // 受取・支払・反社
  const [deliveryMethods, setDeliveryMethods] = useState<string[]>(
    initialData?.delivery_methods || []
  );
  const [paymentMethod, setPaymentMethod] = useState(initialData?.payment_method || "");
  const [isNotAntisocial, setIsNotAntisocial] = useState(
    initialData?.is_not_antisocial || false
  );

  // 事務所記入欄
  const [recordedDate, setRecordedDate] = useState(
    initialData?.recorded_date || new Date().toISOString().split("T")[0]
  );
  const [recorderId, setRecorderId] = useState(initialData?.recorder_id || "");
  const [documentTypes, setDocumentTypes] = useState<string[]>(
    initialData?.document_types || []
  );
  const [verificationMethods, setVerificationMethods] = useState<string[]>(
    initialData?.verification_methods || []
  );

  // 本人署名
  const [signaturePadOpen, setSignaturePadOpen] = useState(false);
  const [existingSignaturePath, setExistingSignaturePath] = useState<string | null>(
    initialData?.signature_storage_path || null
  );
  const [existingSignatureSignedAt, setExistingSignatureSignedAt] = useState<string | null>(
    initialData?.signature_signed_at || null
  );
  const [existingSignatureLat, setExistingSignatureLat] = useState<number | null>(
    initialData?.signature_latitude ?? null
  );
  const [existingSignatureLng, setExistingSignatureLng] = useState<number | null>(
    initialData?.signature_longitude ?? null
  );
  const [existingSignatureAcc, setExistingSignatureAcc] = useState<number | null>(
    initialData?.signature_accuracy ?? null
  );
  const [existingSignatureUrl, setExistingSignatureUrl] = useState<string | null>(null);
  const [pendingSignature, setPendingSignature] = useState<PendingSignature | null>(null);
  const [pendingSignatureUrl, setPendingSignatureUrl] = useState<string | null>(null);
  const [deletingSignature, setDeletingSignature] = useState(false);

  // 既存の署名画像URLをロード
  useEffect(() => {
    if (!existingSignaturePath) {
      setExistingSignatureUrl(null);
      return;
    }
    let cancelled = false;
    getDocumentSignedUrl(existingSignaturePath).then((res) => {
      if (!cancelled && res.url) setExistingSignatureUrl(res.url);
    });
    return () => {
      cancelled = true;
    };
  }, [existingSignaturePath]);

  // pending の Blob URL 管理
  useEffect(() => {
    if (!pendingSignature) {
      setPendingSignatureUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingSignature.blob);
    setPendingSignatureUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingSignature]);

  // 備考
  const [notes, setNotes] = useState(initialData?.notes || "");

  // 受託事務
  const [transactions, setTransactions] = useState<TxRow[]>(() => {
    if (initialTransactions && initialTransactions.length > 0) {
      return initialTransactions.map((t) => ({ ...t, key: crypto.randomUUID() }));
    }
    return [makeEmptyTx()];
  });

  // 身分証画像
  const [documents, setDocuments] = useState<IdentityVerificationDocument[]>(
    initialDocuments || []
  );

  const toggleInArray = (
    arr: string[],
    setArr: (v: string[]) => void,
    value: string
  ) => {
    if (arr.includes(value)) {
      setArr(arr.filter((v) => v !== value));
    } else {
      setArr([...arr, value]);
    }
  };

  const handlePostalLookup = async () => {
    if (!postalCode) return;
    const result = await lookupAddressByPostalCode(postalCode);
    if (result.error) {
      setError(result.error);
      return;
    }
    const parts = [result.prefecture, result.city, result.street].filter(Boolean);
    setAddress(parts.join(""));
    setError(null);
  };

  const updateTx = (key: string, patch: Partial<TxRow>) => {
    setTransactions((prev) =>
      prev.map((t) => (t.key === key ? { ...t, ...patch } : t))
    );
  };

  const addTxRow = () => setTransactions((prev) => [...prev, makeEmptyTx()]);
  const removeTxRow = (key: string) =>
    setTransactions((prev) => prev.filter((t) => t.key !== key));

  const buildPayload = (): IdentityVerificationInsert => ({
    name: name.trim(),
    postal_code: postalCode || null,
    address: address || null,
    birth_date: birthDate || null,
    phone: phone || null,
    workplace: workplace || null,
    email: email || null,
    agent_address: agentAddress || null,
    agent_name: agentName || null,
    agent_relationship: agentRelationship || null,
    agent_relationship_detail: agentRelationshipDetail || null,
    agent_phone: agentPhone || null,
    delivery_methods: deliveryMethods,
    payment_method: paymentMethod || null,
    is_not_antisocial: isNotAntisocial,
    recorded_date: recordedDate || null,
    recorder_id: recorderId || null,
    document_types: documentTypes,
    verification_methods: verificationMethods,
    notes: notes || null,
  });

  // Blob を Storage にアップロード + saveSignature を呼び出す
  const commitPendingSignature = async (targetId: string): Promise<string | null> => {
    if (!pendingSignature) return null;
    const supabase = createClient();
    const path = `signatures/${targetId}.png`;
    const { error: uploadErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, pendingSignature.blob, {
        contentType: "image/png",
        upsert: true,
      });
    if (uploadErr) {
      throw new Error(`署名のアップロードに失敗しました: ${uploadErr.message}`);
    }
    const result = await saveSignature(
      targetId,
      path,
      pendingSignature.signedAt,
      pendingSignature.latitude,
      pendingSignature.longitude,
      pendingSignature.accuracy
    );
    if (result.error) {
      throw new Error(result.error);
    }
    return path;
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("氏名は必須です");
      return;
    }
    if (!recorderId) {
      setError("記入担当者を選択してください");
      return;
    }
    const hasSignature = !!existingSignaturePath || !!pendingSignature;
    if (!hasSignature) {
      setError("本人署名を入力してください");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = buildPayload();
      const txPayload: IdentityVerificationTransactionInsert[] = transactions.map(
        (t, idx) => ({
          sort_order: idx,
          agency_name: t.agency_name || null,
          reception_date: t.reception_date || null,
          reception_number: t.reception_number || null,
        })
      );

      if (mode === "new") {
        const result = await createIdentityVerification(payload, txPayload);
        if (result.error || !result.id) {
          setError(result.error || "保存に失敗しました");
          return;
        }
        // 新規保存後、pending 署名があれば Storage + saveSignature を実行
        if (pendingSignature) {
          try {
            await commitPendingSignature(result.id);
          } catch (err) {
            setError(
              (err instanceof Error ? err.message : "署名の保存に失敗しました") +
                "（シート自体は保存されました）"
            );
            router.push(`/identity-verifications/${result.id}`);
            return;
          }
        }
        router.push(`/identity-verifications/${result.id}`);
      } else if (verificationId) {
        const result = await updateIdentityVerification(
          verificationId,
          payload,
          txPayload
        );
        if (result.error) {
          setError(result.error);
          return;
        }
        // 編集時、pending 署名があればアップロード
        if (pendingSignature) {
          try {
            const path = await commitPendingSignature(verificationId);
            if (path) {
              setExistingSignaturePath(path);
              setExistingSignatureSignedAt(pendingSignature.signedAt);
              setExistingSignatureLat(pendingSignature.latitude);
              setExistingSignatureLng(pendingSignature.longitude);
              setExistingSignatureAcc(pendingSignature.accuracy);
              setPendingSignature(null);
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : "署名の保存に失敗しました");
            return;
          }
        }
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存中にエラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSignature = async () => {
    if (!verificationId) return;
    if (!confirm("署名を削除しますか？")) return;
    setDeletingSignature(true);
    const result = await deleteSignature(verificationId);
    setDeletingSignature(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setExistingSignaturePath(null);
    setExistingSignatureSignedAt(null);
    setExistingSignatureLat(null);
    setExistingSignatureLng(null);
    setExistingSignatureAcc(null);
    setExistingSignatureUrl(null);
  };

  const handleDelete = async () => {
    if (!verificationId) return;
    if (!confirm("この本人確認シートを削除しますか？身分証画像も削除されます。")) return;

    setDeleting(true);
    const result = await deleteIdentityVerification(verificationId);
    setDeleting(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/identity-verifications");
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !verificationId) return;

    setUploading(true);
    setError(null);
    const supabase = createClient();

    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "bin";
        const path = `${verificationId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(path, file, { contentType: file.type });

        if (uploadErr) {
          throw new Error(`アップロード失敗: ${uploadErr.message}`);
        }

        const result = await addIdentityDocument(
          verificationId,
          path,
          file.name,
          file.type,
          file.size
        );

        if (result.error || !result.document) {
          await supabase.storage.from(STORAGE_BUCKET).remove([path]);
          throw new Error(result.error || "画像の登録に失敗しました");
        }

        setDocuments((prev) => [...prev, result.document!]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "アップロード中にエラーが発生しました");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteDocument = async (id: string) => {
    if (!confirm("この画像を削除しますか？")) return;
    const result = await deleteIdentityDocument(id);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  const handleOpenDocument = async (path: string) => {
    const result = await getDocumentSignedUrl(path);
    if (result.url) {
      window.open(result.url, "_blank", "noopener,noreferrer");
    } else {
      setError(result.error || "URL取得に失敗しました");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.push("/identity-verifications")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          一覧へ戻る
        </Button>
        <div className="flex gap-2">
          {mode === "edit" && (
            <Button variant="destructive" onClick={handleDelete} disabled={deleting || saving}>
              <Trash2 className="h-4 w-4 mr-1" />
              削除
            </Button>
          )}
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            保存
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 text-destructive p-3 text-sm">
          {error}
        </div>
      )}

      {/* 本人に関する事項 */}
      <Card>
        <CardHeader>
          <CardTitle>本人に関する事項</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">氏名（代表者）*</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4">
            <div className="space-y-2">
              <Label htmlFor="postalCode">郵便番号</Label>
              <div className="flex gap-2">
                <Input
                  id="postalCode"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="1000001"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handlePostalLookup}
                >
                  検索
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">住所</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="birthDate">生年月日</Label>
              <Input
                id="birthDate"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">電話番号</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="workplace">勤務先</Label>
              <Input
                id="workplace"
                value={workplace}
                onChange={(e) => setWorkplace(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 代理人 */}
      <Card>
        <CardHeader>
          <CardTitle>代理人・取引担当者に関する事項</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agentAddress">代理人住所</Label>
            <Input
              id="agentAddress"
              value={agentAddress}
              onChange={(e) => setAgentAddress(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="agentName">代理人氏名</Label>
            <Input
              id="agentName"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>本人との関係</Label>
            <div className="flex flex-wrap gap-3 items-center">
              {AGENT_RELATIONSHIP_OPTIONS.map((opt) => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="agentRelationship"
                    checked={agentRelationship === opt}
                    onChange={() => setAgentRelationship(opt)}
                    className="w-4 h-4"
                  />
                  {opt}
                </label>
              ))}
              {agentRelationship && (
                <button
                  type="button"
                  onClick={() => setAgentRelationship("")}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  クリア
                </button>
              )}
              {(agentRelationship === "親族" || agentRelationship === "他") && (
                <Input
                  className="max-w-[200px]"
                  placeholder={
                    agentRelationship === "親族" ? "続柄（例: 長男）" : "内容"
                  }
                  value={agentRelationshipDetail}
                  onChange={(e) => setAgentRelationshipDetail(e.target.value)}
                />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agentPhone">代理人電話番号</Label>
            <Input
              id="agentPhone"
              value={agentPhone}
              onChange={(e) => setAgentPhone(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* 完了書類の受取方法 */}
      <Card>
        <CardHeader>
          <CardTitle>完了書類の受取方法</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {IDENTITY_DELIVERY_METHOD_OPTIONS.map((opt) => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={deliveryMethods.includes(opt)}
                onCheckedChange={() =>
                  toggleInArray(deliveryMethods, setDeliveryMethods, opt)
                }
              />
              <span>{opt}</span>
            </label>
          ))}
        </CardContent>
      </Card>

      {/* お支払い方法 */}
      <Card>
        <CardHeader>
          <CardTitle>お支払い方法</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {IDENTITY_PAYMENT_METHOD_OPTIONS.map((opt) => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={paymentMethod === opt}
                  onChange={() => setPaymentMethod(opt)}
                  className="w-4 h-4"
                />
                {opt}
              </label>
            ))}
            {paymentMethod && (
              <button
                type="button"
                onClick={() => setPaymentMethod("")}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                クリア
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 反社チェック */}
      <Card>
        <CardContent className="pt-6">
          <label className="flex items-start gap-2 cursor-pointer">
            <Checkbox
              checked={isNotAntisocial}
              onCheckedChange={(v) => setIsNotAntisocial(!!v)}
              className="mt-0.5"
            />
            <span>
              私は、反社会勢力に該当する者ではありません。
              <br />
              <span className="text-xs text-muted-foreground">
                （本人がチェックしたことを確認したらチェックを入れてください）
              </span>
            </span>
          </label>
        </CardContent>
      </Card>

      {/* 本人署名 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5" />
            本人署名 *
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {existingSignaturePath || pendingSignature ? (
            <div className="space-y-3">
              <div className="border rounded-md bg-white p-2 inline-block">
                {pendingSignatureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pendingSignatureUrl}
                    alt="署名（未保存）"
                    className="max-h-40"
                  />
                ) : existingSignatureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={existingSignatureUrl}
                    alt="署名"
                    className="max-h-40"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground p-4">
                    署名を読み込み中...
                  </p>
                )}
              </div>

              {pendingSignature ? (
                <div className="text-sm text-amber-700 bg-amber-50 rounded p-2">
                  未保存の署名です（{format(parseISO(pendingSignature.signedAt), "yyyy/MM/dd HH:mm:ss", { locale: ja })} 署名）。
                  フォームを保存すると確定します。
                </div>
              ) : (
                existingSignatureSignedAt && (
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>
                      署名日時:{" "}
                      {format(
                        parseISO(existingSignatureSignedAt),
                        "yyyy/MM/dd HH:mm:ss",
                        { locale: ja }
                      )}
                    </div>
                    {existingSignatureLat !== null && existingSignatureLng !== null ? (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        <a
                          href={`https://www.google.com/maps?q=${existingSignatureLat},${existingSignatureLng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {existingSignatureLat.toFixed(6)}, {existingSignatureLng.toFixed(6)}
                        </a>
                        {existingSignatureAcc !== null && (
                          <span className="text-xs">
                            （誤差 ±{Math.round(existingSignatureAcc)}m）
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs">位置情報: 記録なし</div>
                    )}
                  </div>
                )
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSignaturePadOpen(true)}
                >
                  <PenLine className="h-4 w-4 mr-1" />
                  署名し直す
                </Button>
                {pendingSignature ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPendingSignature(null)}
                  >
                    未保存の署名を破棄
                  </Button>
                ) : (
                  mode === "edit" && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleDeleteSignature}
                      disabled={deletingSignature}
                      className="text-destructive"
                    >
                      {deletingSignature && (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      )}
                      署名を削除
                    </Button>
                  )
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                本人に画面上で署名してもらってください。保存時に日時と現在地を記録します。
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSignaturePadOpen(true)}
              >
                <PenLine className="h-4 w-4 mr-1" />
                署名する
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 事務所記入欄 */}
      <Card>
        <CardHeader>
          <CardTitle>※ 当事務所記入欄</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="recordedDate">記入した日</Label>
              <Input
                id="recordedDate"
                type="date"
                value={recordedDate}
                onChange={(e) => setRecordedDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recorderId">記入担当者 *</Label>
              <Select value={recorderId} onValueChange={setRecorderId}>
                <SelectTrigger id="recorderId">
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
          </div>

          <div className="space-y-2">
            <Label>1. 本人確認書類</Label>
            <div className="space-y-2">
              {IDENTITY_DOCUMENT_TYPE_OPTIONS.map((opt) => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={documentTypes.includes(opt)}
                    onCheckedChange={() =>
                      toggleInArray(documentTypes, setDocumentTypes, opt)
                    }
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>2. 本人確認方法</Label>
            <div className="space-y-2">
              {IDENTITY_VERIFICATION_METHOD_OPTIONS.map((opt) => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={verificationMethods.includes(opt)}
                    onCheckedChange={() =>
                      toggleInArray(verificationMethods, setVerificationMethods, opt)
                    }
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>3. 受託事務</Label>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-2 text-left w-12">#</th>
                    <th className="p-2 text-left">申請先</th>
                    <th className="p-2 text-left w-40">受付年月日</th>
                    <th className="p-2 text-left w-40">受付番号</th>
                    <th className="p-2 w-12" />
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t, idx) => (
                    <tr key={t.key} className="border-b">
                      <td className="p-2 text-muted-foreground">{idx + 1}</td>
                      <td className="p-1">
                        <Input
                          value={t.agency_name || ""}
                          onChange={(e) =>
                            updateTx(t.key, { agency_name: e.target.value })
                          }
                          placeholder="例: 釧路地方法務局"
                        />
                      </td>
                      <td className="p-1">
                        <Input
                          type="date"
                          value={t.reception_date || ""}
                          onChange={(e) =>
                            updateTx(t.key, { reception_date: e.target.value })
                          }
                        />
                      </td>
                      <td className="p-1">
                        <Input
                          value={t.reception_number || ""}
                          onChange={(e) =>
                            updateTx(t.key, { reception_number: e.target.value })
                          }
                          placeholder="第○号"
                        />
                      </td>
                      <td className="p-1 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTxRow(t.key)}
                          disabled={transactions.length <= 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addTxRow}
              className="mt-2"
            >
              <Plus className="h-4 w-4 mr-1" />
              行を追加
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 身分証画像 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            身分証明書の画像
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === "new" ? (
            <p className="text-sm text-muted-foreground">
              画像は保存後に追加できます。まずシートの基本情報を保存してください。
            </p>
          ) : (
            <>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  onChange={handleUploadFile}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4 mr-1" />
                  )}
                  画像を追加（撮影/選択）
                </Button>
              </div>

              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  まだ画像がありません
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {documents.map((doc) => (
                    <DocumentThumbnail
                      key={doc.id}
                      document={doc}
                      onOpen={() => handleOpenDocument(doc.storage_path)}
                      onDelete={() => handleDeleteDocument(doc.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 備考 */}
      <Card>
        <CardHeader>
          <CardTitle>備考</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.push("/identity-verifications")}>
          キャンセル
        </Button>
        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-1" />
          )}
          保存
        </Button>
      </div>

      <SignaturePad
        open={signaturePadOpen}
        onOpenChange={setSignaturePadOpen}
        onSave={async (payload) => {
          setPendingSignature(payload);
          setSignaturePadOpen(false);
        }}
      />
    </div>
  );
}

function DocumentThumbnail({
  document,
  onOpen,
  onDelete,
}: {
  document: IdentityVerificationDocument;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadThumbnail = async () => {
    if (signedUrl || loading) return;
    setLoading(true);
    const result = await getDocumentSignedUrl(document.storage_path);
    if (result.url) setSignedUrl(result.url);
    setLoading(false);
  };

  // 画像なら自動サムネイル、それ以外はアイコンだけ
  const isImage = document.mime_type?.startsWith("image/");

  return (
    <div className="border rounded-md overflow-hidden bg-muted/30">
      <div
        className="aspect-video bg-muted flex items-center justify-center cursor-pointer relative overflow-hidden"
        onClick={onOpen}
        onMouseEnter={loadThumbnail}
      >
        {isImage && signedUrl ? (
          <Image
            src={signedUrl}
            alt={document.file_name}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <Camera className="h-8 w-8 text-muted-foreground" />
        )}
      </div>
      <div className="p-2 space-y-1">
        <p className="text-xs truncate" title={document.file_name}>
          {document.file_name}
        </p>
        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={onOpen}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" />
            開く
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="text-xs text-destructive hover:underline flex items-center gap-1"
          >
            <Trash2 className="h-3 w-3" />
            削除
          </button>
        </div>
      </div>
    </div>
  );
}
