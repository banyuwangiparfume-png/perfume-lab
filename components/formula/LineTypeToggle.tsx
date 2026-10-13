"use client";

import { Beaker, FlaskConical, Layers } from "lucide-react";
import type { LineType } from "@/lib/legacy/calc/types";
import { cn } from "@/lib/utils";

const OPTIONS: {
  value: LineType;
  label: string;
  icon: typeof Beaker;
  title: string;
}[] = [
  {
    value: "raw_material",
    label: "Bahan",
    icon: Beaker,
    title: "Raw material — bahan baku tunggal, punya nilai impact",
  },
  {
    value: "fo",
    label: "FO",
    icon: FlaskConical,
    title:
      "Fragrance oil — bibit parfum jadi. Isinya tidak diketahui, jadi tidak ikut dinilai kekuatannya",
  },
  {
    value: "sub_formula",
    label: "Formula",
    icon: Layers,
    title: "Accord atau booster buatan sendiri yang sudah tercatat di app",
  },
];

/**
 * Toggle tiga posisi di awal tiap baris editor. Lebarnya tetap supaya kolom
 * tabel tidak bergeser saat jenisnya diganti.
 *
 * Mengubah jenis mengosongkan komponen yang sudah dipilih — LineEditor yang
 * mengonfirmasi dulu kalau barisnya sudah terisi.
 */
export function LineTypeToggle({
  value,
  onChange,
  disabled,
}: {
  value: LineType;
  onChange: (next: LineType) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Jenis komponen"
      className="inline-flex w-[132px] rounded-lg border border-[var(--border-strong)] bg-white p-0.5"
    >
      {OPTIONS.map((option) => {
        const active = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.title}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1 rounded-[6px] px-1 py-1 text-[11px] font-medium transition-colors",
              active
                ? "bg-[var(--cta)] text-white"
                : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)]",
              disabled && "opacity-50",
            )}
          >
            <Icon className="size-3" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
