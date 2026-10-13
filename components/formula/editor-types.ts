import type { CalcLine, LineType } from "@/lib/legacy/calc/types";
import type { FunctionCategoryEnum } from "@/lib/supabase/database.types";

/** Bentuk data yang dibutuhkan picker — sengaja sempit supaya props-nya ringan. */
export type PickerMaterial = {
  id: string;
  name: string;
  synonym: string | null;
  cas_number: string | null;
  family: string | null;
  odour_profile: string | null;
  function_category: FunctionCategoryEnum | null;
  effectiveImpact: number | null;
  odor_impact: number | null;
  pricePerGram: number | null;
  default_dilution_pct: number;
  default_solvent: string | null;
};

export type PickerFo = {
  id: string;
  name: string;
  inspired_by: string | null;
  family: string;
  price_per_gram: number | null;
};

export type PickerSubFormula = {
  versionId: string;
  label: string;
  formulaType: string;
  materialCount: number;
  averageImpact: number | null;
  disabledReason: string | null;
  lines: CalcLine[];
};

export type PickerData = {
  materials: PickerMaterial[];
  fos: PickerFo[];
  subFormulas: PickerSubFormula[];
};

/**
 * Satu baris di editor. Berat disimpan sebagai STRING selama diedit supaya
 * user bisa mengetik "0," tanpa angkanya dipaksa jadi 0 di tengah ketikan.
 */
export type EditorLine = {
  key: string;
  lineType: LineType;
  refId: string | null;
  weightInput: string;
  dilutionPct: number;
  solvent: string | null;
  note: string;
};

export const parseWeight = (input: string): number | null => {
  const normalized = input.trim().replace(",", ".");
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export const newLine = (): EditorLine => ({
  key: `line-${Math.random().toString(36).slice(2, 10)}`,
  lineType: "raw_material",
  refId: null,
  weightInput: "",
  dilutionPct: 100,
  solvent: null,
  note: "",
});

/**
 * Mengubah baris editor jadi CalcLine supaya panel kalkulasi live memakai
 * rumus yang SAMA PERSIS dengan yang dipakai server. Tidak ada perhitungan
 * kedua yang bisa berbeda diam-diam.
 */
export function toCalcLines(
  lines: EditorLine[],
  data: PickerData,
): CalcLine[] {
  const out: CalcLine[] = [];
  for (const line of lines) {
    const weightG = parseWeight(line.weightInput);
    if (!line.refId || weightG == null) continue;

    if (line.lineType === "raw_material") {
      const m = data.materials.find((x) => x.id === line.refId);
      if (!m) continue;
      out.push({
        id: line.key,
        lineType: "raw_material",
        label: m.name,
        weightG,
        dilutionPct: line.dilutionPct,
        solvent: line.solvent,
        impact: m.effectiveImpact,
        functionCategory: m.function_category,
        family: m.family,
        pricePerGram: m.pricePerGram,
        note: line.note || null,
      });
      continue;
    }

    if (line.lineType === "fo") {
      const f = data.fos.find((x) => x.id === line.refId);
      if (!f) continue;
      out.push({
        id: line.key,
        lineType: "fo",
        label: f.name,
        weightG,
        dilutionPct: line.dilutionPct,
        solvent: line.solvent,
        foFamily: f.family,
        pricePerGram: f.price_per_gram,
        note: line.note || null,
      });
      continue;
    }

    const s = data.subFormulas.find((x) => x.versionId === line.refId);
    if (!s) continue;
    const subNeat = s.lines.reduce(
      (a, l) => a + l.weightG * (l.dilutionPct / 100),
      0,
    );
    const allPriced =
      s.lines.length > 0 && s.lines.every((l) => l.pricePerGram != null);
    const subCost = allPriced
      ? s.lines.reduce(
          (a, l) => a + l.weightG * (l.dilutionPct / 100) * l.pricePerGram!,
          0,
        )
      : null;

    out.push({
      id: line.key,
      lineType: "sub_formula",
      label: s.label,
      weightG,
      dilutionPct: line.dilutionPct,
      solvent: line.solvent,
      subLines: s.lines,
      subFormulaType: s.formulaType,
      pricePerGram: subCost != null && subNeat > 0 ? subCost / subNeat : null,
      note: line.note || null,
    });
  }
  return out;
}

export function labelFor(line: EditorLine, data: PickerData): string | null {
  if (!line.refId) return null;
  if (line.lineType === "raw_material")
    return data.materials.find((m) => m.id === line.refId)?.name ?? null;
  if (line.lineType === "fo")
    return data.fos.find((f) => f.id === line.refId)?.name ?? null;
  return (
    data.subFormulas.find((s) => s.versionId === line.refId)?.label ?? null
  );
}
