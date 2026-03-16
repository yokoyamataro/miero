"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FolderOpen, Pencil, ExternalLink, AlertCircle } from "lucide-react";
import { updateProject } from "./actions";

interface DropboxLinksProps {
  projectId: string;
  mainFolderPath: string | null;
  cadFolderPath: string | null;
  dropboxBasePath: string | null;
}

export function DropboxLinks({
  projectId,
  mainFolderPath,
  cadFolderPath,
  dropboxBasePath,
}: DropboxLinksProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [mainPath, setMainPath] = useState(mainFolderPath || "");
  const [cadPath, setCadPath] = useState(cadFolderPath || "");

  const handleSave = () => {
    startTransition(async () => {
      await updateProject(projectId, {
        main_folder_path: mainPath || null,
        cad_folder_path: cadPath || null,
      });
      setIsEditDialogOpen(false);
      router.refresh();
    });
  };

  const openDropboxFolder = (relativePath: string) => {
    if (!dropboxBasePath) {
      alert("Dropboxベースパスが設定されていません。\n社員編集画面で設定してください。");
      return;
    }

    // パスの結合（末尾/の有無を考慮）
    const basePath = dropboxBasePath.endsWith("/") || dropboxBasePath.endsWith("\\")
      ? dropboxBasePath.slice(0, -1)
      : dropboxBasePath;
    const relPath = relativePath.startsWith("/") || relativePath.startsWith("\\")
      ? relativePath.slice(1)
      : relativePath;

    // パス区切りを/に統一
    const fullPath = `${basePath}/${relPath}`.replace(/\\/g, "/");

    // dropbox-efile:// プロトコルで開く
    window.location.href = `dropbox-efile://${fullPath}`;
  };

  const hasAnyPath = mainFolderPath || cadFolderPath;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            フォルダリンク
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setMainPath(mainFolderPath || "");
              setCadPath(cadFolderPath || "");
              setIsEditDialogOpen(true);
            }}
          >
            <Pencil className="h-4 w-4 mr-1" />
            編集
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!dropboxBasePath && (
          <div className="flex items-start gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-md">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              Dropboxベースパスが設定されていません。
              <br />
              社員編集画面で設定してください。
            </div>
          </div>
        )}

        {hasAnyPath ? (
          <div className="space-y-2">
            {mainFolderPath && (
              <div className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                <div className="text-sm">
                  <span className="text-muted-foreground">メイン:</span>{" "}
                  <span className="font-mono text-xs">{mainFolderPath}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openDropboxFolder(mainFolderPath)}
                  disabled={!dropboxBasePath}
                  className="h-8"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  開く
                </Button>
              </div>
            )}

            {cadFolderPath && (
              <div className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                <div className="text-sm">
                  <span className="text-muted-foreground">CAD:</span>{" "}
                  <span className="font-mono text-xs">{cadFolderPath}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openDropboxFolder(cadFolderPath)}
                  disabled={!dropboxBasePath}
                  className="h-8"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  開く
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground text-center py-4">
            フォルダパスが設定されていません
          </div>
        )}
      </CardContent>

      {/* 編集ダイアログ */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>フォルダパスを編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mainPath">メインフォルダパス</Label>
              <Input
                id="mainPath"
                value={mainPath}
                onChange={(e) => setMainPath(e.target.value)}
                placeholder="例: 顧客/〇〇株式会社/案件001"
              />
              <p className="text-xs text-muted-foreground">
                Dropboxベースパスからの相対パスを入力
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cadPath">CADデータフォルダパス</Label>
              <Input
                id="cadPath"
                value={cadPath}
                onChange={(e) => setCadPath(e.target.value)}
                placeholder="例: CAD/〇〇株式会社/案件001"
              />
              <p className="text-xs text-muted-foreground">
                Dropboxベースパスからの相対パスを入力
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSave} disabled={isPending}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
