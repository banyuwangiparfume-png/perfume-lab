"use client";

import { Fragment, useState } from "react";
import { ChevronRight } from "lucide-react";
import { ImpactBadge } from "@/components/shared/ImpactBadge";
import { Notice } from "@/components/shared/primitives";
import { scaleSubLines } from "@/lib/legacy/calc/expand";
import { fmtDilution, fmtGram, fmtIdr, fmtPct } from "@/lib/calc/format";
import { neatWeight } from "@/lib/legacy/calc/formula";
import type { CalcLine, CalcRow, FormulaResult } from "@/lib/legacy/calc/types";
import { FUNCTION_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const TYPE_BADGES: Record<string, { label: string; className: string }> = {
  fo: {
    label: "FO",
    className: "bg-[#f0ece2] text-[#8a6d2f]",
  },
  accord: { label: "Accord", className: "bg-[var(--brand-soft)] text-[var(--brand)]" },
  base: { label: "Base", className: "bg-[var(--brand-soft)] text-[var(--brand)]" },
  booster: { label: "Booster", className: "bg-[var(--brand-soft)] text-[var(--brand)]" },
  full_perfume: { label: "Parfum", className: "bg-[var(--brand-soft)] text-[var(--brand)]" },
  experiment: { label: "Eksperimen", className: "bg-[var(--brand-soft)] text-[var(--brand)]" },
};

function JenisBadge({ row }: { row: CalcRow }) {
  if (row.lineType === "raw_material") {
    return (
      <span className="text-[12px] text-[var(--text-subtle)]">
        {row.functionCategory ? (
          <span
            className="font-medium"
            style={{ color: FUNCTION_COLORS[row.functionCategory] }}
          >
            {row.functionCategory[0].toUpperCase() +
              row.functionCategory.slice(1)}
          </span>
        ) : (
          <>&mdash;</>
        )}
      </span>
    );
  }
  const badge =
    row.lineType === "fo"
      ? TYPE_BADGES.fo
      : (TYPE_BADGES[row.subFormulaType ?? "accord"] ?? TYPE_BADGES.accord);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold",
        badge.className,
      )}
    >
      {badge.label}
    </span>
  );
}

function StrengthCell({ row }: { row: CalcRow }) {
  if (row.lineType === "fo") {
    return (
      <div className="flex items-center justify-end">
        <span className="text-[12px] text-[var(--text-subtle)]">
          tidak dinilai
        </span>
      </div>
    );
  }
  if (row.strengthPct == null) {
    return (
      <div className="numeric text-[var(--text-subtle)]">&mdash;</div>
    );
  }
  const color = row.functionCategory
    ? FUNCTION_COLORS[row.functionCategory]
    : "var(--text-subtle)";
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-[var(--surface-muted)] sm:block">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, row.strengthPct)}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <span className="numeric w-14 font-medium">
        {fmtPct(row.strengthPct)}
      </span>
    </div>
  );
}

/**
 * Tabel komponen versi, bentuk RINGKAS: sub-formula tetap satu baris dan bisa
 * diperluas. Rules checker memakai bentuk yang sudah dibentangkan — itu beda
 * perhitungan, lihat lib/calc/analyze.ts.
 */
