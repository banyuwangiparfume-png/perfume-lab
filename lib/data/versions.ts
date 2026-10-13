import "server-only";

import { analyze, type Analysis } from "../legacy/calc/analyze";
import {
  checkCandidate,
  explainProblem,
  type SubFormulaGraph,
} from "../legacy/calc/cycle";
import { aggregateImpact } from "../legacy/calc/formula";
import type { CalcLine } from "../legacy/calc/types";
import { T } from "../rules/thresholds";
import { getOwnerId } from "../owner";
import { getDb } from "../supabase/db";
import type {
  FormulaLineRow,
  FormulaRow,
  FormulaVersionRow,
} from "../supabase/database.types";
import { getFragranceOilsByIds } from "./fragrance-oils";
import { getMaterialsByIds } from "./materials";

type Db = ReturnType<typeof getDb>;

/** Label versi yang dipakai di mana-mana: "Jasmine Accord · v3". */
export const versionLabel = (formulaName: string, versionNo: number) =>
  `${formulaName} · v${versionNo}`;

async function fetchLines(
  db: Db,
  versionId: string,
): Promise<FormulaLineRow[]> {
  const { data, error } = await db
    .from("formula_lines")
    .select("*")
    .eq("formula_version_id", versionId)
    .order("sort_order");
  if (error) throw new Error(`Gagal memuat baris formula: ${error.message}`);
  return data ?? [];
}

type SubVersionMeta = {
  id: string;
  version_no: number;
  formula: { id: string; name: string; type: string } | null;
};

async function fetchSubVersionMeta(
  db: Db,
  ids: string[],
): Promise<Map<string, SubVersionMeta>> {
  if (!ids.length) return new Map();
  const { data, error } = await db
    .from("formula_versions")
    .select("id, version_no, formula:formulas(id, name, type)")
    .in("id", ids);
  if (error) throw new Error(`Gagal memuat sub-formula: ${error.message}`);
  return new Map(
    (data as unknown as SubVersionMeta[]).map((v) => [v.id, v]),
  );
}

/**
 * Memuat baris sebuah versi dan mengubahnya jadi CalcLine, dengan sub-formula
 * ter-resolve sampai batas kedalaman.
 *
 * Baris FO tidak punya penyusun — isinya memang tidak diketahui, jadi dia
 * berhenti sebagai satu baris.
 *
 * `cache` mencegah versi yang sama di-resolve berulang kali dalam satu request,
 * dan `inProgress` menghentikan rekursi kalau ternyata ada siklus di data lama
 * — supaya halamannya tetap tampil, bukan hang.
 */
export async function resolveVersionLines(
  versionId: string,
  depth = 1,
  cache = new Map<string, CalcLine[]>(),
  inProgress = new Set<string>(),
): Promise<CalcLine[]> {
  const cached = cache.get(versionId);
  if (cached) return cached;
  if (inProgress.has(versionId)) return [];

  const db = getDb();
  inProgress.add(versionId);

  const rows = await fetchLines(db, versionId);

  const [materials, fos, subMeta] = await Promise.all([
    getMaterialsByIds(
      rows.map((r) => r.raw_material_id).filter((x): x is string => !!x),
    ),
    getFragranceOilsByIds(
      rows.map((r) => r.fo_id).filter((x): x is string => !!x),
    ),
    fetchSubVersionMeta(
      db,
      rows.map((r) => r.sub_formula_version_id).filter((x): x is string => !!x),
    ),
  ]);

  const lines: CalcLine[] = [];

  for (const row of rows) {
    const base = {
      id: row.id,
      weightG: Number(row.weight_g),
      dilutionPct: Number(row.dilution_pct),
      solvent: row.solvent,
      note: row.note,
    };

    if (row.line_type === "raw_material") {
      const m = row.raw_material_id
        ? materials.get(row.raw_material_id)
        : undefined;
      lines.push({
        ...base,
        lineType: "raw_material",
        label: m?.name ?? "Bahan tidak ditemukan",
        impact: m?.effectiveImpact ?? null,
        functionCategory: m?.function_category ?? null,
        family: m?.family ?? null,
        pricePerGram: m?.pricePerGram ?? null,
      });
      continue;
    }

    if (row.line_type === "fo") {
      const f = row.fo_id ? fos.get(row.fo_id) : undefined;
      lines.push({
        ...base,
        lineType: "fo",
        label: f?.name ?? "FO tidak ditemukan",
        foFamily: f?.family ?? null,
        pricePerGram:
          f?.price_per_gram != null ? Number(f.price_per_gram) : null,
      });
      continue;
    }

    // sub_formula
    const subId = row.sub_formula_version_id!;
    const meta = subMeta.get(subId);
    const label = meta?.formula
      ? versionLabel(meta.formula.name, meta.version_no)
      : "Formula tidak ditemukan";

    const subLines =
      depth < T.maxSubFormulaDepth
        ? await resolveVersionLines(subId, depth + 1, cache, inProgress)
        : [];

    // Harga sub-formula = biaya per gram murni penyusunnya. Null kalau ada
    // penyusun yang harganya belum ada — biaya tidak diketahui bukan nol.
    const subNeat = subLines.reduce(
      (a, l) => a + l.weightG * (l.dilutionPct / 100),
      0,
    );
    const subHasAllPrices =
      subLines.length > 0 && subLines.every((l) => l.pricePerGram != null);
    const subCost = subHasAllPrices
      ? subLines.reduce(
          (a, l) => a + l.weightG * (l.dilutionPct / 100) * l.pricePerGram!,
          0,
        )
      : null;

    lines.push({
      ...base,
      lineType: "sub_formula",
      label,
      subFormulaType: meta?.formula?.type ?? null,
      subLines,
      pricePerGram: subCost != null && subNeat > 0 ? subCost / subNeat : null,
    });
  }

  inProgress.delete(versionId);
  cache.set(versionId, lines);
  return lines;
}

