"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  OctagonAlert,
  type LucideIcon,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Analysis } from "@/lib/calc/analyze";
import type { BridgeStatus, BridgeSuggestion } from "@/lib/calc/bridge";
import { FUNCTION_HINTS, SPL_NOTE, UNKNOWN_KEY } from "@/lib/calc/functions";
import { fmtGram, fmtIdr, fmtNum, fmtPct } from "@/lib/calc/format";
import { RULES_FOOTER, RULES_HEALTHY, type Warning } from "@/lib/calc/rules";
import type { FormulaContext, Tier } from "@/lib/calc/types";
import { PYRAMID_TIERS, TIER_META, facetColor } from "@/lib/tiers";
import { cn } from "@/lib/utils";

type TabKey =
  | "ringkasan"
  | "aroma"
  | "kekuatan"
  | "fungsi"
  | "diffuser"
  | "pelarut"
  | "hpp"
  | "bridger";

const LEVEL: Record<
  Warning["level"],
  { icon: LucideIcon; className: string; bg: string }
> = {
  info: { icon: Info, className: "text-[var(--info)]", bg: "bg-[var(--info-soft)]" },
  warning: {
    icon: AlertTriangle,
    className: "text-[var(--warn)]",
    bg: "bg-[var(--warn-soft)]",
  },
  critical: {
    icon: OctagonAlert,
    className: "text-[var(--danger)]",
    bg: "bg-[var(--danger-soft)]",
  },
};

const ORDER: Record<Warning["level"], number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

/** Daftar peringatan. Nadanya memberi tahu, bukan menghakimi. */
export function WarningList({
  warnings,
  onAction,
}: {
  warnings: Warning[];
  onAction?: (w: Warning) => void;
}) {
  if (!warnings.length) {
    return (
      <div className="flex items-start gap-2.5 rounded-lg bg-[var(--ok-soft)] px-3.5 py-3">
        <CheckCircle2 className="mt-0.5 size-[18px] shrink-0 text-[var(--ok)]" />
        <p className="text-[13px] leading-relaxed">{RULES_HEALTHY}</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {warnings
        .slice()
        .sort((a, b) => ORDER[a.level] - ORDER[b.level])
        .map((w, i) => {
          const level = LEVEL[w.level];
          const Icon = level.icon;
          return (
            <li
              key={`${w.code}-${i}`}
              className={cn(
                "flex items-start gap-2.5 rounded-lg px-3.5 py-2.5",
                level.bg,
              )}
            >
              <Icon className={cn("mt-0.5 size-[18px] shrink-0", level.className)} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-relaxed">{w.message}</p>
                {w.action && onAction && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 bg-white"
                    onClick={() => onAction(w)}
                  >
                    {w.action.kind === "normalize_tier"
                      ? `Normalisasi ${TIER_META[w.action.tier].label}`
                      : w.action.kind === "retarget_tier"
                        ? `Jadikan target ${fmtPct(w.action.target)}`
                        : "Terapkan saran"}
                  </Button>
                )}
              </div>
              <span className="shrink-0 text-[10px] font-semibold text-[var(--text-subtle)]">
                {w.code}
              </span>
            </li>
          );
        })}
    </ul>
  );
}

