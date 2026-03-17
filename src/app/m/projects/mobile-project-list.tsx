"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Search, AlertTriangle, Pause, ChevronRight, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PROJECT_CATEGORY_LABELS, type ProjectCategory } from "@/types/database";
import { getRecentProjectIds } from "./[id]/mobile-project-detail";

interface Project {
  id: string;
  code: string;
  category: string;
  name: string;
  status: string;
  is_urgent: boolean;
  is_on_hold: boolean;
  contact_id: string | null;
  manager_id: string | null;
  location: string | null;
  location_detail: string | null;
}

interface Employee {
  id: string;
  name: string;
}

interface MobileProjectListProps {
  projects: Project[];
  employees: Employee[];
  contactDisplayMap: Record<string, string>;
  employeeMap: Record<string, string>;
  currentEmployeeId: string | null;
}

export function MobileProjectList({
  projects,
  employees,
  contactDisplayMap,
  employeeMap,
  currentEmployeeId,
}: MobileProjectListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterManagerId, setFilterManagerId] = useState<string | null>(currentEmployeeId);
  const [recentIds, setRecentIds] = useState<string[]>([]);

  // クライアントサイドで閲覧履歴を取得
  useEffect(() => {
    setRecentIds(getRecentProjectIds());
  }, []);

  // フィルタリングとソート
  const { recentProjects, otherProjects } = useMemo(() => {
    // まずフィルタリング
    const filtered = projects.filter((p) => {
      // 検索
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchCode = p.code.toLowerCase().includes(q);
        const matchCustomer = p.contact_id
          ? (contactDisplayMap[p.contact_id] || "").toLowerCase().includes(q)
          : false;
        if (!matchName && !matchCode && !matchCustomer) return false;
      }

      // 担当者フィルタ
      if (filterManagerId && p.manager_id !== filterManagerId) {
        return false;
      }

      return true;
    });

    // 最近表示した業務（上位3件）とその他に分ける
    const recentTop3 = recentIds.slice(0, 3);
    const recent: Project[] = [];
    const other: Project[] = [];

    filtered.forEach((p) => {
      if (recentTop3.includes(p.id)) {
        recent.push(p);
      } else {
        other.push(p);
      }
    });

    // 最近表示した業務を閲覧順にソート
    recent.sort((a, b) => recentTop3.indexOf(a.id) - recentTop3.indexOf(b.id));

    return { recentProjects: recent, otherProjects: other };
  }, [projects, searchQuery, filterManagerId, contactDisplayMap, recentIds]);

  const totalCount = recentProjects.length + otherProjects.length;

  const renderProjectItem = (project: Project, isRecent: boolean = false) => {
    const customerName = project.contact_id
      ? contactDisplayMap[project.contact_id]
      : null;
    const managerName = project.manager_id
      ? employeeMap[project.manager_id]
      : null;
    const location = [project.location, project.location_detail]
      .filter(Boolean)
      .join(" ");

    return (
      <Link
        key={project.id}
        href={`/m/projects/${project.id}`}
        className={`block px-4 py-3 active:bg-muted/50 ${
          project.is_urgent
            ? "bg-red-50"
            : project.is_on_hold
            ? "bg-gray-100"
            : ""
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* コードとバッジ */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-muted-foreground">
                {project.code}
              </span>
              {isRecent && (
                <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-blue-300 text-blue-600">
                  <Clock className="h-3 w-3 mr-0.5" />
                  最近
                </Badge>
              )}
              {project.is_urgent && (
                <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                  <AlertTriangle className="h-3 w-3 mr-0.5" />
                  重要
                </Badge>
              )}
              {project.is_on_hold && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  <Pause className="h-3 w-3 mr-0.5" />
                  待機
                </Badge>
              )}
            </div>

            {/* 業務名 */}
            <h3 className="font-medium text-sm truncate">{project.name}</h3>

            {/* 顧客・場所 */}
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              {customerName && (
                <span className="truncate max-w-[120px]">{customerName}</span>
              )}
              {location && (
                <>
                  <span>•</span>
                  <span className="truncate">{location}</span>
                </>
              )}
            </div>

            {/* 担当者 */}
            {managerName && (
              <div className="mt-1 text-xs text-muted-foreground">
                担当: {managerName}
              </div>
            )}
          </div>

          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-2" />
        </div>
      </Link>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* ヘッダー */}
      <header className="sticky top-0 bg-background border-b z-10 px-4 py-3">
        <h1 className="text-lg font-bold mb-3">業務一覧</h1>

        {/* 検索 */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* 担当者フィルタ */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          <button
            onClick={() => setFilterManagerId(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap transition-colors ${
              !filterManagerId
                ? "bg-foreground text-background border-foreground"
                : "bg-background text-muted-foreground border-border"
            }`}
          >
            全員
          </button>
          {employees.map((emp) => (
            <button
              key={emp.id}
              onClick={() => setFilterManagerId(emp.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap transition-colors ${
                filterManagerId === emp.id
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border"
              }`}
            >
              {emp.name}
            </button>
          ))}
        </div>
      </header>

      {/* 件数 */}
      <div className="px-4 py-2 text-sm text-muted-foreground border-b">
        {totalCount}件
      </div>

      {/* プロジェクト一覧 */}
      <div className="flex-1 overflow-y-auto">
        {totalCount === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            該当する業務がありません
          </p>
        ) : (
          <div className="divide-y">
            {/* 最近表示した業務 */}
            {recentProjects.map((project) => renderProjectItem(project, true))}
            {/* その他の業務 */}
            {otherProjects.map((project) => renderProjectItem(project, false))}
          </div>
        )}
      </div>
    </div>
  );
}
