"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { ImpactBadge } from "@/components/shared/ImpactBadge";
import type { LineTable } from "@/lib/calc/lines";
import { EMPTY, fmtGram, fmtNum, fmtPct } from "@/lib/calc/format";
import type { Tier } from "@/lib/calc/types";
import { PYRAMID_TIERS, TIER_META } from "@/lib/tiers";
import { cn } from "@/lib/utils";

type Props = {
  table: LineTable;
  batchG: number;
  /** false = formula tanpa piramida; semua baris jadi satu kelompok */
  grouped: boolean;
  /** id bahan & FO yang ada di rak — array, karena Set tidak bisa dikirim dari server */
  stock?: string[];
};

const gram = (pct: number, batchG: number) => (pct / 100) * batchG;

/**
 * Tabel komposisi read-only di halaman detail.
 *
 * Angkanya TIDAK dihitung di sini — semuanya datang dari `lineTable` lewat
 * `analyze`, jalur yang sama dengan panel live di editor. Komponen ini cuma
 * menyusun dan memberi warna.
 */
export function CompositionTable({ table, batchG, grouped, stock = [] }: Props) {
  const inStock = new Set(stock);
  const [open, setOpen] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const groups: { tier: Tier | null; rows: LineTable["rows"] }[] = grouped
    ? PYRAMID_TIERS.map((tier) => ({
        tier,
        rows: table.rows.filter((r) => r.tier === tier),
      })).filter((g) => g.rows.length > 0)
    : [{ tier: null, rows: table.rows }];

  const hasFo = table.rows.some((r) => r.kind === "fo");

  return (
    <div className="-mx-5 overflow-x-auto md:mx-0">
      <table className="w-full min-w-[840px] text-sm">
        <thead>
          <tr className="border-y border-[var(--border)] bg-[var(--surface-muted)] text-[11px] uppercase tracking-[0.04em] text-[var(--text-muted)]">
            <th className="w-9 px-2 py-2 text-right font-medium">#</th>
            <th className="px-3 py-2 text-left font-medium">Komponen</th>
            <th className="px-3 py-2 text-right font-medium">%</th>
            <th className="px-3 py-2 text-right font-medium">Timbang (g)</th>
            <th className="px-3 py-2 text-left font-medium">Dilusi</th>
            <th className="px-3 py-2 text-right font-medium">Murni (g)</th>
            <th className="px-3 py-2 text-right font-medium">% murni</th>
            <th className="px-3 py-2 text-left font-medium">Impact</th>
            <th className="min-w-[132px] px-3 py-2 text-right font-medium">
              % kekuatan
            </th>
          </tr>
        </thead>

        {groups.map((group) => (
          <tbody key={group.tier ?? "all"}>
            {group.tier && (
              <tr>
                <td colSpan={9} className="px-3 pb-1 pt-3">
                  <span
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em]"
                    style={{ color: TIER_META[group.tier].color }}
                  >
                    <span
                      aria-hidden
                      className="size-2 rounded-full"
                      style={{ backgroundColor: TIER_META[group.tier].color }}
                    />
                    {TIER_META[group.tier].label}
                  </span>
                </td>
              </tr>
            )}

            {group.rows.map((row) => {
              const expandable = row.sub.length > 0;
              const isOpen = open.has(row.lineId);

              return (
                <Rows
                  key={row.lineId}
                  row={row}
                  batchG={batchG}
                  expandable={expandable}
                  isOpen={isOpen}
                  inStock={inStock.has(row.refId)}
                  onToggle={() => toggle(row.lineId)}
                />
              );
            })}
          </tbody>
        ))}

        <tfoot>
          <tr className="border-t border-[var(--border)] bg-[var(--surface-muted)] font-semibold">
            <td />
            <td className="px-3 py-2">Total</td>
            <td className="numeric px-3 py-2 text-right">
              {fmtPct(table.total.pct)}
            </td>
            <td className="numeric px-3 py-2 text-right">
              {fmtGram(gram(table.total.pct, batchG))}
            </td>
            <td />
            <td className="numeric px-3 py-2 text-right">
              {fmtGram(gram(table.total.activePct, batchG))}
            </td>
            <td className="numeric px-3 py-2 text-right">
              {fmtPct(table.total.activePct)}
            </td>
            <td />
            <td className="numeric px-3 py-2 text-right">
              {fmtPct(table.total.strengthPct)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Dua hal yang membuat kolom kekuatan tidak genap 100%. Keduanya wajar,
          tapi kalau tidak dijelaskan user akan menganggap angkanya bocor. */}
      {(table.total.dilutionSolventStrengthPct > 0.05 || hasFo) && (
        <p className="px-5 pt-2 text-[12px] leading-relaxed text-[var(--text-subtle)] md:px-0">
          {table.total.dilutionSolventStrengthPct > 0.05 && (
            <>
              {fmtPct(table.total.dilutionSolventStrengthPct)} kekuatan datang
              dari pelarut hasil pengenceran, jadi tidak ditempelkan ke baris
              mana pun.{" "}
            </>
          )}
          {hasFo && <>Baris FO tidak ikut dinilai kekuatannya.</>}
        </p>
      )}
    </div>
  );
}

