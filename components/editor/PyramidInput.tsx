"use client";

import { Input } from "@/components/ui/input";
import { fmtGram, fmtPct } from "@/lib/calc/format";
import type { Pyramid } from "@/lib/calc/types";
import {
  PYRAMID_PRESETS,
  PYRAMID_TIERS,
  TIER_META,
  parseDecimal,
} from "@/lib/tiers";
import { cn } from "@/lib/utils";

/**
 * Pengatur piramida: tiga persen yang harus berjumlah 100.
 *
 * Ini keputusan desain pertama yang diambil user sebelum memilih bahan apa
 * pun — "top 15, mid 25, base 60" — dan seluruh editor bekerja di dalam angka
 * itu. Preview gram ditampilkan langsung supaya persen tidak terasa abstrak.
 */
export function PyramidInput({
  value,
  batchG,
  onChange,
  compact,
}: {
  value: Pyramid;
  batchG: number;
  onChange: (next: Pyramid) => void;
  compact?: boolean;
}) {
  const total = value.top + value.mid + value.base;
  const ok = Math.abs(total - 100) < 0.001;
  const diff = total - 100;

  const set = (tier: "top" | "mid" | "base") => (raw: string) => {
    const n = parseDecimal(raw);
    if (n == null) return;
    onChange({ ...value, [tier]: Math.max(0, Math.min(100, n)) });
  };

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="flex flex-wrap gap-1.5">
          {PYRAMID_PRESETS.map((p) => {
            const active =
              p.top === value.top && p.mid === value.mid && p.base === value.base;
            return (
              <button
                key={`${p.top}-${p.mid}-${p.base}`}
                type="button"
                onClick={() => onChange(p)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-[12px] font-medium transition-colors",
                  active
                    ? "border-[var(--cta)] bg-[var(--cta)] text-white"
                    : "border-[var(--border-strong)] bg-white text-[var(--text-muted)] hover:bg-[var(--surface-muted)]",
                )}
              >
                {p.top}/{p.mid}/{p.base}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex gap-4">
        <div className="flex-1 space-y-2">
          {PYRAMID_TIERS.map((tier) => {
            const meta = TIER_META[tier];
            const pct = value[tier as "top" | "mid" | "base"];
            return (
              <div key={tier} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: meta.color }}
                />
                <label
                  htmlFor={`pyr-${tier}`}
                  className="w-10 shrink-0 text-[13px] font-medium"
                >
                  {meta.label}
                </label>
                <Input
                  id={`pyr-${tier}`}
                  inputMode="decimal"
                  value={String(pct)}
                  onChange={(e) => set(tier as "top" | "mid" | "base")(e.target.value)}
                  className="numeric h-8 w-[84px]"
                />
                <span className="text-[13px] text-[var(--text-subtle)]">%</span>
                <span className="numeric ml-auto text-[13px] text-[var(--text-muted)]">
                  {fmtGram((pct / 100) * batchG)} g
                </span>
              </div>
            );
          })}
        </div>

        {/* Visual piramida: lebar tiap lapis mengikuti porsinya. */}
        <div
          className="flex w-[110px] shrink-0 flex-col justify-center gap-1"
          aria-hidden
        >
          {PYRAMID_TIERS.map((tier) => {
            const pct = value[tier as "top" | "mid" | "base"];
            const meta = TIER_META[tier];
            return (
              <div
                key={tier}
                className="mx-auto rounded-sm transition-all"
                style={{
                  width: `${Math.max(12, Math.min(100, pct * 1.6))}%`,
                  height: `${Math.max(10, pct * 0.9)}px`,
                  backgroundColor: meta.color,
                }}
              />
            );
          })}
        </div>
      </div>

      <p
        className={cn(
          "text-[13px] font-medium",
          ok ? "text-[var(--ok)]" : "text-[var(--danger)]",
        )}
      >
        Total {fmtPct(total)}
        {ok ? " ✓" : diff > 0 ? ` · lebih ${fmtPct(diff)}` : ` · kurang ${fmtPct(-diff)}`}
      </p>
    </div>
  );
}
