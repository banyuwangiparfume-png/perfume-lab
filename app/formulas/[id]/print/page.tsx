import { notFound } from "next/navigation";
import { LabeledDonut } from "@/components/analysis/LabeledDonut";
import { PrintToolbar } from "@/components/formula/PrintToolbar";
import type { BridgeStatus } from "@/lib/calc/bridge";
import { facetDrilldown } from "@/lib/calc/drilldown";
import { fmtGram, fmtIdr, fmtNum, fmtPct } from "@/lib/calc/format";
import { PHASE_META } from "@/lib/calc/phases";
import { OTHER_SUBNOTE, subnoteLabel } from "@/lib/calc/subnotes";
import type { Tier } from "@/lib/calc/types";
import { getFormula, pickVersion } from "@/lib/data/formulas";
import { loadMaterialMeta } from "@/lib/data/loadEditorData";
import { getVersionDetail } from "@/lib/data/versions";
import { PYRAMID_TIERS, TIER_META, facetColor, facetLabel } from "@/lib/tiers";

export const dynamic = "force-dynamic";

/**
 * Laporan formula untuk dicetak / disimpan sebagai PDF.
 *
 * Semua yang ada di tab analisa dibuka sekaligus — Ringkasan, Aroma (beserta
 * isi tiap irisan), Kepaduan, Kekuatan per fase, dan HPP — karena kertas
 * tidak bisa diklik. Angkanya dari analyze() yang sama dengan panel; tidak
 * ada hitungan kedua. Donatnya komponen yang sama dengan panel, jadi
 * gambarnya sama persis.
 */
