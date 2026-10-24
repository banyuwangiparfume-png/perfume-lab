"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  CheckCircle2,
  Info,
  OctagonAlert,
  type LucideIcon,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Analysis } from "@/lib/calc/analyze";
import { PHASE_META } from "@/lib/calc/phases";
import type { RoleReport } from "@/lib/calc/roles";
import type { BridgeStatus, BridgeSuggestion } from "@/lib/calc/bridge";
import { FUNCTION_HINTS, SPL_NOTE, UNKNOWN_KEY } from "@/lib/calc/functions";
import { fmtGram, fmtIdr, fmtNum, fmtPct } from "@/lib/calc/format";
import { RULES_FOOTER, RULES_HEALTHY, type Warning } from "@/lib/calc/rules";
import type { FormulaContext, Tier } from "@/lib/calc/types";
import { PYRAMID_TIERS, TIER_META, facetColor, facetLabel } from "@/lib/tiers";
import { cn } from "@/lib/utils";

type TabKey =
  | "ringkasan"
  | "aroma"
  | "kekuatan"
  | "fungsi"
  | "diffuser"
  | "fixative"
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

const BOOST_TABS = [
  { key: "modifier", label: "Modifier", hint: "menambah karakter itu sendiri" },
  { key: "diffuser", label: "Diffuser", hint: "membawanya keluar lebih jauh" },
  { key: "fixative", label: "Fixative", hint: "menahannya lebih lama" },
] as const;

/**
 * Saran untuk menaikkan satu irisan aroma, dipisah per peran. Tiga peran itu
 * menjawab tiga keinginan berbeda di balik "woody-nya kurang": kurang
 * banyak, kurang terdengar, atau kurang lama.
 */
