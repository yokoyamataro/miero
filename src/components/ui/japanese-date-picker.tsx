"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EraDef {
  code: string;
  label: string;
  offset: number; // 元年に対応する西暦から-1
  maxYear: number;
}

const ERAS: EraDef[] = [
  { code: "T", label: "大正", offset: 1911, maxYear: 15 },
  { code: "S", label: "昭和", offset: 1925, maxYear: 64 },
  { code: "H", label: "平成", offset: 1988, maxYear: 31 },
  { code: "R", label: "令和", offset: 2018, maxYear: 99 },
];

function daysInMonth(fullYear: number, month: number): number {
  return new Date(fullYear, month, 0).getDate();
}

function parseValue(value: string | null): {
  eraCode: string;
  year: string;
  month: string;
  day: string;
} {
  if (!value) return { eraCode: "", year: "", month: "", day: "" };
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return { eraCode: "", year: "", month: "", day: "" };
  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const d = parseInt(match[3], 10);
  // 新しい元号を優先で判定
  for (let i = ERAS.length - 1; i >= 0; i--) {
    const era = ERAS[i];
    const yearInEra = y - era.offset;
    if (yearInEra >= 1 && yearInEra <= era.maxYear) {
      return {
        eraCode: era.code,
        year: String(yearInEra),
        month: String(m),
        day: String(d),
      };
    }
  }
  return { eraCode: "", year: "", month: "", day: "" };
}

interface Props {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  id?: string;
}

export function JapaneseDatePicker({ value, onChange, disabled, id }: Props) {
  const initial = useMemo(() => parseValue(value), [value]);
  const [eraCode, setEraCode] = useState(initial.eraCode);
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [day, setDay] = useState(initial.day);

  // 外部の value が変わったら state を同期
  useEffect(() => {
    const p = parseValue(value);
    setEraCode(p.eraCode);
    setYear(p.year);
    setMonth(p.month);
    setDay(p.day);
  }, [value]);

  const era = ERAS.find((e) => e.code === eraCode);

  const yearOptions = useMemo(() => {
    if (!era) return [] as number[];
    return Array.from({ length: era.maxYear }, (_, i) => i + 1);
  }, [era]);

  const dayOptions = useMemo(() => {
    if (era && year && month) {
      const fullYear = era.offset + parseInt(year, 10);
      return Array.from(
        { length: daysInMonth(fullYear, parseInt(month, 10)) },
        (_, i) => i + 1
      );
    }
    return Array.from({ length: 31 }, (_, i) => i + 1);
  }, [era, year, month]);

  // 4項目揃ったら onChange に通知
  useEffect(() => {
    if (era && year && month && day) {
      const y = parseInt(year, 10);
      const m = parseInt(month, 10);
      const d = parseInt(day, 10);
      const fullYear = era.offset + y;
      const maxDay = daysInMonth(fullYear, m);
      const clamped = Math.min(d, maxDay);
      const iso = `${String(fullYear).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(clamped).padStart(2, "0")}`;
      if (iso !== value) {
        onChange(iso);
      }
    } else if (!era && !year && !month && !day && value) {
      onChange(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eraCode, year, month, day]);

  return (
    <div id={id} className="flex flex-wrap items-center gap-1">
      <Select
        value={eraCode}
        onValueChange={(v) => {
          setEraCode(v);
          // 年をリセット（新しい元号で無効な年になっている可能性）
          const newEra = ERAS.find((e) => e.code === v);
          if (newEra && year && parseInt(year, 10) > newEra.maxYear) {
            setYear("");
          }
        }}
        disabled={disabled}
      >
        <SelectTrigger className="w-[90px] h-10">
          <SelectValue placeholder="元号" />
        </SelectTrigger>
        <SelectContent>
          {ERAS.map((e) => (
            <SelectItem key={e.code} value={e.code}>
              {e.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={year} onValueChange={setYear} disabled={disabled || !era}>
        <SelectTrigger className="w-[80px] h-10">
          <SelectValue placeholder="年" />
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          {yearOptions.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y === 1 ? "元" : y}年
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={month} onValueChange={setMonth} disabled={disabled}>
        <SelectTrigger className="w-[70px] h-10">
          <SelectValue placeholder="月" />
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <SelectItem key={m} value={String(m)}>
              {m}月
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={day} onValueChange={setDay} disabled={disabled}>
        <SelectTrigger className="w-[70px] h-10">
          <SelectValue placeholder="日" />
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          {dayOptions.map((d) => (
            <SelectItem key={d} value={String(d)}>
              {d}日
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
