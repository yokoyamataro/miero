"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, User } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import type { IdentityVerification } from "@/types/database";

interface Props {
  verifications: IdentityVerification[];
}

export function VerificationList({ verifications }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return verifications;
    const q = query.toLowerCase();
    return verifications.filter((v) => {
      return (
        v.name.toLowerCase().includes(q) ||
        (v.phone || "").includes(q) ||
        (v.address || "").toLowerCase().includes(q) ||
        (v.workplace || "").toLowerCase().includes(q) ||
        (v.recorder_name || "").toLowerCase().includes(q)
      );
    });
  }, [verifications, query]);

  return (
    <div className="space-y-4">
      {/* 検索 */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="氏名・電話・住所・勤務先で検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* 件数 */}
      <p className="text-sm text-muted-foreground">
        {filtered.length}件 / 全{verifications.length}件
      </p>

      {/* リスト */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {verifications.length === 0
              ? "本人確認シートがまだ登録されていません"
              : "該当するシートがありません"}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((v) => (
            <Link key={v.id} href={`/identity-verifications/${v.id}`}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="font-semibold truncate">{v.name}</span>
                  </div>
                  {v.address && (
                    <p className="text-xs text-muted-foreground truncate">
                      {v.address}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                    <span>
                      作成: {format(parseISO(v.created_at), "yyyy/MM/dd", { locale: ja })}
                    </span>
                    {v.recorder_name && <span>{v.recorder_name}</span>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