export function StrengthTable({ result }: { result: FormulaResult }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const partialBasis = result.strengthBasis < 99.95;

  return (
    <div className="space-y-3">
      {partialBasis && result.rows.length > 0 && (
        <Notice tone="info">
          % kekuatan dihitung dari{" "}
          <strong>{fmtPct(result.strengthBasis)}</strong> formula ini.
          {result.hasFO
            ? " Bagian FO tidak ikut dinilai karena isinya tidak diketahui."
            : " Bahan yang nilai impact-nya belum ada tidak ikut dinilai."}
        </Notice>
      )}

      <div className="-mx-5 overflow-x-auto md:mx-0">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-y border-[var(--border)] bg-[var(--surface-muted)] text-[12px] uppercase tracking-[0.04em] text-[var(--text-muted)]">
              <th className="w-10 px-3 py-2 text-left font-medium">#</th>
              <th className="px-3 py-2 text-left font-medium">Komponen</th>
              <th className="w-24 px-3 py-2 text-left font-medium">Jenis</th>
              <th className="w-24 px-3 py-2 text-right font-medium">
                Timbang
              </th>
              <th className="w-20 px-3 py-2 text-left font-medium">Dilusi</th>
              <th className="w-24 px-3 py-2 text-right font-medium">Murni</th>
              <th className="w-20 px-3 py-2 text-right font-medium">% murni</th>
              <th className="w-24 px-3 py-2 text-left font-medium">Impact</th>
              <th className="w-40 px-3 py-2 text-right font-medium">
                % kekuatan
              </th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, i) => {
              const canExpand =
                row.lineType === "sub_formula" &&
                (row.subLines?.length ?? 0) > 0;
              const isOpen = expanded.has(row.id);
              return (
                <Fragment key={row.id}>
                  <tr
                    className={cn(
                      "border-b border-[var(--border)] hover:bg-[var(--surface-muted)]",
                      row.lineType === "fo" && "bg-[var(--row-fo)]",
                      row.lineType === "sub_formula" &&
                        "bg-[var(--row-subformula)]",
                    )}
                  >
                    <td className="px-3 py-2.5 text-[var(--text-subtle)]">
                      {i + 1}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {canExpand ? (
                          <button
                            type="button"
                            onClick={() => toggle(row.id)}
                            aria-label={
                              isOpen
                                ? "Sembunyikan bahan penyusun"
                                : "Tampilkan bahan penyusun"
                            }
                            aria-expanded={isOpen}
                            className="grid size-5 shrink-0 place-items-center rounded text-[var(--text-muted)] hover:bg-[var(--border)]"
                          >
                            <ChevronRight
                              className={cn(
                                "size-3.5 transition-transform",
                                isOpen && "rotate-90",
                              )}
                            />
                          </button>
                        ) : (
                          <span className="size-5 shrink-0" />
                        )}
                        <span className="font-medium">{row.label}</span>
                      </div>
                      {row.note && (
                        <p className="ml-7 mt-0.5 text-[12px] text-[var(--text-subtle)]">
                          {row.note}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <JenisBadge row={row} />
                    </td>
                    <td className="numeric px-3 py-2.5">
                      {fmtGram(row.weightG)}
                    </td>
                    <td className="px-3 py-2.5 text-[13px] text-[var(--text-muted)]">
                      {fmtDilution(row.dilutionPct)}
                      {row.dilutionPct < 100 && row.solvent ? (
                        <span className="text-[var(--text-subtle)]">
                          {" "}
                          {row.solvent}
                        </span>
                      ) : null}
                    </td>
                    <td className="numeric px-3 py-2.5 text-[var(--text-muted)]">
                      {fmtGram(row.neatWeightG)}
                    </td>
                    <td className="numeric px-3 py-2.5">
                      {fmtPct(row.neatPct)}
                    </td>
                    <td className="px-3 py-2.5">
                      <ImpactBadge
                        value={row.effectiveImpact}
                        isFo={row.lineType === "fo"}
                        isAggregate={row.impactIsAggregate}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <StrengthCell row={row} />
                    </td>
                  </tr>

                  {isOpen &&
                    scaleSubLines(row as CalcLine).map((sub) => (
                      <tr
                        key={sub.id}
                        className="border-b border-[var(--border)] bg-[var(--row-subformula)]/60 text-[13px]"
                      >
                        <td />
                        <td className="py-2 pl-12 pr-3 text-[var(--text-muted)]">
                          {sub.label}
                        </td>
                        <td className="px-3 py-2 text-[12px] text-[var(--text-subtle)]">
                          {sub.functionCategory ?? "—"}
                        </td>
                        <td className="numeric px-3 py-2 text-[var(--text-muted)]">
                          {fmtGram(sub.weightG)}
                        </td>
                        <td className="px-3 py-2 text-[12px] text-[var(--text-subtle)]">
                          {fmtDilution(sub.dilutionPct)}
                        </td>
                        <td className="numeric px-3 py-2 text-[var(--text-muted)]">
                          {fmtGram(neatWeight(sub))}
                        </td>
                        <td />
                        <td className="px-3 py-2">
                          <ImpactBadge
                            value={sub.impact ?? null}
                            isFo={sub.lineType === "fo"}
                          />
                        </td>
                        <td />
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)] font-semibold">
              <td />
              <td className="px-3 py-2.5">Total</td>
              <td />
              <td className="numeric px-3 py-2.5">
                {fmtGram(result.totals.weighedG)}
              </td>
              <td />
              <td className="numeric px-3 py-2.5">
                {fmtGram(result.totals.neatG)}
              </td>
              <td className="numeric px-3 py-2.5">
                {result.rows.length ? "100,0%" : "—"}
              </td>
              <td />
              <td className="numeric px-3 py-2.5">
                {result.rows.some((r) => r.strengthPct != null)
                  ? "100,0%"
                  : "—"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[13px] text-[var(--text-muted)]">
        <span>
          Biaya:{" "}
          <strong className="text-[var(--text)]">
            {fmtIdr(result.totals.costIdr)}
          </strong>
          {result.totals.costPerGram != null && (
            <> &middot; {fmtIdr(result.totals.costPerGram)}/g</>
          )}
        </span>
        {result.totals.missingPrice.length > 0 && (
          <span className="text-[var(--warn)]">
            {result.totals.missingPrice.length} komponen belum punya harga, jadi
            total biaya belum lengkap.
          </span>
        )}
      </div>
    </div>
  );
}
