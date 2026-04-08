"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitCommit, Calendar } from "lucide-react";

// 変更履歴データ（新しい順）
const changelogEntries = [
  {
    date: "2026-04-09",
    version: "1.0.5",
    changes: [
      {
        type: "improve" as const,
        description: "請求書・見積書をPDF登録のみのシンプルな形式に変更（テンプレート・明細機能を削除）",
      },
    ],
  },
  {
    date: "2026-04-07",
    version: "1.0.4",
    changes: [
      {
        type: "feat" as const,
        description: "請求書・見積書一覧にPDF添付ボタンを追加（以前の機能を復活）",
      },
    ],
  },
  {
    date: "2026-04-07",
    version: "1.0.3",
    changes: [
      {
        type: "improve" as const,
        description: "請求書・見積書作成時に業務を選択すると、その業務の顧客が自動で相手先にセットされるように改善",
      },
    ],
  },
  {
    date: "2026-04-07",
    version: "1.0.2",
    changes: [
      {
        type: "feat" as const,
        description: "請求書・見積書作成時に既存の請求書/見積書から明細を読み込む機能を追加",
      },
    ],
  },
  {
    date: "2026-04-07",
    version: "1.0.1",
    changes: [
      {
        type: "fix" as const,
        description: "見積書として作成した場合に正しく見積書として登録されるように修正",
      },
      {
        type: "feat" as const,
        description: "請求書・見積書作成で全顧客リストから相手先を選択可能に",
      },
      {
        type: "feat" as const,
        description: "ダッシュボード業務一覧のフィルターをカテゴリ別に変更",
      },
      {
        type: "feat" as const,
        description: "変更履歴ページを追加",
      },
    ],
  },
];

const typeLabels: Record<string, { label: string; color: string }> = {
  feat: { label: "新機能", color: "bg-green-500" },
  fix: { label: "修正", color: "bg-blue-500" },
  improve: { label: "改善", color: "bg-purple-500" },
  docs: { label: "ドキュメント", color: "bg-gray-500" },
};

export default function ChangelogPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-8">
        <GitCommit className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">変更履歴</h1>
      </div>

      <div className="space-y-6">
        {changelogEntries.map((entry, index) => (
          <Card key={index}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3 text-lg">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <span>{entry.date}</span>
                {entry.version && (
                  <Badge variant="outline" className="ml-2">
                    v{entry.version}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {entry.changes.map((change, changeIndex) => {
                  const typeInfo = typeLabels[change.type] || typeLabels.feat;
                  return (
                    <li key={changeIndex} className="flex items-start gap-3">
                      <Badge
                        className={`${typeInfo.color} text-white text-xs shrink-0 mt-0.5`}
                      >
                        {typeInfo.label}
                      </Badge>
                      <span className="text-sm">{change.description}</span>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      {changelogEntries.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            変更履歴はまだありません
          </CardContent>
        </Card>
      )}
    </div>
  );
}
