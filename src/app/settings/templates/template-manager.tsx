"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Upload, FileText, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { DocumentTemplate } from "@/types/database";

interface TemplateManagerProps {
  templates: DocumentTemplate[];
}

export function TemplateManager({ templates: initialTemplates }: TemplateManagerProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [templates, setTemplates] = useState(initialTemplates);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // フォーム状態
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith(".docx")) {
        setError("Wordファイル（.docx）のみアップロードできます");
        return;
      }
      setSelectedFile(file);
      setError(null);
      // ファイル名からデフォルトのテンプレート名を設定
      if (!name) {
        setName(file.name.replace(".docx", ""));
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !name.trim()) {
      setError("テンプレート名とファイルを指定してください");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const supabase = createClient();

      // ファイル名をユニークにする
      const timestamp = Date.now();
      const storagePath = `${timestamp}_${selectedFile.name}`;

      // Storageにアップロード
      const { error: uploadError } = await supabase.storage
        .from("document-templates")
        .upload(storagePath, selectedFile);

      if (uploadError) {
        throw new Error("ファイルのアップロードに失敗しました: " + uploadError.message);
      }

      // DBにレコード追加
      const { data: newTemplate, error: insertError } = await supabase
        .from("document_templates")
        .insert({
          name: name.trim(),
          file_name: selectedFile.name,
          storage_path: storagePath,
          description: description.trim() || null,
          sort_order: templates.length,
        })
        .select()
        .single();

      if (insertError) {
        // アップロードしたファイルを削除
        await supabase.storage.from("document-templates").remove([storagePath]);
        throw new Error("テンプレートの登録に失敗しました: " + insertError.message);
      }

      setTemplates([...templates, newTemplate as DocumentTemplate]);
      setIsDialogOpen(false);
      resetForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (template: DocumentTemplate) => {
    if (!confirm(`「${template.name}」を削除しますか？`)) {
      return;
    }

    try {
      const supabase = createClient();

      // Storageからファイル削除
      if (template.storage_path) {
        await supabase.storage
          .from("document-templates")
          .remove([template.storage_path]);
      }

      // DBからレコード削除
      const { error: deleteError } = await supabase
        .from("document_templates")
        .delete()
        .eq("id", template.id);

      if (deleteError) {
        throw new Error("削除に失敗しました");
      }

      setTemplates(templates.filter((t) => t.id !== template.id));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            テンプレート一覧
          </CardTitle>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            新規登録
          </Button>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              テンプレートがまだ登録されていません
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>テンプレート名</TableHead>
                  <TableHead>ファイル名</TableHead>
                  <TableHead>説明</TableHead>
                  <TableHead className="w-24">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {template.file_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {template.description || "-"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(template)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>テンプレート登録</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Wordファイル *</Label>
              <div className="flex gap-2">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx"
                  onChange={handleFileSelect}
                  className="flex-1"
                />
              </div>
              {selectedFile && (
                <p className="text-sm text-muted-foreground">
                  選択: {selectedFile.name}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>テンプレート名 *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 案内状"
              />
            </div>

            <div className="space-y-2">
              <Label>説明</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="例: 顧客向け案内状テンプレート"
                rows={2}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleUpload} disabled={isUploading || !selectedFile}>
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  アップロード中...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  登録
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
