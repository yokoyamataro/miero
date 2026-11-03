"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Building2, User, Search, X, Plus } from "lucide-react";
import type { Customer, CustomerType } from "@/types/database";

type Filter = "all" | CustomerType;

interface CustomersListProps {
  customers: Customer[];
}

export function CustomersList({ customers }: CustomersListProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const counts = useMemo(() => {
    let corp = 0;
    let ind = 0;
    for (const c of customers) {
      if (c.type === "corporate") corp++;
      else if (c.type === "individual") ind++;
    }
    return { all: customers.length, corporate: corp, individual: ind };
  }, [customers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (filter !== "all" && c.type !== filter) return false;
      if (!q) return true;
      const haystack = [
        c.display_name,
        c.display_name_kana,
        c.phone,
        c.email,
        c.prefecture,
        c.city,
        c.street,
        c.contact_last_name,
        c.contact_first_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [customers, filter, search]);

  const buildAddress = (c: Customer): string => {
    const parts = [c.prefecture, c.city, c.street, c.building].filter(Boolean);
    return parts.join("");
  };

  return (
    <div className="space-y-4">
      {/* 検索 + フィルタ */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="名前・カナ・電話・住所などで検索"
            className="pl-8 pr-8"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="検索をクリア"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
          <FilterChip
            label="全て"
            count={counts.all}
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          <FilterChip
            label="法人"
            count={counts.corporate}
            active={filter === "corporate"}
            onClick={() => setFilter("corporate")}
          />
          <FilterChip
            label="個人"
            count={counts.individual}
            active={filter === "individual"}
            onClick={() => setFilter("individual")}
          />
        </div>

        <Link href="/customers/new" className="ml-auto">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            新規登録
          </Button>
        </Link>
      </div>

      {/* 件数表示 */}
      <div className="text-xs text-muted-foreground">
        {filtered.length}件 {search && `(「${search}」で絞込)`}
      </div>

      {/* 一覧テーブル */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {customers.length === 0
              ? "顧客が登録されていません"
              : "該当する顧客がいません"}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">区分</TableHead>
                  <TableHead>名称 / 氏名</TableHead>
                  <TableHead>担当者 (法人)</TableHead>
                  <TableHead>電話</TableHead>
                  <TableHead>住所</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id} className="hover:bg-muted/40">
                    <TableCell>
                      {c.type === "corporate" ? (
                        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                          <Building2 className="h-3 w-3 mr-1" />
                          法人
                        </Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                          <User className="h-3 w-3 mr-1" />
                          個人
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/customers/${c.id}`}
                        className="font-medium hover:underline"
                      >
                        {c.display_name}
                      </Link>
                      {c.display_name_kana && (
                        <div className="text-xs text-muted-foreground">
                          {c.display_name_kana}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.type === "corporate" && c.contact_last_name
                        ? `${c.contact_last_name} ${c.contact_first_name || ""}`.trim()
                        : "-"}
                      {c.type === "corporate" && c.contact_department && (
                        <div className="text-xs text-muted-foreground">
                          {c.contact_department}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {c.phone || "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {buildAddress(c) || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
        active
          ? "bg-foreground text-background border-foreground"
          : "bg-background text-muted-foreground border-border hover:border-foreground/30"
      }`}
    >
      {label} <span className="opacity-70">({count})</span>
    </button>
  );
}
