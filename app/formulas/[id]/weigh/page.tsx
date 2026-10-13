import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { WeighSheet } from "@/components/formula/WeighSheet";
import { Notice, PageHeader } from "@/components/shared/primitives";
import { Button } from "@/components/ui/button";
import { getFormula, pickVersion } from "@/lib/data/formulas";
import { getVersionDetail, versionLabel } from "@/lib/data/versions";

export const dynamic = "force-dynamic";

export default async function WeighPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ v?: string; batch?: string }>;
}) {
  const [{ id }, { v, batch }] = await Promise.all([params, searchParams]);

  const formula = await getFormula(id);
  if (!formula) notFound();

  const selected = pickVersion(formula.versions, v);
  if (!selected) notFound();

  // Bridge engine tidak dipakai di lembar timbang dan dia bagian termahal dari
  // analisa — dilewati supaya halaman ini cepat dibuka di meja kerja.
  const detail = await getVersionDetail(selected.id, { skipBridges: true });
  if (!detail) notFound();

  const requested = Number(String(batch ?? "").replace(",", "."));
  const batchG =
    Number.isFinite(requested) && requested > 0
      ? requested
      : detail.context.version.batchG;

  const label = versionLabel(formula.name, selected.version_no);

  return (
    <>
      <PageHeader
        title={`Lembar timbang — ${label}`}
        subtitle="Centang sambil menimbang. Kumulatifnya untuk mengecek timbangan berjalan, bukan untuk menimbang ulang dari nol."
      >
        <Button asChild variant="outline" className="print:hidden">
          <Link href={`/formulas/${id}?v=${selected.id}`}>
            <ArrowLeft className="size-4" />
            Kembali ke detail
          </Link>
        </Button>
      </PageHeader>

      {detail.analysis.error ? (
        <Notice tone="danger">{detail.analysis.error}</Notice>
      ) : detail.context.version.lines.length === 0 ? (
        <Notice tone="warn">
          Versi ini belum ada bahannya, jadi belum ada yang bisa ditimbang.
        </Notice>
      ) : (
        <WeighSheet
          table={detail.analysis.lines}
          initialBatchG={batchG}
          grouped={formula.pyramid_mode}
        />
      )}
    </>
  );
}
