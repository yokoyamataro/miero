"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Download, Upload, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { getProjectsForExport, importProjectsFromCSV } from "./actions";

export function CSVActions() {
  const [isExporting, setIsExporting] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    imported: number;
    errors: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // CSVエクスポート
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await getProjectsForExport();
      if (result.success && result.data) {
        // BOM付きUTF-8でダウンロード
        const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
        const blob = new Blob([bom, result.data], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `業務一覧_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        alert(`エクスポートに失敗しました: ${result.error}`);
      }
    } catch (error) {
      console.error("Export error:", error);
      alert("エクスポート中にエラーが発生しました");
    } finally {
      setIsExporting(false);
    }
  };

  // インポートダイアログを開く
  const handleImportClick = () => {
    setImportResult(null);
    setShowImportDialog(true);
  };

  // ファイル選択
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      const result = await importProjectsFromCSV(text);
      setImportResult(result);

      if (result.imported > 0) {
        // ページをリロードして最新データを表示
        window.location.reload();
      }
    } catch (error) {
      console.error("Import error:", error);
      setImportResult({
        success: false,
        imported: 0,
        errors: ["ファイルの読み込みに失敗しました"],
      });
    } finally {
      setIsImporting(false);
      // ファイル入力をリセット
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={isExporting}
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          CSVエクスポート
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleImportClick}
        >
          <Upload className="h-4 w-4 mr-2" />
          CSVインポート
        </Button>
      </div>

      {/* インポートダイアログ */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>CSVインポート</DialogTitle>
            <DialogDescription>
              CSVファイルから業務データをインポートします
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 説明 */}
            <div className="text-sm text-muted-foreground space-y-2">
              <p>以下のCSV形式に対応しています:</p>
              <div className="space-y-2 ml-2">
                <div>
                  <p className="font-medium">業務管理CSV（自動判定）</p>
                  <p className="text-xs">ID, 顧客, 業務名, 業務担当者, 進捗状況, 着手, 完了, 税抜報酬, 業務の区分, エリア</p>
                </div>
                <div>
                  <p className="font-medium">標準CSV</p>
                  <p className="text-xs">業務コード, カテゴリ, 業務名, ステータス, 法人名, 顧客名, 担当者, 着手日, 完了予定日, 税抜報酬額, エリア</p>
                </div>
              </div>
              <p className="text-xs">※ 既存の業務コードと重複する行はスキップされます</p>
            </div>

            {/* ファイル選択 */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="block w-full text-sm text-muted-foreground
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-medium
                  file:bg-primary file:text-primary-foreground
                  hover:file:bg-primary/90
                  cursor-pointer"
                disabled={isImporting}
              />
            </div>

            {/* インポート中 */}
            {isImporting && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                インポート中...
              </div>
            )}

            {/* 結果表示 */}
            {importResult && (
              <div className="space-y-2">
                {importResult.imported > 0 && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    {importResult.imported}件のデータをインポートしました
                  </div>
                )}
                {importResult.errors.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      エラーが発生しました
                    </div>
                    <ul className="text-sm text-destructive list-disc list-inside ml-2 max-h-40 overflow-y-auto">
                      {importResult.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowImportDialog(false)}
            >
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
