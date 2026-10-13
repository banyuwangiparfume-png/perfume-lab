"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  FORMULA_SOURCES,
  FORMULA_TYPES,
  TARGET_CATEGORIES,
} from "@/lib/constants";

const ALL = "all";

export function FormulaFilters() {
  const router = useRouter();
  const params = useSearchParams();

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (!value || value === ALL) next.delete(key);
    else next.set(key, value);
    router.replace(`/formulas?${next.toString()}`);
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--text-subtle)]" />
        <Input
          defaultValue={params.get("q") ?? ""}
          placeholder="Cari nama formula…"
          aria-label="Cari formula"
          className="bg-white pl-8"
          onChange={(e) => setParam("q", e.target.value || null)}
        />
      </div>

      <Select
        value={params.get("type") ?? ALL}
        onValueChange={(v) => setParam("type", v)}
      >
        <SelectTrigger className="w-[150px] bg-white" aria-label="Filter tipe">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Semua tipe</SelectItem>
          {FORMULA_TYPES.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={params.get("source") ?? ALL}
        onValueChange={(v) => setParam("source", v)}
      >
        <SelectTrigger
          className="w-[160px] bg-white"
          aria-label="Filter sumber"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Semua sumber</SelectItem>
          {FORMULA_SOURCES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={params.get("category") ?? ALL}
        onValueChange={(v) => setParam("category", v)}
      >
        <SelectTrigger
          className="w-[150px] bg-white"
          aria-label="Filter kategori target"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Semua kategori</SelectItem>
          {TARGET_CATEGORIES.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-white px-3 py-2">
        <Switch
          id="archived"
          checked={params.get("archived") === "1"}
          onCheckedChange={(on) => setParam("archived", on ? "1" : null)}
        />
        <Label htmlFor="archived" className="text-[13px]">
          Arsip
        </Label>
      </div>
    </div>
  );
}
