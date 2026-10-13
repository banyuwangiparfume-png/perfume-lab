"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DILUTION_PRESETS, SOLVENTS } from "@/lib/constants";

const CUSTOM = "custom";

/**
 * Dilusi + pelarut.
 *
 * Teks hasil hitungnya ditampilkan di tabel oleh LineEditor, bukan di sini,
 * supaya posisinya konsisten di tiap baris — tapi teks itu BUKAN hiasan:
 * tertukarnya berat timbang dengan berat murni adalah kesalahan paling mahal
 * di aplikasi jenis ini.
 */
export function DilutionSelect({
  value,
  solvent,
  onChange,
  disabled,
}: {
  value: number;
  solvent: string | null;
  onChange: (next: { dilutionPct: number; solvent: string | null }) => void;
  disabled?: boolean;
}) {
  const isPreset = (DILUTION_PRESETS as readonly number[]).includes(value);
  const [custom, setCustom] = useState(!isPreset);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1.5">
        <Select
          disabled={disabled}
          value={custom && !isPreset ? CUSTOM : String(value)}
          onValueChange={(v) => {
            if (v === CUSTOM) {
              setCustom(true);
              return;
            }
            setCustom(false);
            const pct = Number(v);
            onChange({
              dilutionPct: pct,
              // Neat tidak punya pelarut — menyimpan pelarut untuk bahan murni
              // akan membingungkan saat formulanya dibaca ulang nanti.
              solvent: pct >= 100 ? null : solvent,
            });
          }}
        >
          <SelectTrigger size="sm" className="w-[104px] bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DILUTION_PRESETS.map((pct) => (
              <SelectItem key={pct} value={String(pct)}>
                {pct === 100 ? "Neat (100%)" : `${pct}%`}
              </SelectItem>
            ))}
            <SelectItem value={CUSTOM}>Custom…</SelectItem>
          </SelectContent>
        </Select>

        {custom && !isPreset && (
          <Input
            type="number"
            inputMode="decimal"
            min={0.001}
            max={100}
            step="any"
            disabled={disabled}
            value={value}
            aria-label="Dilusi custom dalam persen"
            onChange={(e) => {
              const pct = Number(e.target.value);
              if (!Number.isFinite(pct)) return;
              onChange({
                dilutionPct: Math.min(100, Math.max(0.001, pct)),
                solvent: pct >= 100 ? null : solvent,
              });
            }}
            className="numeric h-8 w-[72px] bg-white"
          />
        )}
      </div>

      <Select
        disabled={disabled || value >= 100}
        value={solvent ?? "none"}
        onValueChange={(v) =>
          onChange({ dilutionPct: value, solvent: v === "none" ? null : v })
        }
      >
        <SelectTrigger
          size="sm"
          className="w-[104px] bg-white text-[12px]"
          aria-label="Pelarut"
        >
          <SelectValue placeholder="Pelarut" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">&mdash; pelarut</SelectItem>
          {SOLVENTS.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