export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ v?: string; hpp?: string }>;
}) {
  const [{ id }, { v, hpp }] = await Promise.all([params, searchParams]);
  const formula = await getFormula(id);
  if (!formula) notFound();
  const version = pickVersion(formula.versions, v);
  if (!version) notFound();

  const [detail, meta] = await Promise.all([
    getVersionDetail(version.id),
    loadMaterialMeta(),
  ]);
  if (!detail) notFound();
  const { analysis: a, context: ctx } = detail;
  const withCost = hpp !== "0";
  const pyramid = ctx.version.pyramid;
  const versionLabel = version.version_no === 0 ? "draf kerja" : `v${version.version_no}`;

  const textOf = (refId: string) => {
    const m = ctx.materials.get(refId);
    const x = meta.get(refId);
    return [m?.name ?? "", x?.synonym ?? "", x?.odourProfile ?? ""].join(" | ");
  };
  const drills = a.aroma.all.slices.map((s) =>
    facetDrilldown(a.items, ctx.materials, s.facet, textOf),
  );
  const sliceList = (pie: (typeof a.aroma)["all"]) => [
    ...pie.slices.map((s) => ({
      key: s.facet,
      label: facetLabel(s.facet),
      value: s.pct,
      color: facetColor(s.facet),
    })),
    ...(pie.other > 0.05
      ? [{ key: "__other", label: "Lainnya", value: pie.other, color: "var(--facet-other)" }]
      : []),
  ];
  const mixed = (facet: string) =>
    `color-mix(in oklab, ${facetColor(facet)} 78%, var(--text))`;

  return (
    <div className="print-color mx-auto max-w-[860px] space-y-6 text-[13px] leading-relaxed">
      <PrintToolbar backHref={`/formulas/${id}?v=${version.id}`} />

      {/* ---------------------------------------------------------- judul */}
      <div className="border-b-2 border-[var(--text)] pb-3">
        <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
          Perfumer&apos;s Notebook · Laporan formula
        </p>
        <h1 className="text-[26px] font-semibold leading-tight">{formula.name}</h1>
        <p className="text-[13px] text-[var(--text-muted)]">
          {formula.category === "accord" ? "Accord" : "Fragrance"} · {versionLabel}
          {version.change_note ? ` — ${version.change_note}` : ""} · batch{" "}
          {fmtGram(ctx.version.batchG)} g
          {pyramid &&
            ` · piramida ${fmtNum(pyramid.top)}/${fmtNum(pyramid.mid)}/${fmtNum(pyramid.base)}`}{" "}
          · dicetak {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* ------------------------------------------------------ komposisi */}
      <Section title="Komposisi">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-[var(--border-strong)] text-left text-[10px] uppercase tracking-[0.04em] text-[var(--text-muted)]">
              <th className="py-1 pr-2">#</th>
              {pyramid && <th className="py-1 pr-2">Tier</th>}
              <th className="py-1 pr-2">Bahan</th>
              <th className="py-1 pr-2 text-right">%</th>
              <th className="py-1 pr-2 text-right">Gram</th>
              <th className="py-1 pr-2">Dilusi</th>
              <th className="py-1 pr-2 text-right">Murni g</th>
              <th className="py-1 pr-2 text-right">Impact</th>
              <th className="py-1 text-right">Kekuatan</th>
            </tr>
          </thead>
          <tbody>
            {a.lines.rows.map((r) => (
              <FragmentRows key={r.lineId}>
                <tr className="border-b border-[var(--border)]">
                  <td className="py-1 pr-2 text-[var(--text-subtle)]">{r.no}</td>
                  {pyramid && (
                    <td className="py-1 pr-2" style={{ color: TIER_META[r.tier].color }}>
                      {r.tier !== "all" ? TIER_META[r.tier].label : ""}
                    </td>
                  )}
                  <td className="py-1 pr-2 font-medium">
                    {r.name}
                    {r.kind === "accord" && <span className="ml-1 text-[10px] text-[var(--brand)]">ACCORD</span>}
                    {r.kind === "fo" && <span className="ml-1 text-[10px] text-[#8a6d2f]">FO</span>}
                  </td>
                  <td className="numeric py-1 pr-2 text-right">{fmtPct(r.pct)}</td>
                  <td className="numeric py-1 pr-2 text-right">
                    {fmtGram((r.pct / 100) * ctx.version.batchG)}
                  </td>
                  <td className="py-1 pr-2 text-[11px] text-[var(--text-muted)]">
                    {r.userDilutionPct < 100
                      ? `${fmtNum(r.userDilutionPct)}% ${r.userSolventName ?? ""}`
                      : r.supplierDilutionPct
                        ? `bawaan ${fmtNum(r.supplierDilutionPct)}%`
                        : "neat"}
                  </td>
                  <td className="numeric py-1 pr-2 text-right">
                    {fmtGram((r.activePct / 100) * ctx.version.batchG)}
                  </td>
                  <td className="numeric py-1 pr-2 text-right">
                    {r.impact == null ? "—" : Math.round(r.impact)}
                  </td>
                  <td className="numeric py-1 text-right">
                    {r.strengthPct == null ? "—" : fmtPct(r.strengthPct)}
                  </td>
                </tr>
                {r.sub.map((sub) => (
                  <tr key={`${r.lineId}-${sub.refId}`} className="border-b border-[var(--border)] text-[11px] text-[var(--text-muted)]">
                    <td />
                    {pyramid && <td />}
                    <td className="py-0.5 pl-4 pr-2">↳ {sub.name}</td>
                    <td className="numeric py-0.5 pr-2 text-right">{fmtPct(sub.productPct)}</td>
                    <td className="numeric py-0.5 pr-2 text-right">
                      {fmtGram((sub.productPct / 100) * ctx.version.batchG)}
                    </td>
                    <td />
                    <td className="numeric py-0.5 pr-2 text-right">
                      {fmtGram((sub.activePct / 100) * ctx.version.batchG)}
                    </td>
                    <td className="numeric py-0.5 pr-2 text-right">{sub.impact ?? "—"}</td>
                    <td />
                  </tr>
                ))}
              </FragmentRows>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td colSpan={pyramid ? 3 : 2} className="py-1">Total</td>
              <td className="numeric py-1 pr-2 text-right">{fmtPct(a.lines.total.pct)}</td>
              <td className="numeric py-1 pr-2 text-right">
                {fmtGram((a.lines.total.pct / 100) * ctx.version.batchG)}
              </td>
              <td />
              <td className="numeric py-1 pr-2 text-right">
                {fmtGram((a.lines.total.activePct / 100) * ctx.version.batchG)}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </Section>

      {/* ------------------------------------------------------ ringkasan */}
      <Section title="Ringkasan" breakBefore>
        <div className="grid grid-cols-3 gap-3">
          {(["sillage", "projection", "longevity"] as const).map((k) => (
            <div key={k} className="rounded-lg border border-[var(--border)] p-3">
              <p className="numeric text-[24px] font-semibold leading-none">
                {a.spl[k].toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                <span className="text-[12px] font-normal text-[var(--text-subtle)]">/10</span>
              </p>
              <div className="mt-1.5 h-1.5 rounded-full bg-[var(--surface-muted)]">
                <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${a.spl[k] * 10}%` }} />
              </div>
              <p className="mt-1 text-[12px] font-medium capitalize">{k}</p>
            </div>
          ))}
        </div>
        <table className="w-full text-[12px]">
          <tbody>
            {a.spl.factors.map((f) => (
              <tr key={f.key} className="border-b border-[var(--border)]">
                <td className="py-1 pr-2 font-medium">{f.label}</td>
                <td className="numeric py-1 pr-2 text-right">
                  {f.unit === "%" ? fmtPct(f.value) : Math.round(f.value)} / {f.unit === "%" ? fmtPct(f.fullAt) : f.fullAt}
                </td>
                <td className="py-1 text-[11px] text-[var(--text-muted)]">{f.meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Note>
          SPL adalah perkiraan dari susunan formula, bukan pengukuran — konsentrasi
          di botol, kulit, dan cuaca tidak ikut dihitung.
          {a.spl.notes.length > 0 && ` ${a.spl.notes.join(" ")}`}
        </Note>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <SubTitle>Komposisi bahan</SubTitle>
            <p>
              {a.strength.rows.filter((r) => r.kind === "material" && !r.isSolvent).length} bahan
              (dibentangkan) · aktif{" "}
              {fmtPct(a.realPyramid.reduce((s, r) => s + r.active, 0))}
              {pyramid && (
                <>
                  <br />
                  {a.realPyramid
                    .filter((r) => r.tier !== "all")
                    .map((r) => `${TIER_META[r.tier].label} ${fmtPct(r.filled)} (aktif ${fmtPct(r.active)})`)
                    .join(" · ")}
                </>
              )}
            </p>
          </div>
          <div>
            <SubTitle>Pelarut</SubTitle>
            {a.solvents.rows.length === 0 ? (
              <p className="text-[var(--text-muted)]">Tidak ada pelarut.</p>
            ) : (
              <p>
                Total {fmtPct(a.solvents.totalEffectivePct)}
                <br />
                {a.solvents.rows.map((r) => `${r.name} ${fmtPct(r.effectiveTotal)}`).join(" · ")}
              </p>
            )}
          </div>
        </div>

        <div>
          <SubTitle>Peringatan</SubTitle>
          {a.warnings.length === 0 ? (
            <p className="text-[var(--text-muted)]">Tidak ada peringatan.</p>
          ) : (
            <ul className="space-y-1">
              {a.warnings.map((w, i) => (
                <li key={i} className="flex gap-2 text-[12px]">
                  <span
                    className="w-14 shrink-0 font-semibold"
                    style={{
                      color:
                        w.level === "critical" ? "var(--danger)" : w.level === "warning" ? "var(--warn)" : "var(--info)",
                    }}
                  >
                    {w.code}
                  </span>
                  <span>{w.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      {/* ---------------------------------------------------------- aroma */}
      <Section title="Aroma" breakBefore>
        <div className="mx-auto max-w-[520px]">
          <LabeledDonut
            slices={sliceList(a.aroma.all)}
            center={a.aroma.all.slices[0] ? { label: facetLabel(a.aroma.all.slices[0].facet), value: fmtPct(a.aroma.all.slices[0].pct) } : null}
          />
        </div>
        <ul className="space-y-1.5">
          {a.aroma.all.slices.map((s) => (
            <li key={s.facet}>
              <span className="font-semibold" style={{ color: mixed(s.facet) }}>
                {facetLabel(s.facet)} {fmtPct(s.pct)}
              </span>
              {s.leaning.length > 0 && (
                <span className="text-[12px] text-[var(--text-muted)]">
                  {" "}
                  — condong ke {s.leaning.map((l) => `${facetLabel(l.facet)} ${fmtPct(l.pct)}`).join(", ")}
                </span>
              )}
              <p className="text-[11px] text-[var(--text-subtle)]">
                {s.contributors.slice(0, 6).map((c) => `${c.name} ${fmtPct(c.pct)}`).join(" · ")}
                {s.contributors.length > 6 && ` · +${s.contributors.length - 6} lagi`}
              </p>
            </li>
          ))}
        </ul>
        {(a.aroma.all.excludedPct > 0.05 || a.aroma.all.missingFacets.length > 0) && (
          <Note>
            {fmtPct(a.aroma.all.excludedPct)} formula tidak ikut dihitung di pie
            {a.aroma.all.missingFacets.length > 0 && ` — ${a.aroma.all.missingFacets.join(", ")} belum punya data facet`}.
          </Note>
        )}

        {pyramid && (
          <>
            <SubTitle>Per tier</SubTitle>
            <div className="grid grid-cols-2 gap-4">
              {PYRAMID_TIERS.map((t) =>
                a.aroma[t].slices.length ? (
                  <div key={t} className="break-inside-avoid">
                    <p className="text-[12px] font-semibold" style={{ color: TIER_META[t].color }}>
                      {TIER_META[t].label}
                    </p>
                    <LabeledDonut
                      slices={sliceList(a.aroma[t])}
                      center={{ label: facetLabel(a.aroma[t].slices[0].facet), value: fmtPct(a.aroma[t].slices[0].pct) }}
                    />
                  </div>
                ) : null,
              )}
            </div>
          </>
        )}
      </Section>

      {/* ------------------------------------------------ isi tiap irisan */}
      <Section title="Isi tiap aroma" breakBefore>
        <div className="grid grid-cols-2 gap-x-6 gap-y-5">
          {drills.map((d) => {
            const name = facetLabel(d.facet);
            const base = facetColor(d.facet);
            const groups = d.groups.map((g, i) => ({
              ...g,
              label: d.bySubnote ? subnoteLabel(d.facet, g.key, name) : (ctx.materials.get(g.key)?.name ?? g.key),
              color: g.key === OTHER_SUBNOTE ? "var(--facet-other)" : `color-mix(in oklab, ${base} ${Math.max(35, 100 - i * 13)}%, white)`,
            }));
            const big = groups.filter((g) => g.pct >= 3);
            const small = groups.filter((g) => g.pct < 3);
            const rest = small.reduce((s, g) => s + g.pct, 0);
            return (
              <div key={d.facet} className="break-inside-avoid">
                <p className="font-semibold" style={{ color: mixed(d.facet) }}>
                  {name} {fmtPct(d.slicePct)}
                </p>
                <LabeledDonut
                  slices={[
                    ...big.map((g) => ({ key: g.key, label: g.label, value: g.pct, color: g.color })),
                    ...(small.length === 1
                      ? small.map((g) => ({ key: g.key, label: g.label, value: g.pct, color: g.color }))
                      : rest > 0
                        ? [{ key: "__other", label: `${small.length} lainnya`, value: rest, color: "var(--facet-other)" }]
                        : []),
                  ]}
                  center={{ label: name, value: fmtPct(d.slicePct) }}
                />
                <ul className="mt-1 space-y-0.5 text-[11px]">
                  {groups.map((g) => (
                    <li key={g.key}>
                      <span className="font-medium">{g.label} {fmtPct(g.pct)}</span>
                      {d.bySubnote && (
                        <span className="text-[var(--text-subtle)]">
                          {" "}— {g.materials.map((m) => `${m.name} ${fmtPct(m.pct)}`).join(" · ")}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        <Note>
          Persen di bagian ini adalah porsi dari irisannya sendiri. Sub-aroma
          dikelompokkan dari nama bahan dan odour profile supplier.
        </Note>
      </Section>

      {/* ------------------------------------------------------- kepaduan */}
      <Section title="Kepaduan" breakBefore>
        {pyramid ? (
          <div className="grid grid-cols-2 gap-6">
            <div>
              <SubTitle>Antar tier</SubTitle>
              {(["top", "mid", "base"] as const).map((t, i) => {
                const pair =
                  i === 0
                    ? a.bridges.crossTier.find((p) => p.pair[0] === "top" && p.pair[1] === "mid")
                    : i === 1
                      ? a.bridges.crossTier.find((p) => p.pair[0] === "mid" && p.pair[1] === "base")
                      : null;
                return (
                  <div key={t}>
                    <Band tier={t}>{TIER_META[t].label}</Band>
                    {pair && (
                      <p className="py-1 text-center text-[12px]">
                        {TIER_META[pair.pair[0]].label} ↕ {TIER_META[pair.pair[1]].label}:{" "}
                        {pair.comparable ? <Status status={pair.status} score={pair.sim} /> : "belum bisa dinilai"}
                      </p>
                    )}
                  </div>
                );
              })}
              {(() => {
                const tb = a.bridges.crossTier.find((p) => p.pair[0] === "top" && p.pair[1] === "base");
                return tb ? (
                  <p className="pt-2 text-center text-[12px]">
                    Top ↕ Base: {tb.comparable ? <Status status={tb.status} score={tb.sim} /> : "belum bisa dinilai"}
                  </p>
                ) : null;
              })()}
            </div>
            <div>
              <SubTitle>Dalam tier</SubTitle>
              {(["top", "mid", "base"] as const).map((t) => {
                const c = a.bridges.withinTier.find((x) => x.tier === t);
                return (
                  <div key={t} className="pb-1">
                    <Band tier={t}>
                      {TIER_META[t].label}
                      {c && ` ${fmtPct(c.cohesion * 100)}`}
                    </Band>
                    <p className="py-0.5 text-center text-[12px]">
                      {c ? <Status status={c.status} score={c.cohesion} /> : "butuh minimal 2 bahan berfacet"}
                      {c?.outlier && ` · menyendiri: ${c.outlier.name}`}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p>
            {a.bridges.withinTier.map((c) => (
              <span key={c.tier}>
                Kepaduan seluruh bahan: <Status status={c.status} score={c.cohesion} />
              </span>
            ))}
          </p>
        )}
        <Note>
          Antar tier: seberapa nyambung transisi saat satu lapis memudar ke lapis
          berikutnya. Dalam tier: seberapa menyatu isi satu lapis sebagai satu
          accord — kontras bukan cacat.
        </Note>
      </Section>

      {/* ------------------------------------------------------- kekuatan */}
      <Section title="Kekuatan per fase" breakBefore>
        <div className="space-y-3">
          {a.phases.phases.map((p) => (
            <div key={p.key} className="break-inside-avoid rounded-lg border border-[var(--border)] p-3">
              <p>
                <span className="font-semibold">{PHASE_META[p.key].label}</span>{" "}
                <span className="text-[11px] text-[var(--text-subtle)]">{PHASE_META[p.key].when}</span>
              </p>
              <div className="my-1.5 flex h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                {PYRAMID_TIERS.map((t) => (
                  <div
                    key={t}
                    style={{ width: `${p.tiers[t as "top" | "mid" | "base"]}%`, backgroundColor: TIER_META[t].color }}
                  />
                ))}
              </div>
              <p className="text-[12px]">
                {PYRAMID_TIERS.map((t) => `${TIER_META[t].label} ${fmtPct(p.tiers[t as "top" | "mid" | "base"])}`).join(" · ")}
                {p.facets.length > 0 && (
                  <>
                    {" · tercium "}
                    {p.facets.map((f, i) => (
                      <span key={f.facet}>
                        {i > 0 && ", "}
                        <span className="font-medium" style={{ color: mixed(f.facet) }}>
                          {facetLabel(f.facet)}
                        </span>
                      </span>
                    ))}
                  </>
                )}
              </p>
              <p className="text-[11px] text-[var(--text-muted)]">
                {p.rows.slice(0, 6).map((r) => `${r.name} ${fmtPct(r.pct)}`).join(" · ")}
                {p.rows.length > 6 && ` · +${p.rows.length - 6} bahan lain`}
              </p>
              {p.notes.map((n) => (
                <p key={n} className="mt-1 text-[12px] text-[var(--info)]">{n}</p>
              ))}
            </div>
          ))}
        </div>
        <Note>
          Pendekatan dari tier, bukan dari kecepatan menguap tiap molekul. Semua
          bahan sudah ada di udara sejak semprotan pertama; yang berubah cuma siapa
          yang paling keras.
        </Note>
      </Section>

      {/* ------------------------------------------------------------ HPP */}
      {withCost && (
        <Section title="HPP" breakBefore>
          <p className="text-[12px] text-[var(--text-muted)]">
            Batch {fmtGram(ctx.version.batchG)} g · harga tier {fmtNum(a.cost.tier)} g
          </p>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[var(--border-strong)] text-left text-[10px] uppercase tracking-[0.04em] text-[var(--text-muted)]">
                <th className="py-1 pr-2">Bahan</th>
                <th className="py-1 pr-2 text-right">Gram</th>
                <th className="py-1 pr-2 text-right">Harga/g</th>
                <th className="py-1 pr-2 text-right">Biaya</th>
                <th className="py-1 text-right">Porsi</th>
              </tr>
            </thead>
            <tbody>
              {a.cost.rows.map((r) => (
                <tr key={r.refId} className="border-b border-[var(--border)]">
                  <td className="py-1 pr-2">
                    {r.name}
                    {r.fallback && <span className="text-[var(--warn)]"> (harga tier {r.usedTier} g)</span>}
                  </td>
                  <td className="numeric py-1 pr-2 text-right">{fmtGram(r.grams)}</td>
                  <td className="numeric py-1 pr-2 text-right">{r.pricePerG == null ? "—" : fmtIdr(r.pricePerG)}</td>
                  <td className="numeric py-1 pr-2 text-right">{r.cost == null ? "—" : fmtIdr(r.cost)}</td>
                  <td className="numeric py-1 text-right">{fmtPct(r.sharePct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="grid grid-cols-3 gap-3">
            {[
              ["per batch", a.cost.total],
              ["per gram", a.cost.perGram],
              ["per 100 g", a.cost.per100g],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-lg border border-[var(--border)] p-3">
                <p className="numeric text-[18px] font-semibold">{fmtIdr(value as number)}</p>
                <p className="text-[11px] text-[var(--text-muted)]">{label}</p>
              </div>
            ))}
          </div>
          {a.cost.missing.length > 0 && (
            <Note>
              {a.cost.missing.length} bahan belum punya harga ({a.cost.missing.join(", ")}) —
              total di atas belum lengkap.
            </Note>
          )}
        </Section>
      )}

      <p className="border-t border-[var(--border)] pt-2 text-[11px] text-[var(--text-subtle)]">
        Semua angka di laporan ini dihitung dari susunan formula. Keputusan
        akhirnya tetap di hidungmu — di blotter, di kulit, setelah maserasi.
      </p>
    </div>
  );
}

function Section({
  title,
  breakBefore,
  children,
}: {
  title: string;
  breakBefore?: boolean;
  children: React.ReactNode;
}) {
  // Bagian panjang (Komposisi, Isi tiap aroma) boleh terpotong antar halaman;
  // judulnya tidak boleh tertinggal sendirian di dasar halaman.
  return (
    <div className={breakBefore ? "print-break space-y-3" : "space-y-3"}>
      <h2 className="break-after-avoid border-b border-[var(--border)] pb-1 text-[17px] font-semibold">
        {title}
      </h2>
      {children}
    </div>
  );
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
      {children}
    </p>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] leading-relaxed text-[var(--text-subtle)]">{children}</p>;
}

function FragmentRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

const STATUS_TEXT: Record<BridgeStatus, string> = {
  connected: "Nyambung",
  loose: "Renggang",
  gap: "Jurang",
};
const STATUS_COLOR: Record<BridgeStatus, string> = {
  connected: "var(--ok)",
  loose: "var(--warn)",
  gap: "var(--danger)",
};

function Status({ status, score }: { status: BridgeStatus; score: number }) {
  return (
    <span className="font-semibold" style={{ color: STATUS_COLOR[status] }}>
      {STATUS_TEXT[status]} {fmtPct(score * 100)}
    </span>
  );
}

const BAND_SHAPE: Record<"top" | "mid" | "base", string> = {
  top: "polygon(36% 0, 64% 0, 76% 100%, 24% 100%)",
  mid: "polygon(24% 0, 76% 0, 88% 100%, 12% 100%)",
  base: "polygon(12% 0, 88% 0, 100% 100%, 0 100%)",
};

function Band({ tier, children }: { tier: Tier & ("top" | "mid" | "base"); children: React.ReactNode }) {
  return (
    <div
      className="flex h-10 items-center justify-center text-[12px] font-semibold uppercase tracking-[0.04em]"
      style={{ clipPath: BAND_SHAPE[tier], backgroundColor: TIER_META[tier].soft, color: TIER_META[tier].color }}
    >
      {children}
    </div>
  );
}