export type VersionDetail = {
  formula: FormulaRow;
  version: FormulaVersionRow;
  versions: FormulaVersionRow[];
  lines: CalcLine[];
  analysis: Analysis;
  evaluationCount: number;
};

export async function getVersionDetail(
  versionId: string,
): Promise<VersionDetail | null> {
  const db = getDb();
  const ownerId = await getOwnerId();

  const { data: version, error } = await db
    .from("formula_versions")
    .select("*")
    .eq("id", versionId)
    .maybeSingle();
  if (error) throw new Error(`Gagal memuat versi: ${error.message}`);
  if (!version) return null;

  const { data: formula, error: fErr } = await db
    .from("formulas")
    .select("*")
    .eq("id", version.formula_id)
    .maybeSingle();
  if (fErr) throw new Error(`Gagal memuat formula: ${fErr.message}`);
  if (!formula || formula.owner_id !== ownerId) return null;

  const [versions, lines, evalCount] = await Promise.all([
    listVersions(version.formula_id),
    resolveVersionLines(versionId),
    countEvaluations(versionId),
  ]);

  return {
    formula,
    version,
    versions,
    lines,
    analysis: analyze(lines),
    evaluationCount: evalCount,
  };
}

export async function listVersions(
  formulaId: string,
): Promise<FormulaVersionRow[]> {
  const db = getDb();
  const { data, error } = await db
    .from("formula_versions")
    .select("*")
    .eq("formula_id", formulaId)
    .order("version_no", { ascending: false });
  if (error) throw new Error(`Gagal memuat daftar versi: ${error.message}`);
  return data ?? [];
}

async function countEvaluations(versionId: string): Promise<number> {
  const db = getDb();
  const { count, error } = await db
    .from("evaluations")
    .select("id", { count: "exact", head: true })
    .eq("formula_version_id", versionId);
  if (error) throw new Error(`Gagal menghitung evaluasi: ${error.message}`);
  return count ?? 0;
}

/**
 * Graf sub-formula seluruh milik user, untuk pemeriksaan siklus dan kedalaman.
 * Dimuat sekali per request lalu dipakai oleh checkCandidate().
 */
export async function loadSubFormulaGraph(): Promise<SubFormulaGraph> {
  const db = getDb();
  const ownerId = await getOwnerId();

  const { data, error } = await db
    .from("formula_versions")
    .select(
      `id, version_no,
       formula:formulas!inner(id, name, owner_id),
       lines:formula_lines!formula_lines_formula_version_id_fkey(sub_formula_version_id)`,
    )
    .eq("formula.owner_id", ownerId);

  if (error) throw new Error(`Gagal memuat graf sub-formula: ${error.message}`);

  type Row = {
    id: string;
    version_no: number;
    formula: { id: string; name: string } | null;
    lines: { sub_formula_version_id: string | null }[];
  };

  const graph: SubFormulaGraph = new Map();
  for (const row of (data ?? []) as unknown as Row[]) {
    graph.set(row.id, {
      versionId: row.id,
      label: row.formula
        ? versionLabel(row.formula.name, row.version_no)
        : `v${row.version_no}`,
      subVersionIds: row.lines
        .map((l) => l.sub_formula_version_id)
        .filter((x): x is string => !!x),
    });
  }
  return graph;
}