function StatTile({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] px-3 py-2">
      <p className="numeric text-[18px] font-semibold leading-tight">{value}</p>
      <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

function AromaTab({ analysis }: { analysis: Analysis }) {
  const [scope, setScope] = useState<"all" | Tier>("all");
  const pie = analysis.aroma[scope as Tier] ?? analysis.aroma.all;
  const slices = [
    ...pie.slices.map((s) => ({ key: s.facet, name: s.facet, value: s.pct })),
    ...(pie.other > 0.05
      ? [{ key: "__other", name: "Lainnya", value: pie.other }]
      : []),
  ];

  if (!slices.length) {
    return (
      <p className="text-[13px] text-[var(--text-muted)]">
        Belum ada yang bisa dihitung. Tambahkan bahan yang punya data facet, atau
        lengkapi odour profile-nya di master bahan.
      </p>
    );
  }

  const dominant = pie.slices[0];

  return (
    <div className="space-y-3">
      <Tabs value={scope} onValueChange={(v) => setScope(v as "all" | Tier)}>
        <TabsList className="w-full">
          <TabsTrigger value="all">Semua</TabsTrigger>
          {PYRAMID_TIERS.map((t) => (
            <TabsTrigger key={t} value={t}>
              {TIER_META[t].label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="relative mx-auto size-[170px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              innerRadius="60%"
              outerRadius="100%"
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
            >
              {slices.map((s) => (
                <Cell
                  key={s.key}
                  fill={
                    s.key === "__other"
                      ? "var(--facet-other)"
                      : facetColor(s.key)
                  }
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {dominant && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="text-[13px] font-semibold capitalize">
                {dominant.facet}
              </p>
              <p className="numeric text-[12px] text-[var(--text-muted)]">
                {fmtPct(dominant.pct)}
              </p>
            </div>
          </div>
        )}
      </div>

      <ul className="space-y-1 text-[13px]">
        {slices.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-sm"
              style={{
                backgroundColor:
                  s.key === "__other" ? "var(--facet-other)" : facetColor(s.key),
              }}
            />
            <span className="flex-1 capitalize">{s.name}</span>
            <span className="numeric font-medium">{fmtPct(s.value)}</span>
          </li>
        ))}
      </ul>

      {(pie.excludedPct > 0.05 || pie.missingFacets.length > 0) && (
        <p className="border-t border-[var(--border)] pt-2 text-[11px] text-[var(--text-subtle)]">
          {fmtPct(pie.excludedPct)} formula tidak ikut dihitung di pie ini
          {pie.missingFacets.length > 0 &&
            ` — ${pie.missingFacets.join(", ")} belum punya data facet`}
          .
        </p>
      )}
    </div>
  );
}

function StrengthTab({ analysis }: { analysis: Analysis }) {
  const rows = analysis.strength.rows;
  const max = Math.max(1, ...rows.map((r) => r.strengthPct ?? 0));

  return (
    <div className="space-y-4">
      <p className="text-[12px] leading-relaxed text-[var(--text-muted)]">
        Batang abu = porsi berat. Batang berwarna = porsi kekuatan. Kalau yang
        berwarna jauh lebih panjang, bahan itu mendominasi lebih dari yang
        terlihat di resep.
      </p>

      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.refId}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="truncate text-[13px] font-medium">
                {r.name}
                {r.via.length > 0 && (
                  <span className="ml-1 text-[11px] font-normal text-[var(--text-subtle)]">
                    via {r.via.join(" → ")}
                  </span>
                )}
              </span>
              <span className="numeric shrink-0 text-[12px] text-[var(--text-muted)]">
                {fmtPct(r.productPct)} berat
                {r.strengthPct != null && (
                  <>
                    {" · "}
                    <strong className="text-[var(--text)]">
                      {fmtPct(r.strengthPct)}
                    </strong>
                  </>
                )}
              </span>
            </div>
            <div
              className="h-[5px] rounded-full bg-[var(--impact-low)]/55"
              style={{ width: `${(r.productPct / 100) * 100}%` }}
              aria-hidden
            />
            {r.strengthPct == null ? (
              <p className="mt-1 text-[11px] italic text-[var(--text-subtle)]">
                tidak dinilai — {r.kind === "fo" ? "isi FO tidak diketahui" : "pelarut"}
              </p>
            ) : (
              <div
                className="mt-1 h-[11px] rounded-full"
                style={{
                  width: `${Math.max(1, (r.strengthPct / max) * 100)}%`,
                  backgroundColor: r.impactMissing
                    ? "var(--impact-low)"
                    : "var(--brand)",
                }}
                aria-hidden
              />
            )}
          </li>
        ))}
      </ul>

      <div className="border-t border-[var(--border)] pt-3">
        <p className="mb-2 text-[13px] font-semibold">Piramida nyata</p>
        <ul className="space-y-2">
          {analysis.realPyramid.map((row) => {
            const meta = TIER_META[row.tier];
            return (
              <li key={row.tier}>
                <div className="mb-1 flex justify-between text-[12px]">
                  <span className="font-medium">{meta.label}</span>
                  <span className="numeric text-[var(--text-muted)]">
                    target {fmtNum(row.target)} · terisi {fmtNum(row.filled)} ·{" "}
                    <strong className="text-[var(--text)]">
                      aktif {fmtNum(row.active)}
                    </strong>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, row.active)}%`,
                      backgroundColor: meta.color,
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-[11px] text-[var(--text-subtle)]">
          Aktif = bahan pewangi setelah pelarut dikeluarkan.
        </p>
      </div>
    </div>
  );
}

function SolventTab({
  analysis,
  onApply,
}: {
  analysis: Analysis;
  onApply?: (solventId: string, newDirectPct: number) => void;
}) {
  const { rows, totalEffectivePct } = analysis.solvents;

  if (!rows.length) {
    return (
      <p className="text-[13px] text-[var(--text-muted)]">
        Belum ada pelarut di formula ini — tidak ada baris pelarut langsung,
        tidak ada dilusi, dan tidak ada bahan yang sudah encer dari supplier.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div
          key={row.solventId}
          className="rounded-lg border border-[var(--border)] p-3"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-medium">{row.name}</span>
            <span className="numeric text-[13px] font-semibold">
              {fmtPct(row.effectiveTotal)}
            </span>
          </div>

          <ul className="mt-2 space-y-0.5 text-[12px] text-[var(--text-muted)]">
            {row.directPct > 0 && (
              <li className="flex justify-between">
                <span>ditambahkan langsung</span>
                <span className="numeric">{fmtPct(row.directPct)}</span>
              </li>
            )}
            {row.fromDilution.map((d, i) => (
              <li key={`d${i}`} className="flex justify-between">
                <span>dari dilusi {d.lineName}</span>
                <span className="numeric">{fmtPct(d.pct)}</span>
              </li>
            ))}
            {row.fromAccords.map((a, i) => (
              <li key={`a${i}`} className="flex justify-between">
                <span>dari {a.accordName}</span>
                <span className="numeric">{fmtPct(a.pct)}</span>
              </li>
            ))}
            {row.hiddenFromSupplier.map((h, i) => (
              <li key={`h${i}`} className="flex justify-between italic">
                <span>bawaan {h.materialName}</span>
                <span className="numeric">{fmtPct(h.pct)}</span>
              </li>
            ))}
          </ul>

          {row.directPct > 0 && row.effectiveTotal > 10 && onApply && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() =>
                onApply(
                  row.solventId,
                  Math.max(0, row.directPct - (row.effectiveTotal - 10)),
                )
              }
            >
              Turunkan baris langsung ke{" "}
              {fmtPct(Math.max(0, row.directPct - (row.effectiveTotal - 10)))}
            </Button>
          )}
        </div>
      ))}

      <p className="text-[12px] text-[var(--text-muted)]">
        Total semua pelarut:{" "}
        <strong className="numeric text-[var(--text)]">
          {fmtPct(totalEffectivePct)}
        </strong>{" "}
        dari formula.
      </p>
    </div>
  );
}

function CostTab({ analysis, batchG }: { analysis: Analysis; batchG: number }) {
  const { cost } = analysis;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-[var(--surface-muted)] px-2 py-1 text-[12px] font-medium">
          Harga tier {fmtNum(cost.tier)} g
        </span>
        <span className="text-[11px] text-[var(--text-subtle)]">
          batch {fmtNum(batchG)} g → tier {fmtNum(cost.tier)} g
        </span>
      </div>

      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.04em] text-[var(--text-muted)]">
            <th className="py-1.5 text-left font-medium">Bahan</th>
            <th className="py-1.5 text-right font-medium">Gram</th>
            <th className="py-1.5 text-right font-medium">Biaya</th>
            <th className="py-1.5 text-right font-medium">%</th>
          </tr>
        </thead>
        <tbody>
          {cost.rows.map((r) => (
            <tr key={r.refId} className="border-b border-[var(--border)]">
              <td className="py-1.5">
                {r.name}
                {r.fallback && (
                  <span
                    className="ml-1 text-[var(--warn)]"
                    title={`Harga diambil dari tier ${r.usedTier} g`}
                  >
                    ⚠
                  </span>
                )}
              </td>
              <td className="numeric py-1.5">{fmtGram(r.grams)}</td>
              <td className="numeric py-1.5">
                {r.cost == null ? "—" : fmtIdr(r.cost)}
              </td>
              <td className="numeric py-1.5 text-[var(--text-muted)]">
                {fmtPct(r.sharePct)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="grid grid-cols-3 gap-2">
        <StatTile value={fmtIdr(cost.total)} label="per batch" />
        <StatTile value={fmtIdr(cost.perGram)} label="per gram" />
        <StatTile value={fmtIdr(cost.per100g)} label="per 100 g" />
      </dl>

      {cost.missing.length > 0 && (
        <p className="text-[11px] text-[var(--warn)]">
          {cost.missing.length} bahan belum punya harga ({cost.missing.join(", ")}
          ) — total di atas belum lengkap.
        </p>
      )}
      <p className="text-[11px] text-[var(--text-subtle)]">
        1 ml dianggap 1 g.
      </p>
    </div>
  );
}

function BridgeTab({
  analysis,
  onAdd,
}: {
  analysis: Analysis;
  onAdd?: (materialId: string, tier: Tier, dose: number) => void;
}) {
  const { crossTier, withinTier } = analysis.bridges;

  if (!crossTier.length && !withinTier.length) {
    return (
      <p className="text-[13px] text-[var(--text-muted)]">
        Belum ada yang bisa dinilai. Isi minimal dua tier dengan bahan yang
        punya data facet.
      </p>
    );
  }

  const statusTone = {
    connected: "bg-[var(--ok-soft)] text-[var(--ok)]",
    loose: "bg-[var(--warn-soft)] text-[var(--warn)]",
    gap: "bg-[var(--danger-soft)] text-[var(--danger)]",
  } as const;
  const statusLabel = {
    connected: "Nyambung",
    loose: "Renggang",
    gap: "Jurang",
  } as const;

  const badge = (status: BridgeStatus, sim: number) => (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[11px] font-semibold",
        statusTone[status],
      )}
    >
      {statusLabel[status]} {fmtPct(sim * 100)}
    </span>
  );

  return (
    <div className="space-y-5">
      {/* ---------------------------- antar tier ---------------------------- */}
      {crossTier.length > 0 && (
        <section className="space-y-2.5">
          <h4 className="text-[13px] font-semibold">Antar tier</h4>

          {crossTier.map((pair) => (
            <div
              key={pair.pair.join("-")}
              className="rounded-lg border border-[var(--border)] p-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium">
                  {TIER_META[pair.pair[0]].label} ↔{" "}
                  {TIER_META[pair.pair[1]].label}
                </span>
                {badge(pair.status, pair.sim)}
              </div>

              <SuggestionList suggestions={pair.suggestions} onAdd={onAdd} />
            </div>
          ))}
        </section>
      )}

      {/* ---------------------------- dalam tier ---------------------------- */}
      {withinTier.length > 0 && (
        <section className="space-y-2.5">
          <div>
            <h4 className="text-[13px] font-semibold">Dalam tier</h4>
            {/*
              Transisi antar tier bisa mulus sementara isi satu tier sendiri
              terdengar seperti dua hal yang ditaruh berdampingan. Yang
              ditampilkan hanya pasangan yang TIDAK nyambung, diurut dari yang
              paling renggang.
            */}
            <p className="text-[11px] leading-relaxed text-[var(--text-subtle)]">
              Dua bahan di tier yang sama yang belum saling menyambung. Yang
              paling renggang di atas.
            </p>
          </div>

          {withinTier.map((pair) => (
            <div
              key={`${pair.a.lineId}-${pair.b.lineId}`}
              className="rounded-lg border border-[var(--border)] p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]"
                  style={{
                    color: TIER_META[pair.tier].color,
                    backgroundColor: TIER_META[pair.tier].soft,
                  }}
                >
                  {TIER_META[pair.tier].label}
                </span>
                <span className="text-[13px] font-medium">
                  {pair.a.name} ↔ {pair.b.name}
                </span>
                {badge(pair.status, pair.sim)}
              </div>

              <SuggestionList suggestions={pair.suggestions} onAdd={onAdd} />
            </div>
          ))}
        </section>
      )}

      <p className="text-[11px] leading-relaxed text-[var(--text-subtle)]">
        Satu celah, satu bridger. Mulai dosis kecil, naikkan sampai sambungannya
        halus — bukan sampai bridger-nya kecium sendiri.
      </p>
    </div>
  );
}

function SuggestionList({
  suggestions,
  onAdd,
}: {
  suggestions: BridgeSuggestion[];
  onAdd?: (materialId: string, tier: Tier, dose: number) => void;
}) {
  if (!suggestions.length) return null;

  return (
    <ul className="mt-2 space-y-1.5">
      {suggestions.map((s) => (
        <li
          key={s.materialId}
          className="flex items-start gap-2 rounded border border-[var(--border)] px-2 py-1.5"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium">
              {s.name}
              {s.inStock && <span className="ml-1 text-[var(--warn)]">★</span>}
              {s.ruleSource && (
                <span className="ml-1.5 rounded bg-[var(--surface-muted)] px-1 py-0.5 text-[10px] text-[var(--text-muted)]">
                  {s.ruleSource}
                </span>
              )}
            </p>
            <p className="text-[11px] text-[var(--text-subtle)]">{s.reason}</p>
          </div>
          {onAdd && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onAdd(s.materialId, s.tier, s.starterDose)}
            >
              + {TIER_META[s.tier].label}
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function AnalysisPanel({
  analysis,
  context,
  onWarningAction,
  onAddBridge,
  onApplySolvent,
}: {
  analysis: Analysis;
  context: FormulaContext;
  onWarningAction?: (w: Warning) => void;
  onAddBridge?: (materialId: string, tier: Tier, dose: number) => void;
  onApplySolvent?: (solventId: string, newDirectPct: number) => void;
}) {
  const [tab, setTab] = useState<TabKey>("ringkasan");
  const alerts = analysis.warnings.filter((w) => w.level !== "info").length;
  const dominantFacet = analysis.aroma.all.slices[0];
  const materialCount = analysis.strength.rows.filter(
    (r) => r.kind === "material" && !r.isSolvent,
  ).length;
  const activePct = analysis.realPyramid.reduce((a, r) => a + r.active, 0);

  return (
    <div className="space-y-3">
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="w-full flex-wrap">
          <TabsTrigger value="ringkasan">
            Ringkasan
            {alerts > 0 && (
              <span className="ml-1 rounded bg-[var(--warn)] px-1 text-[10px] font-semibold text-white">
                {alerts}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="aroma">Aroma</TabsTrigger>
          <TabsTrigger value="kekuatan">Kekuatan</TabsTrigger>
          <TabsTrigger value="fungsi">Fungsi</TabsTrigger>
          <TabsTrigger value="pelarut">Pelarut</TabsTrigger>
          <TabsTrigger value="hpp">HPP</TabsTrigger>
          <TabsTrigger value="bridger">Bridger</TabsTrigger>
          <TabsTrigger value="diffuser">Diffuser</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "ringkasan" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <StatTile value={materialCount} label="bahan (dibentangkan)" />
            <StatTile value={fmtPct(activePct)} label="bahan aktif" />
            <StatTile value={fmtIdr(analysis.cost.perGram)} label="HPP / gram" />
            <StatTile
              value={
                dominantFacet ? (
                  <span className="capitalize">{dominantFacet.facet}</span>
                ) : (
                  "—"
                )
              }
              label="facet dominan"
            />
          </div>
          <WarningList warnings={analysis.warnings} onAction={onWarningAction} />
        </div>
      )}

      {tab === "aroma" && <AromaTab analysis={analysis} />}
      {tab === "kekuatan" && <StrengthTab analysis={analysis} />}
      {tab === "fungsi" && <FunctionTab analysis={analysis} />}
      {tab === "pelarut" && (
        <SolventTab analysis={analysis} onApply={onApplySolvent} />
      )}
      {tab === "hpp" && (
        <CostTab analysis={analysis} batchG={context.version.batchG} />
      )}
      {tab === "bridger" && (
        <BridgeTab analysis={analysis} onAdd={onAddBridge} />
      )}
      {tab === "diffuser" && (
        <DiffuserTab analysis={analysis} onAdd={onAddBridge} />
      )}

      <p className="border-t border-[var(--border)] pt-2 text-[11px] leading-relaxed text-[var(--text-subtle)]">
        {RULES_FOOTER}
      </p>
    </div>
  );
}

/**
 * Komposisi peran bahan.
 *
 * Menjawab pertanyaan yang tidak dijawab panel lain: apakah formula ini punya
 * yang membawanya keluar dari kulit, dan punya yang menahannya supaya tidak
 * hilang duluan. Sengaja cuma memperlihatkan — tidak ada "porsi yang benar"
 * untuk diberitahukan, karena memang tidak ada.
 */
function FunctionTab({ analysis }: { analysis: Analysis }) {
  const mix = analysis.functions;

  if (!mix.rows.length) {
    return (
      <p className="text-[13px] text-[var(--text-muted)]">
        Belum ada bahan pewangi yang bisa dinilai. Pelarut dan FO tidak dihitung
        di sini.
      </p>
    );
  }

  const color: Record<string, string> = {
    diffuser: "var(--facet-citrus, #e0a93b)",
    modifier: "var(--brand)",
    bridger: "var(--facet-floral, #c2559b)",
    fixative: "var(--facet-woody, #8a6d2f)",
    [UNKNOWN_KEY]: "var(--text-subtle)",
  };

  return (
    <div className="space-y-3">
      {/* Satu batang utuh: proporsi antar peran lebih mudah dibaca
          berdampingan daripada sebagai lima angka terpisah. */}
      <div className="flex h-2.5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
        {mix.rows.map((row) => (
          <span
            key={row.key}
            className="block h-full first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${row.pct}%`,
              backgroundColor: color[row.key] ?? "var(--text-subtle)",
            }}
            title={`${row.label} ${fmtPct(row.pct)}`}
          />
        ))}
      </div>

      <ul className="divide-y divide-[var(--border)]">
        {mix.rows.map((row) => (
          <li key={row.key} className="py-2.5 first:pt-0">
            <div className="flex items-baseline gap-2">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: color[row.key] ?? "var(--text-subtle)" }}
              />
              <span className="text-[13px] font-medium">{row.label}</span>
              <span className="numeric ml-auto text-[13px] font-semibold">
                {fmtPct(row.pct)}
              </span>
              <span className="numeric w-20 text-[12px] text-[var(--text-muted)]">
                {fmtPct(row.strengthPct)} kekuatan
              </span>
            </div>

            {FUNCTION_HINTS[row.key] && (
              <p className="ml-4 text-[11px] text-[var(--text-subtle)]">
                {FUNCTION_HINTS[row.key]}
              </p>
            )}
            <p className="ml-4 text-[11px] leading-relaxed text-[var(--text-muted)]">
              {row.materials.join(" · ")}
            </p>
          </li>
        ))}
      </ul>

      <p className="rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
        {SPL_NOTE}
      </p>

      {/* Ke mana sisa persennya pergi — supaya tidak dicari-cari. */}
      <p className="border-t border-[var(--border)] pt-2 text-[11px] leading-relaxed text-[var(--text-subtle)]">
        Persen dihitung dari bahan pewangi saja.
        {mix.excluded.solventPct > 0 && (
          <> Pelarut {fmtPct(mix.excluded.solventPct)} tidak ikut.</>
        )}
        {mix.excluded.foPct > 0 && (
          <> FO {fmtPct(mix.excluded.foPct)} tidak ikut — isinya tidak diketahui.</>
        )}
        {mix.derivedPct > 0.05 && (
          <>
            {" "}
            {fmtPct(mix.derivedPct)} dari angka di atas masih TEBAKAN dari family
            bahannya, bukan data supplier. Koreksi di halaman bahan kalau tidak
            cocok.
          </>
        )}
        {mix.coverage + mix.derivedPct < 99.95 && (
          <>
            {" "}
            {fmtPct(100 - mix.coverage - mix.derivedPct)} bahan tidak bisa
            ditebak kategorinya sama sekali.
          </>
        )}
      </p>
    </div>
  );
}