function BoostPanel({
  facet,
  boosts,
  onAdd,
}: {
  facet: string;
  boosts: Analysis["boosts"][string];
  onAdd: (materialId: string, tier: Tier, dose: number) => void;
}) {
  const [role, setRole] = useState<(typeof BOOST_TABS)[number]["key"]>(
    () => BOOST_TABS.find((t) => boosts[t.key].length > 0)?.key ?? "modifier",
  );
  const list = boosts[role];
  const tab = BOOST_TABS.find((t) => t.key === role)!;

  return (
    <div className="ml-4.5 mt-1.5 space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5">
      <Tabs value={role} onValueChange={(v) => setRole(v as typeof role)}>
        <TabsList className="w-full">
          {BOOST_TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
              <span className="ml-1 text-[10px] text-[var(--text-subtle)]">
                {boosts[t.key].length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <p className="text-[11px] text-[var(--text-subtle)]">
        {tab.label} {facetLabel(facet)} — {tab.hint}.
      </p>

      {list.length === 0 ? (
        <p className="text-[12px] text-[var(--text-muted)]">
          Tidak ada {tab.label.toLowerCase()} berarah {facetLabel(facet)} yang
          benar-benar menggeser irisan ini.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {list.map((b) => (
            <li
              key={b.materialId}
              className="flex items-start gap-2 rounded border border-[var(--border)] px-2 py-1.5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium">
                  {b.name}
                  {b.inStock && <span className="ml-1 text-[var(--warn)]">★</span>}
                </p>
                <p className="numeric text-[11px] text-[var(--text-muted)]">
                  di {fmtPct(b.starterDose)}: {facetLabel(facet)}{" "}
                  {fmtPct(b.beforePct)} → {fmtPct(b.afterPct)}
                </p>
                {b.guessedRole && (
                  <p className="text-[11px] text-[var(--text-subtle)]">
                    perannya ditebak dari family
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-[11px]"
                onClick={() => onAdd(b.materialId, b.tier, b.starterDose)}
              >
                + {TIER_META[b.tier].label}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const SPL_META = {
  sillage: { short: "S", label: "Sillage", hint: "jejak yang ditinggalkan" },
  projection: { short: "P", label: "Projection", hint: "seberapa jauh dari kulit" },
  longevity: { short: "L", label: "Longevity", hint: "seberapa lama bertahan" },
} as const;

/**
 * Perkiraan SPL. Tiap faktor ditampilkan dengan patokannya supaya angkanya
 * bisa dibantah — skor yang tidak bisa ditelusuri asalnya cuma akan dipercaya
 * atau diabaikan, dua-duanya sama tidak bergunanya.
 */
function SplCard({ spl }: { spl: Analysis["spl"] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3 rounded-lg border border-[var(--border)] p-3">
      <div className="grid grid-cols-3 gap-2">
        {(["sillage", "projection", "longevity"] as const).map((k) => (
          <div key={k}>
            <div className="flex items-baseline gap-1">
              <span className="numeric text-[22px] font-semibold leading-none">
                {spl[k].toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </span>
              <span className="text-[11px] text-[var(--text-subtle)]">/10</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
              <div
                className="h-full rounded-full bg-[var(--brand)]"
                style={{ width: `${spl[k] * 10}%` }}
              />
            </div>
            <p className="mt-1 text-[12px] font-medium">{SPL_META[k].label}</p>
            <p className="text-[11px] leading-snug text-[var(--text-subtle)]">
              {SPL_META[k].hint}
            </p>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text)]"
        aria-expanded={open}
      >
        {open ? "Sembunyikan" : "Dari mana angkanya?"}
      </button>

      {open && (
        <ul className="space-y-2">
          {spl.factors.map((f) => (
            <li key={f.key}>
              <div className="flex items-baseline gap-2 text-[12px]">
                <span className="font-medium">{f.label}</span>
                <span className="text-[10px] font-semibold tracking-wide text-[var(--text-subtle)]">
                  {f.feeds.map((x) => SPL_META[x].short).join(" ")}
                </span>
                <span className="numeric ml-auto text-[var(--text-muted)]">
                  {f.unit === "%" ? fmtPct(f.value) : Math.round(f.value)}
                  <span className="text-[var(--text-subtle)]">
                    {" "}
                    / {f.unit === "%" ? fmtPct(f.fullAt) : f.fullAt}
                  </span>
                </span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                <div
                  className="h-full rounded-full bg-[var(--text-subtle)]"
                  style={{ width: `${f.score * 100}%` }}
                />
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-[var(--text-subtle)]">
                {f.meaning}
              </p>
            </li>
          ))}
        </ul>
      )}

      {spl.notes.map((n) => (
        <p key={n} className="rounded bg-[var(--info-soft)] px-2.5 py-1.5 text-[12px] leading-relaxed">
          {n}
        </p>
      ))}

      <p className="text-[11px] leading-relaxed text-[var(--text-subtle)]">
        Perkiraan dari susunan formula, bukan pengukuran — konsentrasi di botol,
        kulit, dan cuaca tidak ikut dihitung. Pakai untuk membandingkan versi
        pada konsentrasi yang sama; berapa jam sebenarnya tetap hidungmu yang
        menilai.
      </p>
    </div>
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

function AromaTab({
  analysis,
  onAdd,
}: {
  analysis: Analysis;
  onAdd?: (materialId: string, tier: Tier, dose: number) => void;
}) {
  const [scope, setScope] = useState<"all" | Tier>("all");
  // Irisan yang sedang dibuka saran "naikkan"-nya. Satu saja sekaligus —
  // dua daftar saran yang terbuka bersamaan sulit dibandingkan.
  const [boosting, setBoosting] = useState<string | null>(null);
  const pie = analysis.aroma[scope as Tier] ?? analysis.aroma.all;
  const slices = [
    ...pie.slices.map((s) => ({
      key: s.facet,
      name: facetLabel(s.facet),
      value: s.pct,
      contributors: s.contributors,
      leaning: s.leaning,
    })),
    ...(pie.other > 0.05
      ? [
          {
            key: "__other",
            name: "Lainnya",
            value: pie.other,
            contributors: [],
            leaning: [],
          },
        ]
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
              <p className="text-[13px] font-semibold">
                {facetLabel(dominant.facet)}
              </p>
              <p className="numeric text-[12px] text-[var(--text-muted)]">
                {fmtPct(dominant.pct)}
              </p>
            </div>
          </div>
        )}
      </div>

{/*
        Tiap irisan menjawab tiga hal berurutan: seberapa besar, ke arah mana,
        dan dari bahan siapa. Tanpa arahnya, "Floral 26%" masih belum bisa
        dibayangkan baunya — floral yang condong fruity dan floral yang condong
        powdery adalah dua parfum yang berbeda. Tanpa penyumbangnya, user harus
        menyisir seluruh formula sendiri untuk menebak baris mana yang perlu
        diubah. Keduanya sudah ikut dihitung di aromaShares().
      */}
      <ul className="space-y-2.5 text-[13px]">
        {slices.map((s) => (
          <li key={s.key}>
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-sm"
                style={{
                  backgroundColor:
                    s.key === "__other"
                      ? "var(--facet-other)"
                      : facetColor(s.key),
                }}
              />
              <span className="flex-1">{s.name}</span>
              {/* Saran hanya untuk pie seluruh formula: dosis dan kenaikannya
                  dihitung terhadap formula utuh, bukan satu tier. */}
              {scope === "all" && onAdd && analysis.boosts[s.key] && (
                <button
                  type="button"
                  onClick={() => setBoosting(boosting === s.key ? null : s.key)}
                  aria-expanded={boosting === s.key}
                  className={cn(
                    "flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium",
                    boosting === s.key
                      ? "bg-[var(--cta)] text-white"
                      : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]",
                  )}
                >
                  Naikkan
                  <ChevronDown
                    className={cn(
                      "size-3 transition-transform",
                      boosting === s.key && "rotate-180",
                    )}
                  />
                </button>
              )}
              <span className="numeric font-medium">{fmtPct(s.value)}</span>
            </div>

            {/*
              Arah irisan, di atas daftar penyumbang. Urutannya disengaja:
              "ke mana floral-nya condong" adalah watak, dan watak dibaca
              duluan; nama bahan adalah tempat mengubahnya.
            */}
            {s.leaning.length > 0 && (
              <p className="ml-4.5 text-[11px] leading-relaxed">
                <span className="text-[var(--text-subtle)]">condong ke </span>
                {s.leaning.map((l, i) => (
                  <span key={l.facet}>
                    {i > 0 && (
                      <span className="text-[var(--text-subtle)]"> · </span>
                    )}
                    <span
                      className="font-medium"
                      // Warnanya sama dengan irisan pie-nya supaya terbaca
                      // sebagai facet, bukan sebagai kata biasa. Dicampur ke
                      // warna teks karena beberapa facet (creamy, powdery)
                      // terlalu pucat untuk dibaca di ukuran 11px.
                      style={{
                        color: `color-mix(in oklab, ${facetColor(l.facet)} 78%, var(--text))`,
                      }}
                    >
                      {facetLabel(l.facet)}
                    </span>
                    <span className="numeric text-[var(--text-subtle)]">
                      {" "}
                      {fmtPct(l.pct)}
                    </span>
                  </span>
                ))}
              </p>
            )}

            {s.contributors.length > 0 && (
              <p className="ml-4.5 text-[11px] leading-relaxed text-[var(--text-subtle)]">
                {s.contributors
                  .slice(0, 4)
                  .map((c) => `${c.name} ${fmtPct(c.pct)}`)
                  .join(" · ")}
                {s.contributors.length > 4 &&
                  ` · +${s.contributors.length - 4} lagi`}
              </p>
            )}

            {boosting === s.key && onAdd && analysis.boosts[s.key] && (
              <BoostPanel
                facet={s.key}
                boosts={analysis.boosts[s.key]}
                onAdd={onAdd}
              />
            )}
          </li>
        ))}
      </ul>

      {/*
        Dua persen bertetangga dengan penyebut berbeda adalah jebakan baca, dan
        satu kalimat ini yang mencegahnya dibaca terbalik.
      */}
      {slices.some((s) => s.leaning.length > 0) && (
        <p className="text-[11px] leading-relaxed text-[var(--text-subtle)]">
          Angka di baris <span className="font-medium">condong ke</span>
          dihitung terhadap irisannya sendiri, bukan terhadap seluruh formula.
        </p>
      )}

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

/**
 * Dua cara membaca kekuatan. "Total" satu angka per bahan sepanjang umur
 * parfum; "Per fase" memecahnya jadi Opening / Heart / Drydown, karena
 * pertanyaan yang paling sering — "yang kecium duluan apa?", "kayunya udah
 * kecium dari awal?" — tidak bisa dijawab satu angka.
 */
function StrengthTab({ analysis }: { analysis: Analysis }) {
  const [view, setView] = useState<"total" | "fase">("total");

  return (
    <div className="space-y-3">
      <Tabs value={view} onValueChange={(v) => setView(v as "total" | "fase")}>
        <TabsList className="w-full">
          <TabsTrigger value="total">Total</TabsTrigger>
          <TabsTrigger value="fase">Per fase</TabsTrigger>
        </TabsList>
      </Tabs>
      {view === "total" ? (
        <StrengthTotal analysis={analysis} />
      ) : (
        <PhaseView report={analysis.phases} />
      )}
    </div>
  );
}

function PhaseView({ report }: { report: Analysis["phases"] }) {
  const hasData = report.phases.some((p) => p.rows.length > 0);
  if (!hasData) {
    return (
      <p className="text-[13px] text-[var(--text-muted)]">
        Belum ada bahan yang bisa dinilai kekuatannya.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {report.phases.map((p) => {
        const meta = PHASE_META[p.key];
        return (
          <section
            key={p.key}
            className="space-y-2 rounded-lg border border-[var(--border)] p-3"
          >
            <div className="flex items-baseline gap-2">
              <span className="text-[13px] font-semibold">{meta.label}</span>
              <span className="text-[11px] text-[var(--text-subtle)]">
                {meta.when}
              </span>
            </div>

            {/* Porsi tier di fase ini, sewarna dengan header kartu tier. */}
            <div
              className="flex h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]"
              aria-hidden
            >
              {PYRAMID_TIERS.map((t) => (
                <div
                  key={t}
                  style={{
                    width: `${p.tiers[t as "top" | "mid" | "base"]}%`,
                    backgroundColor: TIER_META[t].color,
                  }}
                />
              ))}
            </div>
            <p className="numeric text-[11px] text-[var(--text-muted)]">
              {PYRAMID_TIERS.map(
                (t) =>
                  `${TIER_META[t].label} ${fmtPct(p.tiers[t as "top" | "mid" | "base"])}`,
              ).join(" · ")}
            </p>

            {p.facets.length > 0 && (
              <p className="text-[12px] leading-relaxed">
                <span className="text-[var(--text-subtle)]">tercium </span>
                {p.facets.map((f, i) => (
                  <span key={f.facet}>
                    {i > 0 && (
                      <span className="text-[var(--text-subtle)]"> · </span>
                    )}
                    <span
                      className="font-medium"
                      style={{
                        color: `color-mix(in oklab, ${facetColor(f.facet)} 78%, var(--text))`,
                      }}
                    >
                      {facetLabel(f.facet)}
                    </span>
                  </span>
                ))}
              </p>
            )}

            <ul className="space-y-0.5 text-[12px]">
              {p.rows.slice(0, 4).map((r) => (
                <li key={r.refId} className="flex items-baseline gap-2">
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: TIER_META[r.tier].color }}
                  />
                  <span className="min-w-0 flex-1 truncate">{r.name}</span>
                  <span className="numeric text-[var(--text-muted)]">
                    {fmtPct(r.pct)}
                  </span>
                </li>
              ))}
              {p.rows.length > 4 && (
                <li className="pl-4 text-[11px] text-[var(--text-subtle)]">
                  +{p.rows.length - 4} bahan lain
                </li>
              )}
            </ul>

            {p.notes.map((n) => (
              <p
                key={n}
                className="rounded bg-[var(--info-soft)] px-2.5 py-1.5 text-[12px] leading-relaxed"
              >
                {n}
              </p>
            ))}
          </section>
        );
      })}

      {/* Batas pendekatan ini disebut terus terang. Angka per fase yang
          terlihat presisi tapi tidak menyebut asalnya akan dipercaya lebih
          dari yang layak. */}
      <p className="text-[11px] leading-relaxed text-[var(--text-subtle)]">
        Ini pendekatan dari tier
        {report.fromPyramid ? "" : " (diambil dari kebiasaan tiap bahan, karena mode piramida mati)"}
        , bukan dari kecepatan menguap tiap molekul — pricelist tidak membawa
        data itu. Semua bahan sudah ada di udara sejak semprotan pertama; yang
        berubah cuma siapa yang paling keras. Bahan yang kamu taruh di tier
        yang tidak sesuai kebiasaannya akan terhitung salah fase. Urutan
        sebenarnya tetap hidungmu yang memutuskan, di blotter dan di kulit.
      </p>
    </div>
  );
}

function StrengthTotal({ analysis }: { analysis: Analysis }) {
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
  const [view, setView] = useState<"antar" | "kepaduan">("antar");

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

  // Status terburuk tiap bagian, supaya masalah di sub-tab yang sedang tidak
  // dibuka tetap kelihatan dari labelnya.
  const RANK = { connected: 0, loose: 1, gap: 2 } as const;
  const worst = (list: BridgeStatus[]): BridgeStatus | null =>
    list.length
      ? list.reduce((a, b) => (RANK[b] > RANK[a] ? b : a))
      : null;
  const crossWorst = worst(
    crossTier.filter((p) => p.comparable).map((p) => p.status),
  );
  const withinWorst = worst(withinTier.map((t) => t.status));
  const dotColor = {
    connected: "var(--ok)",
    loose: "var(--warn)",
    gap: "var(--danger)",
  } as const;
  const dot = (s: BridgeStatus | null) =>
    s && (
      <span
        aria-hidden
        className="ml-1.5 inline-block size-1.5 rounded-full"
        style={{ backgroundColor: dotColor[s] }}
      />
    );

  return (
    <div className="space-y-3">
      {/*
        Dua pertanyaan yang berbeda — sambungan antar lapisan, dan kepaduan
        isi tiap lapisan — dipisah ke sub-tab. Ditumpuk, bagian kedua selalu
        jatuh jauh di bawah dan harus discroll setiap kali dicek.
      */}
      <Tabs
        value={view}
        onValueChange={(v) => setView(v as "antar" | "kepaduan")}
      >
        <TabsList className="w-full">
          <TabsTrigger value="antar">
            Antar tier
            {dot(crossWorst)}
          </TabsTrigger>
          <TabsTrigger value="kepaduan">
            Kepaduan tier
            {dot(withinWorst)}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {view === "antar" && !crossTier.length && (
        <p className="text-[13px] text-[var(--text-muted)]">
          Sambungan antar tier baru bisa dinilai setelah mode piramida aktif dan
          minimal dua tier terisi.
        </p>
      )}
      {view === "kepaduan" && !withinTier.length && (
        <p className="text-[13px] text-[var(--text-muted)]">
          Kepaduan baru bisa dinilai setelah ada tier yang berisi minimal dua
          bahan dengan data facet.
        </p>
      )}

      {/* ---------------------------- antar tier ---------------------------- */}
      {view === "antar" && crossTier.length > 0 && (
        <section className="space-y-2.5">

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
                {/* Tier kosong bukan jurang. Melabelinya "Jurang 0%" memberi
                    tahu ada masalah pada transisi yang belum ada. */}
                {pair.comparable ? (
                  badge(pair.status, pair.sim)
                ) : (
                  <span className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-muted)]">
                    Belum bisa dinilai
                  </span>
                )}
              </div>

              {pair.comparable ? (
                <SuggestionList suggestions={pair.suggestions} onAdd={onAdd} />
              ) : (
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-subtle)]">
                  Salah satu sisinya belum ada bahannya. Transisi baru bisa
                  dinilai setelah kedua tier terisi — sementara itu, pakai
                  sub-tab Kepaduan tier untuk memeriksa yang sudah ada.
                </p>
              )}
            </div>
          ))}
        </section>
      )}

      {/* ---------------------------- dalam tier ---------------------------- */}
      {view === "kepaduan" && withinTier.length > 0 && (
        <section className="space-y-2.5">
          <div>
            {/*
              Dulu bagian ini membandingkan tiap PASANGAN bahan. Itu tidak
              pernah selesai — tiap bridger yang ditambahkan jadi bahan baru
              yang membentuk pasangan renggang dengan semua yang sudah ada — dan
              salah menilai: dua bahan yang berbeda bukan cacat.
            */}
            <p className="text-[11px] leading-relaxed text-[var(--text-subtle)]">
              Seberapa menyatu isi tiap tier sebagai satu accord. Bahan yang
              berbeda satu sama lain bukan masalah — kontras itu yang membuat
              accord menarik. Yang ditandai cuma bahan yang berdiri sendirian di
              luar arah tiernya.
            </p>
          </div>

          {withinTier.map((t) => (
            <div
              key={t.tier}
              className="rounded-lg border border-[var(--border)] p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]"
                  style={{
                    color: TIER_META[t.tier].color,
                    backgroundColor: TIER_META[t.tier].soft,
                  }}
                >
                  {TIER_META[t.tier].label}
                </span>
                <span className="text-[13px] font-medium">Kepaduan</span>
                {badge(t.status, t.cohesion)}
              </div>

              {t.outlier ? (
                <>
                  <p className="mt-1.5 text-[12px] leading-relaxed">
                    <strong className="font-medium">{t.outlier.name}</strong>{" "}
                    berdiri sendirian ({fmtPct(t.outlier.sim * 100)} dekat ke
                    sisanya). Kalau itu memang disengaja, biarkan — kalau tidak,
                    satu bahan di bawah bisa menyambungkannya.
                  </p>
                  <SuggestionList suggestions={t.suggestions} onAdd={onAdd} />
                </>
              ) : (
                <p className="mt-1.5 text-[12px] text-[var(--text-subtle)]">
                  Tidak ada bahan yang menyendiri. Tier ini terbaca sebagai satu
                  accord.
                </p>
              )}
            </div>
          ))}
        </section>
      )}

      <p className="text-[11px] leading-relaxed text-[var(--text-subtle)]">
        Satu celah, satu bridger. Mulai dosis kecil, naikkan sampai sambungannya
        halus — bukan sampai bridger-nya kecium sendiri. Dan tidak semua celah
        perlu ditambal: yang tidak mengganggu hidungmu, biarkan.
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
  onlyStock = false,
  onOnlyStockChange,
}: {
  analysis: Analysis;
  context: FormulaContext;
  onWarningAction?: (w: Warning) => void;
  onAddBridge?: (materialId: string, tier: Tier, dose: number) => void;
  onApplySolvent?: (solventId: string, newDirectPct: number) => void;
  /** saran bridger/diffuser/fixative hanya dari bahan yang ada di stok */
  onlyStock?: boolean;
  /** tanpa ini filternya tidak ditampilkan — halaman baca tidak punya saran */
  onOnlyStockChange?: (value: boolean) => void;
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
        {/*
          Delapan tab tidak muat satu baris di kolom analisa. TabsList bawaan
          mengunci tingginya di h-8, jadi baris kedua jatuh ke luar kotak dan
          menimpa isi panel. Tingginya dibuat mengikuti isi, dan tiap tab
          berhenti saling merebut lebar supaya pembungkusnya rapi.
        */}
        <TabsList className="h-auto! w-full flex-wrap justify-start gap-0.5 [&>button]:h-7! [&>button]:flex-none [&>button]:px-2">
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
          <TabsTrigger value="fixative">Fixative</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "ringkasan" && (
        <div className="space-y-3">
          <SplCard spl={analysis.spl} />
          {/* Empat angka yang dulu jadi kotak besar, sekarang satu baris:
              tetap terlihat sekilas, tanpa merebut tempat dari SPL. */}
          <p className="numeric text-[12px] text-[var(--text-muted)]">
            {materialCount} bahan · aktif {fmtPct(activePct)} · HPP{" "}
            {fmtIdr(analysis.cost.perGram)}/g
            {dominantFacet && ` · dominan ${facetLabel(dominantFacet.facet)}`}
          </p>
          <WarningList warnings={analysis.warnings} onAction={onWarningAction} />
        </div>
      )}

      {tab === "aroma" && <AromaTab analysis={analysis} onAdd={onAddBridge} />}
      {tab === "kekuatan" && <StrengthTab analysis={analysis} />}
      {tab === "fungsi" && <FunctionTab analysis={analysis} />}
      {tab === "pelarut" && (
        <SolventTab analysis={analysis} onApply={onApplySolvent} />
      )}
      {tab === "hpp" && (
        <CostTab analysis={analysis} batchG={context.version.batchG} />
      )}
      {/*
        Satu filter untuk tiga tab saran, bukan tiga filter terpisah: pertanyaan
        "bisa dicoba malam ini juga?" sama untuk bridger, diffuser, dan
        fixative, dan pilihannya ikut terbawa saat berpindah tab.
      */}
      {onOnlyStockChange &&
        (tab === "aroma" ||
          tab === "bridger" ||
          tab === "diffuser" ||
          tab === "fixative") && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-pressed={onlyStock}
              onClick={() => onOnlyStockChange(!onlyStock)}
              className={cn(
                "rounded-md border px-2 py-1 text-[12px] font-medium",
                onlyStock
                  ? "border-[var(--cta)] bg-[var(--cta)] text-white"
                  : "border-[var(--border-strong)] text-[var(--text-muted)]",
              )}
            >
              ★ Hanya dari stok saya
            </button>
            {onlyStock && (
              <span className="text-[11px] leading-snug text-[var(--text-subtle)]">
                {context.stock.size === 0
                  ? "Belum ada bahan yang ditandai punya — tandai dulu di halaman Stok."
                  : `${context.stock.size} bahan bertanda ★. Kalau sarannya kosong, stokmu belum punya yang cocok.`}
              </span>
            )}
          </div>
        )}
      {tab === "bridger" && (
        <BridgeTab analysis={analysis} onAdd={onAddBridge} />
      )}
      {tab === "diffuser" && (
        <RoleTab
          reports={analysis.diffusers}
          pyramid={context.version.pyramid != null}
          onAdd={onAddBridge}
        />
      )}
      {tab === "fixative" && (
        // Fixative selalu ke Base, jadi memilih tier sasaran tidak bermakna.
        <RoleTab
          reports={{ all: analysis.fixatives }}
          pyramid={false}
          onAdd={onAddBridge}
        />
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
 * Saran bahan untuk satu peran: Diffuser atau Fixative.
 *
 * Panelnya dipisah dari Bridger walau tampilannya mirip, karena pertanyaannya
 * berbeda. Bridger mencari bahan yang duduk di ANTARA dua sisi yang tidak
 * nyambung. Dua panel ini mencari yang searah dengan formula secara keseluruhan
 * — yang satu membawanya keluar lebih jauh, yang satu menahannya lebih lama.
 *
 * Satu komponen untuk keduanya: isinya identik kecuali kalimatnya, dan dua
 * salinan yang mirip pasti menyimpang pelan-pelan.
 */
const ROLE_COPY = {
  diffuser: {
    title: "Porsi diffuser",
    empty:
      "Belum ada bahan berperan diffuser. Formulanya bisa terdengar dekat di kulit walau bahannya kuat.",
    footer:
      "Diffuser menaikkan jangkauan, bukan ketahanan — yang menahan drydown ada di Fixative.",
  },
  fixative: {
    title: "Porsi fixative",
    empty:
      "Belum ada bahan berperan fixative. Tidak ada yang menahan bahan ringan, jadi drydown-nya akan sependek bahan paling cepat menguap.",
    footer:
      "Fixative memperpanjang drydown, bukan jangkauan — yang membawa keluar ada di Diffuser. Sarannya diarahkan ke Base, karena yang menahan harus berada di lapisan paling lambat menguap.",
  },
} as const;

function RoleTab({
  reports,
  pyramid,
  onAdd,
}: {
  /** `all` wajib; tier diisi analyze() hanya saat mode piramida aktif */
  reports: Partial<Record<Tier, RoleReport>> & { all: RoleReport };
  /** tampilkan pemilih sasaran per tier */
  pyramid: boolean;
  onAdd?: (materialId: string, tier: Tier, dose: number) => void;
}) {
  const [scope, setScope] = useState<Tier>("all");
  const report = reports[scope] ?? reports.all;
  const { role, sharePct, present, suggestions } = report;
  const copy = ROLE_COPY[role];

  return (
    <div className="space-y-3">
      {/*
        Diffuser tidak netral: Ambroxan mengangkat kayu, Hedione mengangkat
        floral. Jadi pertanyaannya "mau ngangkat apa", bukan "biar nyebar" —
        dan pilihan ini yang menjawabnya.
      */}
      {pyramid && (
        <div className="space-y-1">
          <p className="text-[11px] text-[var(--text-subtle)]">Mau ngangkat</p>
          <Tabs value={scope} onValueChange={(v) => setScope(v as Tier)}>
            <TabsList className="w-full">
              <TabsTrigger value="all">Semua</TabsTrigger>
              {PYRAMID_TIERS.map((t) => (
                <TabsTrigger key={t} value={t}>
                  {TIER_META[t].label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      )}

      <div className="rounded-lg border border-[var(--border)] p-3">
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-medium">{copy.title}</span>
          <span className="numeric ml-auto text-[15px] font-semibold">
            {fmtPct(sharePct)}
          </span>
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-subtle)]">
          {present.length ? `Dari ${present.join(" · ")}.` : copy.empty}
        </p>
      </div>

      {suggestions.length > 0 ? (
        <ul className="space-y-1.5">
          {suggestions.map((s) => (
            <li
              key={s.materialId}
              className="flex items-start gap-2 rounded border border-[var(--border)] px-2 py-1.5"
            >
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-[13px] font-medium">
                  {s.name}
                  {s.inStock && <span className="ml-1 text-[var(--warn)]">★</span>}
                </p>

                {/*
                  Angka sebelum → sesudah cuma sumbangan bau bahan ini sendiri.
                  Sinergi tidak punya data terukur, jadi tidak dikarang — dan
                  itu disebut di catatan bawah, bukan disembunyikan.
                */}
                {s.preview ? (
                  <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
                    di {fmtPct(s.starterDose)}:{" "}
                    <span
                      className="font-medium"
                      style={{
                        color: `color-mix(in oklab, ${facetColor(s.preview.facet)} 78%, var(--text))`,
                      }}
                    >
                      {facetLabel(s.preview.facet)}
                    </span>{" "}
                    <span className="numeric">
                      {fmtPct(s.preview.beforePct)} → {fmtPct(s.preview.afterPct)}
                    </span>
                  </p>
                ) : (
                  <p className="text-[11px] text-[var(--text-subtle)]">
                    {s.reason}
                  </p>
                )}

                <p className="text-[11px] leading-relaxed text-[var(--text-subtle)]">
                  {s.lifts.length > 0
                    ? `searah dengan ${s.lifts.map((l) => l.name).join(" · ")}`
                    : "tidak searah kuat dengan satu bahan pun — mengangkat arah keseluruhannya"}
                </p>

                {scope !== "all" && s.tier !== scope && (
                  <p className="text-[11px] leading-relaxed text-[var(--text-subtle)]">
                    Tetap masuk {TIER_META[s.tier].label} — itu kecepatan
                    menguapnya, dan memindahkannya tidak membuatnya menguap
                    bareng {TIER_META[scope].label}.
                  </p>
                )}
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
          facet — sarannya dicari dari arah aroma yang sudah terbentuk.
        </p>
      )}

      {/* Beberapa bahan yang paling dikenal untuk peran ini justru ditaruh
          supplier di kategori lain, jadi mereka tidak akan muncul sampai
          kategorinya dikoreksi. Tanpa catatan ini panelnya terlihat seperti
          melewatkan bahan yang jelas-jelas ada di master. */}
      <p className="text-[11px] leading-relaxed text-[var(--text-subtle)]">
        Yang disarankan cuma bahan yang kategorinya benar-benar data supplier,
        bukan tebakan. {copy.footer}{" "}
        <strong className="font-medium">
          Kategorinya ikut pricelist supplier
        </strong>{" "}
        — koreksi di halaman detail bahan kalau menurutmu sebuah bahan berperan
        lain.
      </p>

      {suggestions.some((s) => s.preview) && (
        <p className="text-[11px] leading-relaxed text-[var(--text-subtle)]">
          Angka sebelum → sesudah adalah porsi facet itu di seluruh formula,
          dari bau bahannya sendiri. Sinergi — dua bahan barengan terasa lebih
          hidup dari jumlahnya — nyata tapi tidak punya data terukur, jadi
          hidungmu yang menilai sisanya.
        </p>
      )}
    </div>
  );
}
