import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { ImpactOverrideForm } from "@/components/materials/ImpactOverrideForm";
import { ImpactBadge } from "@/components/shared/ImpactBadge";
import { Card, CardTitle, PageHeader } from "@/components/shared/primitives";
import { fmtGram, fmtIdr, fmtNum } from "@/lib/calc/format";
import { cheapestTier, pricePerGram } from "@/lib/legacy/calc/pricing";
import { FUNCTION_CATEGORIES } from "@/lib/constants";
import { getMaterial, materialUsage } from "@/lib/data/materials";

export const dynamic = "force-dynamic";

export default async function MaterialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const material = await getMaterial(id);
  if (!material) notFound();

  const usage = await materialUsage(id);
  const cheapest = cheapestTier(material.allPrices);
  const fnInfo = FUNCTION_CATEGORIES.find(
    (f) => f.value === material.function_category,
  );

  return (
    <>
      <PageHeader
        title={material.name}
        subtitle={
          [material.synonym, material.cas_number ? `CAS ${material.cas_number}` : null]
            .filter(Boolean)
            .join(" · ") || undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardTitle>Data bahan</CardTitle>
            <dl className="grid grid-cols-[130px_1fr] gap-y-2.5 text-sm">
              <dt className="text-[var(--text-muted)]">Family</dt>
              <dd>{material.family ?? "—"}</dd>
              <dt className="text-[var(--text-muted)]">Kategori</dt>
              <dd>{material.category ?? "—"}</dd>
              <dt className="text-[var(--text-muted)]">Kategori fungsi</dt>
              <dd>
                {fnInfo ? (
                  <>
                    {fnInfo.label}
                    <span className="ml-1.5 text-[12px] text-[var(--text-subtle)]">
                      impact {fnInfo.range} &middot; {fnInfo.meaning}
                    </span>
                  </>
                ) : (
                  "—"
                )}
              </dd>
              <dt className="text-[var(--text-muted)]">Impact dipakai</dt>
              <dd>
                <ImpactBadge
                  value={material.effectiveImpact}
                  supplierValue={material.odor_impact}
                  overrideNote={material.odor_impact_note}
                />
              </dd>
              <dt className="text-[var(--text-muted)]">Odour profile</dt>
              <dd>{material.odour_profile ?? "—"}</dd>
              <dt className="text-[var(--text-muted)]">Dilusi biasa</dt>
              <dd>
                {fmtNum(material.default_dilution_pct)}%
                {material.default_solvent ? ` in ${material.default_solvent}` : ""}
              </dd>
              <dt className="text-[var(--text-muted)]">Supplier</dt>
              <dd>{material.supplier ?? "—"}</dd>
              <dt className="text-[var(--text-muted)]">Sumber baris</dt>
              <dd className="text-[13px] text-[var(--text-muted)]">
                {material.owner_id == null
                  ? "master global (hasil import pricelist)"
                  : "bahan tambahan milik kamu"}
              </dd>
              {material.tgsc_url && (
                <>
                  <dt className="text-[var(--text-muted)]">TGSC</dt>
                  <dd>
                    <a
                      href={material.tgsc_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-[var(--brand)] hover:underline"
                    >
                      Buka referensi
                      <ExternalLink className="size-3.5" />
                    </a>
                  </dd>
                </>
              )}
            </dl>

            {material.personal_note && (
              <div className="mt-4 rounded-lg bg-[var(--surface-muted)] p-3">
                <p className="text-[12px] font-medium text-[var(--text-muted)]">
                  Catatan pribadi
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">
                  {material.personal_note}
                </p>
              </div>
            )}
          </Card>

          <Card>
            <CardTitle hint="Angka supplier bucketed — 94 bahan bernilai persis 100, dan semua Bridger 100 tanpa kecuali. Kalau hidungmu bilang lain, angka hidungmu yang dipakai.">
              Koreksi nilai impact
            </CardTitle>
            <ImpactOverrideForm
              materialId={material.id}
              supplierValue={material.odor_impact}
              override={material.odor_impact_override}
              note={material.odor_impact_note}
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardTitle
              hint={
                material.priceTierG
                  ? `Kalkulasi biaya memakai tier ${material.priceTierG} g.`
                  : undefined
              }
            >
              Harga per tier
            </CardTitle>

            {material.allPrices.length === 0 ? (
              <p className="text-[13px] text-[var(--text-muted)]">
                Belum ada data harga. Biaya formula yang memakai bahan ini akan
                ditandai belum lengkap — bukan dianggap nol.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.04em] text-[var(--text-muted)]">
                      <th className="py-2 text-left font-medium">Tier</th>
                      <th className="py-2 text-right font-medium">Harga</th>
                      <th className="py-2 text-right font-medium">Per gram</th>
                      <th className="py-2 text-right font-medium">Berlaku</th>
                    </tr>
                  </thead>
                  <tbody>
                    {material.allPrices.map((price) => {
                      const isCheapest =
                        cheapest != null &&
                        Number(price.tier_size) ===
                          Number(cheapest.tier_size) &&
                        price.effective_date === cheapest.effective_date;
                      return (
                        <tr
                          key={price.id}
                          className="border-b border-[var(--border)] last:border-0"
                        >
                          <td className="py-2">
                            {fmtNum(price.tier_size)} g
                            {isCheapest && (
                              <span className="ml-2 rounded bg-[var(--ok-soft)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--ok)]">
                                termurah/g
                              </span>
                            )}
                          </td>
                          <td className="numeric py-2">
                            {fmtIdr(price.price_idr)}
                          </td>
                          <td className="numeric py-2 font-medium">
                            {fmtIdr(pricePerGram(price))}
                          </td>
                          <td className="numeric py-2 text-[12px] text-[var(--text-subtle)]">
                            {price.effective_date}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <CardTitle hint="Berguna untuk melihat kebiasaan sendiri — dosis berapa yang biasanya kamu pakai.">
              Dipakai di formula mana saja
            </CardTitle>

            {usage.length === 0 ? (
              <p className="text-[13px] text-[var(--text-muted)]">
                Belum pernah dipakai di formula.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {usage.map((u, i) => (
                  <li
                    key={`${u.versionId}-${i}`}
                    className="flex items-center justify-between gap-3 py-2 first:pt-0"
                  >
                    <Link
                      href={`/formulas/${u.formulaId}?v=${u.versionId}`}
                      className="min-w-0 flex-1 truncate text-[13px] font-medium hover:text-[var(--brand)]"
                    >
                      {u.formulaName} &middot; v{u.versionNo}
                      {u.isArchived && (
                        <span className="ml-1.5 text-[11px] text-[var(--text-subtle)]">
                          (arsip)
                        </span>
                      )}
                    </Link>
                    <span className="numeric shrink-0 text-[13px] text-[var(--text-muted)]">
                      {fmtGram(u.weightG)} g
                      {u.dilutionPct < 100 && (
                        <span className="text-[var(--text-subtle)]">
                          {" "}
                          @ {fmtNum(u.dilutionPct)}%
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
