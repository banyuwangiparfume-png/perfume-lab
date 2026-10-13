import { notFound } from "next/navigation";
import { LineEditor } from "@/components/formula/LineEditor";
import { newLine } from "@/components/formula/editor-types";
import { PageHeader } from "@/components/shared/primitives";
import { getFormula, pickVersion } from "@/lib/data/formulas";
import { listFragranceOils } from "@/lib/data/fragrance-oils";
import { listBridgerCandidates, listMaterials } from "@/lib/data/materials";
import { getEditorLines, listUsableAsSubFormula } from "@/lib/data/versions";

export const dynamic = "force-dynamic";

export default async function EditVersionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const [{ id }, { v }] = await Promise.all([params, searchParams]);

  const formula = await getFormula(id);
  if (!formula) notFound();

  const version = pickVersion(formula.versions, v);
  if (!version) notFound();

  const [seeds, materials, fos, subFormulas, bridgers] = await Promise.all([
    getEditorLines(version.id),
    listMaterials(),
    listFragranceOils(),
    listUsableAsSubFormula(version.id),
    listBridgerCandidates(),
  ]);

  const initialLines = seeds.map((seed) => ({
    ...newLine(),
    lineType: seed.lineType,
    refId: seed.refId,
    // Berat masuk sebagai string: itu yang diedit user, dan membiarkannya
    // string mencegah "0," di tengah ketikan dipaksa jadi 0.
    weightInput: String(seed.weightG),
    dilutionPct: seed.dilutionPct,
    solvent: seed.solvent,
    note: seed.note,
  }));

  return (
    <>
      <PageHeader
        title={`${formula.name} — v${version.version_no}`}
        subtitle="Tab antar sel, Enter di kolom berat untuk baris baru. Panel di kanan ikut berubah tiap ketikan."
      />

      <LineEditor
        formulaId={formula.id}
        versionId={version.id}
        versionNo={version.version_no}
        status={version.status}
        batchSizeG={Number(version.batch_size_g)}
        label={version.label}
        changeNote={version.change_note}
        initialLines={initialLines}
        data={{
          materials: materials.map((m) => ({
            id: m.id,
            name: m.name,
            synonym: m.synonym,
            cas_number: m.cas_number,
            family: m.family,
            odour_profile: m.odour_profile,
            function_category: m.function_category,
            effectiveImpact: m.effectiveImpact,
            odor_impact: m.odor_impact,
            pricePerGram: m.pricePerGram,
            default_dilution_pct: Number(m.default_dilution_pct),
            default_solvent: m.default_solvent,
          })),
          fos: fos.map((f) => ({
            id: f.id,
            name: f.name,
            inspired_by: f.inspired_by,
            family: f.family,
            price_per_gram:
              f.price_per_gram != null ? Number(f.price_per_gram) : null,
          })),
          subFormulas: subFormulas.map((s) => ({
            versionId: s.versionId,
            label: s.label,
            formulaType: s.formulaType,
            materialCount: s.materialCount,
            averageImpact: s.averageImpact,
            disabledReason: s.disabledReason,
            lines: s.lines,
          })),
        }}
        bridgerCandidates={bridgers.map((m) => ({
          id: m.id,
          name: m.name,
          family: m.family,
          effectiveImpact: m.effectiveImpact,
          pricePerGram: m.pricePerGram,
        }))}
      />
    </>
  );
}