function Rows({
  row,
  batchG,
  expandable,
  isOpen,
  inStock,
  onToggle,
}: {
  row: LineTable["rows"][number];
  batchG: number;
  expandable: boolean;
  isOpen: boolean;
  inStock: boolean;
  onToggle: () => void;
}) {
  // Sel FO diberi arsir tipis: memang tidak akan pernah terisi, dan itu beda
  // dari data yang belum dilengkapi.
  const foCell = row.kind === "fo" ? "bg-[var(--surface-muted)]/60" : undefined;

  return (
    <>
      <tr className="border-b border-[var(--border)]">
        <td className="numeric px-2 py-2 text-right text-[12px] text-[var(--text-subtle)]">
          {row.no}
        </td>

        <td className="px-3 py-2">
          <span className="flex items-center gap-1.5">
            {expandable ? (
              <button
                type="button"
                onClick={onToggle}
                aria-expanded={isOpen}
                className="-ml-1 rounded p-0.5 text-[var(--text-subtle)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
              >
                <ChevronRight
                  className={cn(
                    "size-3.5 transition-transform",
                    isOpen && "rotate-90",
                  )}
                />
                <span className="sr-only">
                  {isOpen ? "Tutup" : "Lihat"} isi {row.name}
                </span>
              </button>
            ) : (
              <span aria-hidden className="w-[1.125rem]" />
            )}

            <span className="font-medium">{row.name}</span>
            {/* Bintang yang sama dengan editor, picker, dan halaman Stok. */}
            {inStock && (
              <span
                className="text-[12px] text-[var(--warn)]"
                title="Ada di stok"
                aria-label="Ada di stok"
              >
                ★
              </span>
            )}

            {row.kind === "accord" && (
              <span className="rounded bg-[var(--brand-soft)] px-1 py-0.5 text-[10px] font-semibold text-[var(--brand)]">
                ACCORD
              </span>
            )}
            {row.kind === "fo" && (
              <span className="rounded bg-[#f0ece2] px-1 py-0.5 text-[10px] font-semibold text-[#8a6d2f]">
                FO
              </span>
            )}
          </span>
        </td>

        <td className="numeric px-3 py-2 text-right font-medium">
          {fmtPct(row.pct)}
        </td>
        <td className="numeric px-3 py-2 text-right">
          {fmtGram(gram(row.pct, batchG))}
        </td>

        <td className="px-3 py-2 text-[12px] text-[var(--text-muted)]">
          {row.userDilutionPct < 100
            ? `${fmtNum(row.userDilutionPct)}% in ${row.userSolventName ?? "?"}`
            : "neat"}
          {row.supplierDilutionPct !== null && (
            <span className="block text-[11px] text-[var(--text-subtle)]">
              bawaan {fmtNum(row.supplierDilutionPct)}%
              {row.supplierSolventName ? ` ${row.supplierSolventName}` : ""}
            </span>
          )}
        </td>

        <td className="numeric px-3 py-2 text-right text-[var(--text-muted)]">
          {fmtGram(gram(row.activePct, batchG))}
        </td>
        <td className="numeric px-3 py-2 text-right text-[var(--text-muted)]">
          {fmtPct(row.activePct)}
        </td>

        <td className={cn("px-3 py-2", foCell)}>
          <ImpactBadge
            value={row.impact}
            isFo={row.kind === "fo"}
            isAggregate={row.impactIsAverage}
          />
        </td>

        <td className={cn("px-3 py-2", foCell)}>
          <StrengthCell pct={row.strengthPct} />
        </td>
      </tr>

      {isOpen &&
        row.sub.map((sub) => (
          <tr
            key={`${row.lineId}:${sub.refId}`}
            className="border-b border-[var(--border)] bg-[var(--surface-muted)]/40 text-[13px]"
          >
            <td />
            <td className="py-1.5 pl-10 pr-3 text-[var(--text-muted)]">
              {sub.name}
            </td>
            <td className="numeric px-3 py-1.5 text-right text-[var(--text-muted)]">
              {fmtPct(sub.productPct)}
            </td>
            <td className="numeric px-3 py-1.5 text-right text-[var(--text-muted)]">
              {fmtGram(gram(sub.productPct, batchG))}
            </td>
            <td />
            <td className="numeric px-3 py-1.5 text-right text-[var(--text-subtle)]">
              {fmtGram(gram(sub.activePct, batchG))}
            </td>
            <td className="numeric px-3 py-1.5 text-right text-[var(--text-subtle)]">
              {fmtPct(sub.activePct)}
            </td>
            <td className="px-3 py-1.5 text-[12px] text-[var(--text-subtle)]">
              {sub.impact == null ? EMPTY : fmtNum(sub.impact)}
            </td>
            <td />
          </tr>
        ))}
    </>
  );
}

function StrengthCell({ pct }: { pct: number | null }) {
  if (pct == null) {
    return (
      <span className="block text-right text-[var(--text-subtle)]">{EMPTY}</span>
    );
  }

  return (
    <span className="flex items-center justify-end gap-2">
      <span
        aria-hidden
        className="h-1.5 w-14 overflow-hidden rounded-full bg-[var(--surface-muted)]"
      >
        <span
          className="block h-full rounded-full bg-[var(--brand)]"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </span>
      <span className="numeric w-12 text-right">{fmtPct(pct)}</span>
    </span>
  );
}