/**
 * Penguat proyeksi.
 *
 * Panelnya sengaja dipisah dari Bridger walau tampilannya mirip, karena
 * pertanyaannya berbeda. Bridger mencari bahan yang duduk di ANTARA dua sisi
 * yang tidak nyambung. Diffuser mencari yang searah dengan formula secara
 * keseluruhan — tugasnya membawa yang sudah ada keluar lebih jauh, bukan
 * menambah watak baru. Menggabungkan keduanya dalam satu daftar membuat dua
 * nasihat yang beda tujuan terlihat setara.
 */
function DiffuserTab({
  analysis,
  onAdd,
}: {
  analysis: Analysis;
  onAdd?: (materialId: string, tier: Tier, dose: number) => void;
}) {
  const { sharePct, present, suggestions } = analysis.diffusers;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[var(--border)] p-3">
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-medium">Porsi diffuser</span>
          <span className="numeric ml-auto text-[15px] font-semibold">
            {fmtPct(sharePct)}
          </span>
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-subtle)]">
          {present.length
            ? `Dari ${present.join(" · ")}.`
            : "Belum ada bahan berperan diffuser. Formulanya bisa terdengar dekat di kulit walau bahannya kuat."}
        </p>
      </div>

      {suggestions.length > 0 ? (
        <ul className="space-y-1.5">
          {suggestions.map((s) => (
            <li
              key={s.materialId}
              className="flex items-start gap-2 rounded border border-[var(--border)] px-2 py-1.5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">
                  {s.name}
                  {s.inStock && <span className="ml-1 text-[var(--warn)]">★</span>}
                </p>
                <p className="text-[11px] text-[var(--text-subtle)]">
                  {s.reason}
                </p>
              </div>
              {onAdd && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onAdd(s.materialId, s.tier, s.starterDose)}
                >
                  + {TIER_META[s.tier].label}
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-[var(--text-muted)]">
          Belum ada saran. Isi dulu formulanya dengan bahan yang punya data
          facet — saran diffuser dicari dari arah aroma yang sudah terbentuk.
        </p>
      )}

      <p className="text-[11px] leading-relaxed text-[var(--text-subtle)]">
        Yang disarankan cuma bahan yang kategorinya benar-benar data supplier,
        bukan tebakan. Diffuser menaikkan jangkauan, bukan ketahanan — yang
        menahan drydown ada di Fixative.
      </p>
    </div>
  );
}
