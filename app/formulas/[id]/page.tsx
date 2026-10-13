import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, Pencil } from "lucide-react";
import { EvaluationCard } from "@/components/evaluation/EvaluationCard";
import { FunctionDonut } from "@/components/formula/FunctionDonut";
import { RulesPanel } from "@/components/formula/RulesPanel";
import { StrengthChart } from "@/components/formula/StrengthChart";
import { StrengthTable } from "@/components/formula/StrengthTable";
import { VersionActions } from "@/components/formula/VersionActions";
import { VersionPicker } from "@/components/formula/VersionPicker";
import {
  Card,
  CardTitle,
  EmptyState,
  Notice,
  PageHeader,
} from "@/components/shared/primitives";
import { Button } from "@/components/ui/button";
import { fmtGram, fmtIdr, fmtPct } from "@/lib/calc/format";
import { FORMULA_SOURCES, FORMULA_TYPES, STATUS_LABELS } from "@/lib/constants";
import { getFormula, pickVersion } from "@/lib/data/formulas";
import { listEvaluationsForVersion } from "@/lib/data/evaluations";
import { listBridgerCandidates } from "@/lib/data/materials";
import { getVersionDetail } from "@/lib/data/versions";
import { labStage } from "@/lib/lab";

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

  const [detail, evaluations, bridgers] = await Promise.all([
    getVersionDetail(selected.id),
    listEvaluationsForVersion(selected.id),
    listBridgerCandidates(),
  ]);
  if (!detail) notFound();

  const { analysis } = detail;
  const stage = labStage(selected);
  const typeLabel =
    FORMULA_TYPES.find((t) => t.value === formula.type)?.label ?? formula.type;
  const sourceLabel = FORMULA_SOURCES.find((s) => s.value === formula.source);
  const isEmpty = analysis.display.rows.length === 0;

  return (
    <>
      <PageHeader
        title={formula.name}
        subtitle={
          <>
            {typeLabel}
            {formula.target_category ? ` · ${formula.target_category}` : ""}
            {sourceLabel && formula.source !== "own"
              ? ` · ${sourceLabel.label}`
              : ""}
            {formula.source_note ? ` · ${formula.source_note}` : ""}
            {formula.description && (
              <span className="mt-1 block">{formula.description}</span>
            )}
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <VersionPicker
          formulaId={formula.id}
          current={selected.id}
          versions={formula.versions.map((ver) => ({
            id: ver.id,
            versionNo: ver.version_no,
            label: ver.label,
            status: ver.status,
          }))}
        />
        <span className="rounded-md bg-[var(--surface-muted)] px-2 py-1 text-[12px] font-medium text-[var(--text-muted)]">
          {STATUS_LABELS[selected.status]}
        </span>
        {/*
          Tahap lab diturunkan dari dua tanggal, bukan dari kolom status —
          satu versi bisa berstatus "sudah dinilai" (hasil screening) dan tetap
          sedang maserasi menuju penilaian final.
        */}
        <span className="rounded-md bg-[var(--brand-soft)] px-2 py-1 text-[12px] font-medium text-[var(--brand)]">
          {stage.label}
          <span className="font-normal"> · {stage.detail}</span>
        </span>
        {selected.mixed_at && (
          <span className="text-[12px] text-[var(--text-subtle)]">
            dicampur {dateFmt.format(new Date(selected.mixed_at))}
            {selected.diluted_at &&
              ` · diencerkan ${dateFmt.format(new Date(selected.diluted_at))}`}
          </span>
        )}
        <div className="ml-auto">
          <VersionActions
            formulaId={formula.id}
            versionId={selected.id}
            versionNo={selected.version_no}
            hasLines={!isEmpty}
            mixedAt={selected.mixed_at}
            dilutedAt={selected.diluted_at}
            evaluationCount={detail.evaluationCount}
            versionCount={formula.versions.length}
          />
        </div>
      </div>

      {/*
        Pakai hasil yang sudah dibentangkan: kalau bahan yang datanya bolong ada
        DI DALAM sebuah accord, yang perlu dilengkapi user adalah bahan itu —
        bukan nama accord yang membungkusnya.
      */}
      {analysis.expandedResult.missingImpact.length > 0 && (
        <Notice tone="warn" className="mb-5">
          {analysis.expandedResult.missingImpact.length} bahan belum punya nilai
          impact ({analysis.expandedResult.missingImpact.join(", ")}). Persentase
          kekuatan di bawah belum lengkap.
        </Notice>
      )}

      {isEmpty ? (
        <EmptyState
          icon={Pencil}
          title={`Versi v${selected.version_no} masih kosong`}
          description="Belum ada baris bahan. Isi di editor — targetnya 8 bahan di bawah 3 menit."
          action={{
            href: `/formulas/${formula.id}/edit?v=${selected.id}`,
            label: "Isi bahan",
          }}
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
          {/* ---------------------- kolom kiri: tabel komponen ------------- */}
          <Card>
            <CardTitle hint="Berat timbang adalah angka yang kamu pakai di timbangan. Berat murni yang dipakai semua perhitungan.">
              Komponen
            </CardTitle>
            <StrengthTable result={analysis.display} />
          </Card>

          {/* ---------------------- kolom tengah: analisa ------------------ */}
          <div className="space-y-5">
            <Card>
              <CardTitle>Berat vs kekuatan</CardTitle>
              <StrengthChart result={analysis.display} />
            </Card>

            <Card>
              <CardTitle hint="Dihitung dari daftar yang sudah dibentangkan, jadi isi sub-formula ikut terhitung.">
                Sebaran kategori fungsi
              </CardTitle>
              <FunctionDonut result={analysis.expandedResult} />
            </Card>

            <Card>
              <CardTitle>Ringkasan</CardTitle>
              <dl className="grid grid-cols-2 gap-y-2 text-[13px]">
                <dt className="text-[var(--text-muted)]">Jumlah komponen</dt>
                <dd className="numeric font-medium">
                  {analysis.display.rows.length}
                </dd>
                <dt className="text-[var(--text-muted)]">Bahan sebenarnya</dt>
                <dd className="numeric font-medium">
                  {analysis.expanded.filter((l) => l.lineType !== "fo").length}
                  {analysis.display.hasFO && (
                    <span className="ml-1 font-normal text-[var(--text-subtle)]">
                      + isi FO
                    </span>
                  )}
                </dd>
                <dt className="text-[var(--text-muted)]">Total timbang</dt>
                <dd className="numeric font-medium">
                  {fmtGram(analysis.display.totals.weighedG)} g
                </dd>
                <dt className="text-[var(--text-muted)]">Total murni</dt>
                <dd className="numeric font-medium">
                  {fmtGram(analysis.display.totals.neatG)} g
                </dd>
                <dt className="text-[var(--text-muted)]">Biaya per gram</dt>
                <dd className="numeric font-medium">
                  {fmtIdr(analysis.display.totals.costPerGram)}
                </dd>
                <dt className="text-[var(--text-muted)]">Dinilai dari</dt>
                <dd className="numeric font-medium">
                  {fmtPct(analysis.display.strengthBasis)}
                </dd>
                {analysis.display.lead && (
                  <>
                    <dt className="text-[var(--text-muted)]">
                      Paling dominan
                    </dt>
                    <dd className="font-medium">
                      {analysis.display.lead.label}{" "}
                      <span className="numeric font-normal text-[var(--text-muted)]">
                        {fmtPct(analysis.display.lead.share)}
                      </span>
                    </dd>
                  </>
                )}
              </dl>
            </Card>
          </div>

          {/* ---------------------- kolom kanan: rules + riwayat ----------- */}
          <div className="space-y-5">
            <Card>
              <CardTitle>Pemeriksaan struktur</CardTitle>
              <RulesPanel
                findings={analysis.findings}
                bridgerCandidates={bridgers.map((m) => ({
                  id: m.id,
                  name: m.name,
                  family: m.family,
                  effectiveImpact: m.effectiveImpact,
                  pricePerGram: m.pricePerGram,
                }))}
              />
            </Card>

            <Card>
              <CardTitle>Catatan versi ini</CardTitle>
              {selected.change_note ? (
                <p className="whitespace-pre-wrap text-[13px]">
                  {selected.change_note}
                </p>
              ) : (
                <p className="text-[13px] text-[var(--text-muted)]">
                  {selected.version_no === 1
                    ? "Versi pertama — belum ada perubahan untuk dicatat."
                    : "Belum ada catatan perubahan."}
                </p>
              )}
            </Card>

            <Card>
              <CardTitle
                action={
                  !isEmpty && (
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
                  Belum ada catatan penciuman untuk versi ini. Satu hidung tidak
                  cukup — sebagian orang tidak bisa mencium molekul musk atau
                  sandalwood sintetis tertentu.
                </p>
              ) : (
                <div className="space-y-3">
                  {evaluations.map((evaluation) => (
                    <EvaluationCard
                      key={evaluation.id}
                      evaluation={evaluation}
                      points={evaluation.points}
                      compact
                    />
                  ))}
                  {evaluations.length === 1 && (
                    <p className="flex items-start gap-2 text-[12px] text-[var(--text-subtle)]">
                      <ClipboardList className="mt-0.5 size-3.5 shrink-0" />
                      Minta satu orang lain menilai versi ini juga — penilaian
                      satu hidung bisa menyesatkan karena anosmia parsial.
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
