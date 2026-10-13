import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, Pencil, Scale } from "lucide-react";
import { AnalysisPanel } from "@/components/analysis/AnalysisPanel";
import { EvaluationCard } from "@/components/evaluation/EvaluationCard";
import { CompositionTable } from "@/components/formula/CompositionTable";
import { DiluteButton } from "@/components/formula/DiluteButton";
import {
  Card,
  CardTitle,
  EmptyState,
  Notice,
  PageHeader,
} from "@/components/shared/primitives";
import { Button } from "@/components/ui/button";
import { fmtGram, fmtIdr } from "@/lib/calc/format";
import { listEvaluationsForVersion } from "@/lib/data/evaluations";
import { accordUsage, getFormula, pickVersion } from "@/lib/data/formulas";
import { getVersionDetail } from "@/lib/data/versions";
import { labStage } from "@/lib/lab";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function FormulaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const [{ id }, { v }] = await Promise.all([params, searchParams]);

  const formula = await getFormula(id);
  if (!formula) notFound();

  const selected = pickVersion(formula.versions, v);
  if (!selected) notFound();

  const [detail, evaluations, usedIn] = await Promise.all([
    getVersionDetail(selected.id),
    listEvaluationsForVersion(selected.id),
    formula.category === "accord" ? accordUsage(id) : Promise.resolve([]),
  ]);
  if (!detail) notFound();

  const { analysis, context } = detail;
  const isEmpty = context.version.lines.length === 0;
  const stage = labStage(selected);
  const savedVersions = formula.versions.filter((x) => x.version_no > 0);

  return (
    <>
      <PageHeader
        title={formula.name}
        subtitle={
          <>
            {formula.category === "accord" ? "Accord" : "Fragrance"}
            {formula.target_family ? ` · ${formula.target_family}` : ""}
            {formula.description && (
              <span className="mt-1 block">{formula.description}</span>
            )}
          </>
        }
      >
        <Button asChild variant="outline">
          <Link href={`/formulas/${id}/weigh?v=${selected.id}`}>
            <Scale className="size-4" />
            Lembar timbang
          </Link>
        </Button>
        <Button asChild>
          <Link href={`/formulas/${id}/edit`}>
            <Pencil className="size-4" />
            Edit
          </Link>
        </Button>
        {!isEmpty && selected.mixed_at && (
          <DiluteButton
            versionId={selected.id}
            label={`v${selected.version_no}`}
            mixedAt={selected.mixed_at}
            dilutedAt={selected.diluted_at}
          />
        )}
      </PageHeader>

      {/* ---------------- pemilih versi ---------------- */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {selected.version_no === 0 ? (
          <span className="rounded-md bg-[var(--warn-soft)] px-2 py-1 text-[12px] font-medium text-[var(--warn)]">
            Draf kerja — belum disimpan sebagai versi
          </span>
        ) : (
          <span className="rounded-md bg-[var(--surface-muted)] px-2 py-1 text-[12px] font-medium">
            v{selected.version_no}
          </span>
        )}

        {savedVersions.map((ver) => (
          <Link
            key={ver.id}
            href={`/formulas/${id}?v=${ver.id}`}
            className={cn(
              "rounded-md px-2 py-1 text-[12px] font-medium transition-colors",
              ver.id === selected.id
                ? "bg-[var(--cta)] text-white"
                : "bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text)]",
            )}
          >
            v{ver.version_no}
          </Link>
        ))}

        {selected.mixed_at && (
          <span className="rounded-md bg-[var(--brand-soft)] px-2 py-1 text-[12px] font-medium text-[var(--brand)]">
            {stage.label} · {stage.detail}
          </span>
        )}

        {savedVersions.length >= 2 && (
          <Button asChild size="sm" variant="outline" className="ml-auto">
            <Link href={`/formulas/${id}/compare`}>Compare versi</Link>
          </Button>
        )}
      </div>

      {analysis.error && (
        <Notice tone="danger" className="mb-5">
          {analysis.error}
        </Notice>
      )}

      {isEmpty ? (
        <EmptyState
          icon={Pencil}
          title="Versi ini masih kosong"
          description="Belum ada bahan sama sekali. Buka editor dan mulai dari tier mana pun."
          action={{ href: `/formulas/${id}/edit`, label: "Isi bahan" }}
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            <Card>
              <CardTitle
                hint={`Batch ${fmtGram(context.version.batchG)} g · harga tier ${analysis.cost.tier} g`}
              >
                Komposisi
              </CardTitle>

              <CompositionTable
                table={analysis.lines}
                batchG={context.version.batchG}
                grouped={formula.pyramid_mode}
              />

              <p className="pt-3 text-[13px] text-[var(--text-muted)]">
                HPP {fmtIdr(analysis.cost.perGram)}/g
              </p>
            </Card>

            {selected.change_note && (
              <Card>
                <CardTitle>Apa yang berubah di versi ini</CardTitle>
                <p className="whitespace-pre-wrap text-[13px]">
                  {selected.change_note}
                </p>
              </Card>
            )}

            {savedVersions.length > 0 && (
              <Card>
                <CardTitle>Riwayat versi</CardTitle>
                <ul className="divide-y divide-[var(--border)]">
                  {savedVersions.map((ver) => (
                    <li
                      key={ver.id}
                      className="flex items-start gap-3 py-2.5 first:pt-0"
                    >
                      <Link
                        href={`/formulas/${id}?v=${ver.id}`}
                        className="shrink-0 font-medium hover:text-[var(--brand)]"
                      >
                        v{ver.version_no}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] text-[var(--text-muted)]">
                          {ver.change_note ?? ver.label ?? "versi pertama"}
                        </p>
                        <p className="text-[11px] text-[var(--text-subtle)]">
                          {dateFmt.format(new Date(ver.created_at))}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {formula.category === "accord" && (
              <Card>
                <CardTitle>Dipakai di formula lain</CardTitle>
                {usedIn.length === 0 ? (
                  <p className="text-[13px] text-[var(--text-muted)]">
                    Belum dipakai di mana-mana. Accord muncul sebagai pilihan
                    bahan begitu versinya disimpan.
                  </p>
                ) : (
                  <ul className="space-y-1 text-[13px]">
                    {usedIn.map((u) => (
                      <li key={u.formulaId}>
                        <Link
                          href={`/formulas/${u.formulaId}`}
                          className="font-medium hover:text-[var(--brand)]"
                        >
                          {u.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}
          </div>

          <div className="space-y-5 xl:sticky xl:top-20 xl:self-start">
            <Card>
              <CardTitle>Analisa</CardTitle>
              <AnalysisPanel analysis={analysis} context={context} />
            </Card>

            <Card>
              <CardTitle
                action={
                  selected.diluted_at && (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/evaluations/new?version=${selected.id}`}>
                        Tambah
                      </Link>
                    </Button>
                  )
                }
              >
                Evaluasi
              </CardTitle>

              {evaluations.length === 0 ? (
                <p className="text-[13px] text-[var(--text-muted)]">
                  {selected.diluted_at
                    ? "Belum ada catatan penciuman untuk versi ini."
                    : "Tandai dulu kapan versi ini dicampur dan diencerkan — evaluasi baru masuk akal setelah ketemu ethanol."}
                </p>
              ) : (
                <div className="space-y-3">
                  {evaluations.map((e) => (
                    <EvaluationCard
                      key={e.id}
                      evaluation={e}
                      points={e.points}
                      compact
                    />
                  ))}
                  {evaluations.length === 1 && (
                    <p className="flex items-start gap-2 text-[12px] text-[var(--text-subtle)]">
                      <ClipboardList className="mt-0.5 size-3.5 shrink-0" />
                      Minta satu orang lain menilai juga — anosmia parsial bikin
                      penilaian satu hidung gampang menyesatkan.
                    </p>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