export type SubFormulaCandidate = {
  versionId: string;
  formulaId: string;
  label: string;
  formulaType: string;
  materialCount: number;
  averageImpact: number | null;
  /** baris penyusun yang sudah ter-resolve, supaya panel kalkulasi live di
   *  editor bisa menghitung % kekuatan tanpa bolak-balik ke server */
  lines: CalcLine[];
  /** terisi = tidak boleh dipakai, dan ini alasannya untuk tooltip */
  disabledReason: string | null;
};

/**
 * Versi formula milik user yang bisa dipakai sebagai komponen.
 *
 * Versi yang menyebabkan siklus atau melewati kedalaman maksimal TETAP
 * ditampilkan, tapi non-aktif dengan alasannya. Menyembunyikannya hanya
 * membuat user mencari-cari.
 */
export async function listUsableAsSubFormula(
  editedVersionId: string,
): Promise<SubFormulaCandidate[]> {
  const db = getDb();
  const ownerId = await getOwnerId();

  const { data, error } = await db
    .from("formula_versions")
    .select(
      `id, version_no, formula:formulas!inner(id, name, type, owner_id, is_archived)`,
    )
    .eq("formula.owner_id", ownerId)
    .eq("formula.is_archived", false)
    .order("version_no", { ascending: false });

  if (error) throw new Error(`Gagal memuat kandidat komponen: ${error.message}`);

  type Row = {
    id: string;
    version_no: number;
    formula: { id: string; name: string; type: string } | null;
  };

  const rows = ((data ?? []) as unknown as Row[]).filter(
    (r) => r.formula && r.id !== editedVersionId,
  );

  const graph = await loadSubFormulaGraph();
  const cache = new Map<string, CalcLine[]>();

  const out: SubFormulaCandidate[] = [];
  for (const row of rows) {
    const problem = checkCandidate(graph, editedVersionId, row.id);
    // Versi tanpa baris tidak berguna sebagai komponen, tapi tetap ditampilkan
    // supaya user tahu dia ada dan masih kosong.
    const lines = await resolveVersionLines(row.id, 1, cache);
    out.push({
      versionId: row.id,
      formulaId: row.formula!.id,
      label: versionLabel(row.formula!.name, row.version_no),
      formulaType: row.formula!.type,
      materialCount: lines.length,
      averageImpact: aggregateImpact(lines),
      lines,
      disabledReason: problem
        ? explainProblem(problem)
        : lines.length === 0
          ? "Versi ini masih kosong — isi dulu barisnya."
          : null,
    });
  }
  return out;
}

export type EditorLineSeed = {
  lineType: "raw_material" | "fo" | "sub_formula";
  /** id raw_material / fragrance_oil / formula_version sesuai lineType */
  refId: string | null;
  weightG: number;
  dilutionPct: number;
  solvent: string | null;
  note: string;
};

/**
 * Baris mentah untuk editor.
 *
 * Beda dari resolveVersionLines(): di sini yang dibutuhkan adalah ID komponen
 * yang dipilih, bukan nama dan impact-nya. Editor memakai ID untuk mencocokkan
 * ke daftar picker, lalu menghitung sendiri lewat toCalcLines() dengan rumus
 * yang sama seperti server.
 */
export async function getEditorLines(
  versionId: string,
): Promise<EditorLineSeed[]> {
  const db = getDb();
  const rows = await fetchLines(db, versionId);
  return rows.map((r) => ({
    lineType: r.line_type,
    refId:
      r.line_type === "raw_material"
        ? r.raw_material_id
        : r.line_type === "fo"
          ? r.fo_id
          : r.sub_formula_version_id,
    weightG: Number(r.weight_g),
    dilutionPct: Number(r.dilution_pct),
    solvent: r.solvent,
    note: r.note ?? "",
  }));
}
