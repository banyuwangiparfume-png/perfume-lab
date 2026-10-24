import Link from "next/link";
import { GitCompare, History } from "lucide-react";
import { notFound } from "next/navigation";
import { FormulaEditor } from "@/components/editor/FormulaEditor";
import { PageHeader } from "@/components/shared/primitives";
import { Button } from "@/components/ui/button";
import { getFormula } from "@/lib/data/formulas";
import { loadEditorData, loadMaterialMeta } from "@/lib/data/loadEditorData";
import { loadFormulaContext } from "@/lib/data/loadFormulaContext";
import { getDraftVersion } from "@/lib/data/versions";

export const dynamic = "force-dynamic";

export default async function EditFormulaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const formula = await getFormula(id);
  if (!formula) notFound();

  const draft = await getDraftVersion(id);
  if (!draft) notFound();

  const [context, data, meta] = await Promise.all([
    loadFormulaContext(draft.id),
    loadEditorData(id),
    loadMaterialMeta(),
  ]);
  if (!context) notFound();

  const saved = formula.versions
    .filter((v) => v.version_no > 0)
    .sort((a, b) => a.version_no - b.version_no);
  const savedVersionCount = saved.length;
  const latestNo = saved.at(-1)?.version_no ?? 0;

  return (
    <>
      <PageHeader
        title={formula.name}
        subtitle={
          formula.category === "accord"
            ? "Accord — bisa dipakai sebagai bahan di formula lain setelah versinya disimpan."
            : "Parfum utuh. Ganti ukuran batch kapan saja tanpa mengubah persen."
        }
      >
        {/* Riwayat terlihat dari editor: versi lama tidak pernah berubah, dan
            tempat membandingkannya harus bisa ditemukan tanpa keluar dulu. */}
        {savedVersionCount > 0 && (
          <span className="self-center text-[12px] text-[var(--text-muted)]">
            {savedVersionCount} versi tersimpan · terakhir v{latestNo}
          </span>
        )}
        {savedVersionCount > 0 && (
          <Button asChild variant="outline">
            <Link href={`/formulas/${id}/compare`}>
              <GitCompare className="size-4" />
              Bandingkan versi
            </Link>
          </Button>
        )}
        <Button asChild variant="outline">
          <Link href={`/formulas/${id}`}>
            <History className="size-4" />
            Riwayat & detail
          </Link>
        </Button>
      </PageHeader>

      <FormulaEditor
        formulaId={id}
        formulaName={formula.name}
        versionId={draft.id}
        pyramidMode={formula.pyramid_mode}
        initial={{
          lines: context.version.lines,
          pyramid: context.version.pyramid,
          batchG: context.version.batchG,
          priceTierOverride: context.version.priceTierOverride,
        }}
        data={data}
        meta={Object.fromEntries(meta)}
        savedVersionCount={savedVersionCount}
        latestVersionNo={latestNo}
      />
    </>
  );
}
