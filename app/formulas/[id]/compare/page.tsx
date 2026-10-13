import Link from "next/link";
import { notFound } from "next/navigation";
import { GitCompare } from "lucide-react";
import { CompareSelector } from "@/components/formula/CompareSelector";
import {
  CompareConditions,
  CompareValidity,
} from "@/components/formula/CompareValidity";
import {
  Card,
  CardTitle,
  EmptyState,
  PageHeader,
  SmellDisclaimer,
} from "@/components/shared/primitives";
import { analyze } from "@/lib/legacy/calc/analyze";
import { fmtGram, fmtPct } from "@/lib/calc/format";
import { TRANSITION_VERDICTS } from "@/lib/constants";
import {
  listEvaluationsForVersion,
  representativeEvaluation,
} from "@/lib/data/evaluations";
import { runCompareRules, type CompareSubject } from "@/lib/rules/compare";
import { getFormula } from "@/lib/data/formulas";
import { resolveVersionLines } from "@/lib/data/versions";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Satu komponen di tabel perbandingan, nilainya per versi. */
type DiffRow = {
  label: string;
  /** % murni tiap versi; null = tidak ada di versi itu */
  shares: (number | null)[];
  weights: (number | null)[];
  strengths: (number | null)[];
};

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ids?: string }>;
}) {
  const [{ id }, { ids }] = await Promise.all([params, searchParams]);

  const formula = await getFormula(id);
  if (!formula) notFound();

  const available = formula.versions
    .slice()
    .sort((a, b) => a.version_no - b.version_no);

  const requested = (ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => available.some((v) => v.id === s));

  // Default: tiga versi terbaru. Itu bentuk subtraction test yang paling
  // sering dipakai — satu dasar plus dua cabang.
  const selectedIds = requested.length
    ? requested
    : available.slice(-3).map((v) => v.id);

  const selected = available.filter((v) => selectedIds.includes(v.id));

  if (available.length < 2) {
    return (
      <>
        <PageHeader title={`Compare — ${formula.name}`} />
        <EmptyState
          icon={GitCompare}
          title="Baru ada satu versi"
          description="Duplikat versinya dulu lalu ubah satu hal. Perbandingan antar versi itulah yang menutup siklus belajar."
          action={{ href: `/formulas/${formula.id}`, label: "Kembali ke formula" }}
        />
      </>
    );
  }

  const columns = await Promise.all(
    selected.map(async (version) => {
      const lines = await resolveVersionLines(version.id);
      const [evaluations] = await Promise.all([
        listEvaluationsForVersion(version.id),
      ]);
      return { version, analysis: analyze(lines), evaluations };
    }),
  );

  // Rule 8 — apakah kedua evaluasi ini layak dibandingkan sama sekali.
  // Dijalankan SEBELUM tabel apa pun dirender, dan hasilnya ditempel di atas.
  const subjects: CompareSubject[] = columns.map((col) => ({
    label: `v${col.version.version_no}`,
    evaluation: representativeEvaluation(col.evaluations),
  }));
  const validityFindings = runCompareRules(subjects);

  // Komponen digabung berdasarkan NAMA: komponen yang sama di dua versi harus
  // tampil di satu baris walau id barisnya berbeda.
  const labels: string[] = [];
  for (const col of columns) {
    for (const row of col.analysis.display.rows) {
      if (!labels.includes(row.label)) labels.push(row.label);
    }
  }

  const rows: DiffRow[] = labels.map((label) => ({
    label,
    shares: columns.map((col) => {
      const matching = col.analysis.display.rows.filter(
        (r) => r.label === label,
      );
      return matching.length
        ? matching.reduce((a, r) => a + r.neatPct, 0)
        : null;
    }),
    weights: columns.map((col) => {
      const matching = col.analysis.display.rows.filter(
        (r) => r.label === label,
      );
      return matching.length
        ? matching.reduce((a, r) => a + r.weightG, 0)
        : null;
    }),
    strengths: columns.map((col) => {
      const matching = col.analysis.display.rows.filter(
        (r) => r.label === label && r.strengthPct != null,
      );
      return matching.length
        ? matching.reduce((a, r) => a + (r.strengthPct ?? 0), 0)
        : null;
    }),
  }));

  // Urut dari komponen yang paling besar di versi mana pun.
  rows.sort((a, b) => {
    const peak = (r: DiffRow) => Math.max(...r.shares.map((s) => s ?? 0));
    return peak(b) - peak(a);
  });

  return (
    <>
      <PageHeader
        title={`Compare — ${formula.name}`}
        subtitle="Selisih dihitung terhadap versi paling kiri. Perbandingan memakai % murni supaya versi dengan batch size berbeda tetap bisa dibandingkan."
      />

      <CompareSelector
        formulaId={formula.id}
        versions={available.map((v) => ({
          id: v.id,
          versionNo: v.version_no,
          status: v.status,
        }))}
        selected={selectedIds}
      />

      <CompareValidity findings={validityFindings} subjects={subjects} />

      <Card className="mb-5">
        <CardTitle hint="Kolom yang berbeda antar versi diberi latar kuning — itu yang membuat perbandingannya tidak setara.">
          Kondisi uji
        </CardTitle>
        <CompareConditions subjects={subjects} />
      </Card>

      <Card className="mb-5">
        <CardTitle>Komposisi</CardTitle>
        <div className="-mx-5 overflow-x-auto md:mx-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-y border-[var(--border)] bg-[var(--surface-muted)] text-[11px] uppercase tracking-[0.04em] text-[var(--text-muted)]">
                <th className="px-3 py-2 text-left font-medium">Komponen</th>
                {columns.map((col) => (
                  <th
                    key={col.version.id}
                    className="px-3 py-2 text-right font-medium"
                  >
                    v{col.version.version_no}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const base = row.shares[0];
                return (
                  <tr
                    key={row.label}
                    className="border-b border-[var(--border)]"
                  >
                    <td className="px-3 py-2">{row.label}</td>
                    {row.shares.map((share, i) => {
                      const missing = share == null;
                      const delta =
                        i === 0 || share == null || base == null
                          ? null
                          : share - base;
                      return (
                        <td
                          key={i}
                          className={cn(
                            "numeric px-3 py-2",
                            missing && "bg-[var(--surface-muted)]",
                          )}
                        >
                          {missing ? (
                            <span className="text-[var(--text-subtle)]">
                              {i === 0 ? "belum ada" : "dihapus"}
                            </span>
                          ) : (
                            <>
                              <span className="font-medium">
                                {fmtPct(share)}
                              </span>
                              <span className="ml-1 text-[11px] text-[var(--text-subtle)]">
                                {fmtGram(row.weights[i])} g
                              </span>
                              {delta != null &&
                                Math.abs(delta) >= 0.05 && (
                                  <span
                                    className={cn(
                                      "ml-1.5 text-[11px] font-medium",
                                      delta > 0
                                        ? "text-[var(--ok)]"
                                        : "text-[var(--danger)]",
                                    )}
                                  >
                                    {delta > 0 ? "+" : "−"}
                                    {fmtPct(Math.abs(delta))}
                                  </span>
                                )}
                              {delta == null && base == null && i > 0 && (
                                <span className="ml-1.5 text-[11px] font-medium text-[var(--text-subtle)]">
                                  baru
                                </span>
                              )}
                            </>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-[var(--surface-muted)] text-[13px] font-semibold">
                <td className="px-3 py-2">Total timbang</td>
                {columns.map((col) => (
                  <td key={col.version.id} className="numeric px-3 py-2">
                    {fmtGram(col.analysis.display.totals.weighedG)} g
                  </td>
                ))}
              </tr>
              <tr className="bg-[var(--surface-muted)] text-[13px]">
                <td className="px-3 py-2 text-[var(--text-muted)]">
                  Dinilai dari
                </td>
                {columns.map((col) => (
                  <td key={col.version.id} className="numeric px-3 py-2">
                    {fmtPct(col.analysis.display.strengthBasis)}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <div
        className="grid gap-5"
        style={{
          gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
        }}
      >
        {columns.map((col) => (
          <Card key={col.version.id}>
            <CardTitle
              hint={col.version.label ?? undefined}
              action={
                <Link
                  href={`/formulas/${formula.id}?v=${col.version.id}`}
                  className="text-[13px] font-medium text-[var(--brand)] hover:underline"
                >
                  Buka
                </Link>
              }
            >
              v{col.version.version_no}
            </CardTitle>

            <div className="space-y-4 text-[13px]">
              <div>
                <p className="mb-1 text-[12px] font-medium text-[var(--text-muted)]">
                  Apa yang diubah
                </p>
                <p className="whitespace-pre-wrap">
                  {col.version.change_note ?? (
                    <span className="text-[var(--text-subtle)]">
                      {col.version.version_no === 1
                        ? "versi pertama"
                        : "belum ada catatan"}
                    </span>
                  )}
                </p>
              </div>

              <div>
                <p className="mb-1 text-[12px] font-medium text-[var(--text-muted)]">
                  Kekuatan tertinggi
                </p>
                {col.analysis.display.lead ? (
                  <p>
                    {col.analysis.display.lead.label}{" "}
                    <span className="numeric text-[var(--text-muted)]">
                      {fmtPct(col.analysis.display.lead.share)}
                    </span>
                  </p>
                ) : (
                  <p className="text-[var(--text-subtle)]">
                    belum ada yang bisa dinilai
                  </p>
                )}
              </div>

              <div>
                <p className="mb-1 text-[12px] font-medium text-[var(--text-muted)]">
                  Hasil penciuman
                </p>
                {col.evaluations.length === 0 ? (
                  <p className="text-[var(--text-subtle)]">belum dinilai</p>
                ) : (
                  <ul className="space-y-2">
                    {col.evaluations.map((evaluation) => {
                      const verdict = TRANSITION_VERDICTS.find(
                        (v) => v.value === evaluation.transition_verdict,
                      );
                      // Kutipan menit 180 — titik tempat karakter aslinya
                      // biasanya sudah muncul utuh.
                      const late =
                        evaluation.points.find(
                          (p) => p.minutes_elapsed === 180,
                        ) ?? evaluation.points.at(-1);
                      return (
                        <li key={evaluation.id}>
                          <p className="font-medium">
                            {evaluation.evaluator_name}
                            {evaluation.rating != null && (
                              <span className="ml-1.5 font-normal text-[var(--text-muted)]">
                                {evaluation.rating}/5
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-[var(--text-subtle)]">
                            {evaluation.purpose === "final"
                              ? "final"
                              : "screening"}
                            {evaluation.maceration_days != null &&
                              ` · maserasi ${evaluation.maceration_days} hari`}
                            {evaluation.blind_code && ` · buta ${evaluation.blind_code}`}
                          </p>
                          {verdict && (
                            <p className="text-[12px] text-[var(--text-muted)]">
                              {verdict.label}
                            </p>
                          )}
                          {late && (
                            <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                              <span className="text-[var(--text-subtle)]">
                                menit {late.minutes_elapsed}:{" "}
                              </span>
                              {late.dominant_note ??
                                late.descriptors.join(" · ") ??
                                "—"}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-5">
        <SmellDisclaimer>
          Tabel ini hanya menunjukkan apa yang berubah secara struktural.
          Kesimpulan &ldquo;versi mana yang lebih baik&rdquo; cuma bisa datang
          dari catatan penciuman di kolom paling bawah — bukan dari angkanya.
        </SmellDisclaimer>
      </div>
    </>
  );
}
