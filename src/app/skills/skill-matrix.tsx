"use client";

import { useState, useTransition } from "react";
import {
  SKILL_LEVELS,
  type SkillCategoryWithItems,
  type EmployeeSkill,
  type Employee,
  type SkillLevel,
} from "@/types/database";
import { setEmployeeSkillLevel } from "./actions";

interface SkillMatrixProps {
  category: SkillCategoryWithItems;
  employees: Employee[];
  skills: EmployeeSkill[];
  canEdit: boolean;
}

export function SkillMatrix({
  category,
  employees,
  skills,
  canEdit,
}: SkillMatrixProps) {
  // ローカル状態（楽観的更新用）
  const [localSkills, setLocalSkills] = useState<Map<string, SkillLevel>>(() => {
    const map = new Map<string, SkillLevel>();
    for (const s of skills) {
      map.set(`${s.employee_id}:${s.skill_item_id}`, s.level);
    }
    return map;
  });
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const getLevel = (employeeId: string, itemId: string): SkillLevel => {
    return localSkills.get(`${employeeId}:${itemId}`) ?? 0;
  };

  const handleCellClick = (
    employeeId: string,
    itemId: string,
    currentLevel: SkillLevel
  ) => {
    if (!canEdit) return;
    // クリックで +1 (0→1→2→3→4→0)
    const nextLevel: SkillLevel = ((currentLevel + 1) % 5) as SkillLevel;

    // 楽観的更新
    const key = `${employeeId}:${itemId}`;
    const prev = new Map(localSkills);
    const next = new Map(localSkills);
    next.set(key, nextLevel);
    setLocalSkills(next);
    setError(null);

    startTransition(async () => {
      const result = await setEmployeeSkillLevel(employeeId, itemId, nextLevel);
      if (result.error) {
        // ロールバック
        setLocalSkills(prev);
        setError(result.error);
      }
    });
  };

  return (
    <>
      {error && (
        <div className="mb-3 text-sm text-red-500 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
          {error}
        </div>
      )}

      {canEdit && (
        <p className="text-xs text-muted-foreground mb-2">
          セルをクリックするとレベルが変わります（0→1→2→3→4→0）
        </p>
      )}

      <div className="overflow-x-auto border rounded-md bg-background">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-muted/50 sticky top-0">
            <tr>
              <th className="border-r border-b px-3 py-2 text-left font-semibold sticky left-0 bg-muted/50 z-10 min-w-[160px]">
                工程 \ 社員
              </th>
              {employees.map((emp) => (
                <th
                  key={emp.id}
                  className="border-r border-b px-2 py-2 text-center font-medium whitespace-nowrap min-w-[80px]"
                >
                  {emp.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {category.items.map((item) => (
              <tr key={item.id} className="hover:bg-muted/20">
                <td
                  className="border-r border-b px-3 py-2 sticky left-0 bg-background z-10 font-medium"
                  title={item.description || undefined}
                >
                  {item.name}
                </td>
                {employees.map((emp) => {
                  const level = getLevel(emp.id, item.id);
                  const def = SKILL_LEVELS[level];
                  return (
                    <td
                      key={emp.id}
                      className="border-r border-b p-0 text-center"
                    >
                      <button
                        type="button"
                        onClick={() => handleCellClick(emp.id, item.id, level)}
                        disabled={!canEdit || isPending}
                        className={`w-full h-full px-2 py-2 ${def.bgColor} ${def.color} font-bold text-lg transition-opacity ${
                          canEdit
                            ? "cursor-pointer hover:opacity-80"
                            : "cursor-default"
                        } ${isPending ? "opacity-60" : ""}`}
                        title={`${def.label}: ${def.description}`}
                      >
                        {level}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
