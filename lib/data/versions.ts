import "server-only";

import { analyze, type Analysis } from "../calc/analyze";
import type { FormulaContext, Line, Tier } from "../calc/types";
import { getOwnerId } from "../owner";
import { getDb } from "../supabase/db";
import type { FormulaRow, FormulaVersionRow } from "../supabase/database.types";
import { loadFormulaContext } from "./loadFormulaContext";

/** Label versi yang dipakai di mana-mana: "Jasmine Accord · v3". */
export const versionLabel = (formulaName: string, versionNo: number) =>
  versionNo === 0 ? `${formulaName} · draf` : `${formulaName} · v${versionNo}`;

/**
 * Seluruh versi sebuah formula.
 *
 * Draf kerja (version_no = 0) dikeluarkan secara default: dia bukan versi, dia
 * papan tulis yang sedang dipakai. Menampilkannya di riwayat cuma
 * membingungkan.
 */
export async function listVersions(
  formulaId: string,
  opts: { includeDraft?: boolean } = {},
): Promise<FormulaVersionRow[]> {
  const db = getDb();
  let q = db
    .from("formula_versions")
    .select("*")
    .eq("formula_id", formulaId)
    .order("version_no", { ascending: false });

  if (!opts.includeDraft) q = q.gt("version_no", 0);

  const { data, error } = await q;
  if (error) throw new Error(`Gagal memuat daftar versi: ${error.message}`);
  return data ?? [];
}

/** Draf kerja sebuah formula — yang dibuka editor. */
export async function getDraftVersion(
  formulaId: string,
): Promise<FormulaVersionRow | null> {
  const db = getDb();
  const { data, error } = await db
    .from("formula_versions")
    .select("*")
    .eq("formula_id", formulaId)
    .eq("version_no", 0)
    .maybeSingle();
  if (error) throw new Error(`Gagal memuat draf: ${error.message}`);
  return data ?? null;
}

export type VersionDetail = {
  formula: FormulaRow;
  version: FormulaVersionRow;
  versions: FormulaVersionRow[];
  context: FormulaContext;
  analysis: Analysis;
  evaluationCount: number;
};

/**
 * Versi lengkap beserta seluruh analisanya.
 *
 * Analisanya dihitung dengan fungsi yang SAMA PERSIS dengan panel live di
 * editor — bukan jalur kedua yang bisa menghasilkan angka berbeda tanpa ada
 * yang sadar.
 */
export async function getVersionDetail(
  versionId: string,
  opts: { skipBridges?: boolean } = {},
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

  const [context, versions, evaluationCount] = await Promise.all([
    loadFormulaContext(versionId),
    listVersions(version.formula_id),
    countEvaluations(versionId),
  ]);
  if (!context) return null;

  return {
    formula,
    version,
    versions,
    context,
    analysis: analyze(context, { skipBridges: opts.skipBridges }),
    evaluationCount,
  };
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

export type AccordOption = {
  versionId: string;
  formulaId: string;
  label: string;
  materialCount: number;
  /** baris penyusunnya, supaya panel live di editor bisa membentangkan
   *  accord ini tanpa bolak-balik ke server */
  lines: Line[];
  /** terisi = tidak boleh dipakai, dan ini alasannya untuk tooltip */
  disabledReason: string | null;
};

/**
 * Accord yang bisa dipakai sebagai bahan di formula lain.
 *
 * Hanya formula berkategori `accord`, dan hanya VERSI TERSIMPAN — bukan draf.
 * Draf berubah tiap detik; formula yang memakainya akan ikut berubah tanpa
 * pemiliknya sadar, dan itu persis yang membuat formula tidak bisa
 * direproduksi.
 *
 * Versi yang tidak boleh dipakai tetap ditampilkan tapi non-aktif dengan
 * alasannya — menyembunyikannya cuma membuat user mencari-cari.
 */
export async function listAccordsForPicker(
  excludeFormulaId?: string,
): Promise<AccordOption[]> {
  const db = getDb();
  const ownerId = await getOwnerId();

  const { data, error } = await db
    .from("formula_versions")
    .select(
      `id, version_no,
       formula:formulas!inner(id, name, category, owner_id, is_archived),
       lines:formula_lines(*)`,
    )
    .gt("version_no", 0)
    .eq("formula.owner_id", ownerId)
    .eq("formula.category", "accord")
    .eq("formula.is_archived", false)
    .order("version_no", { ascending: false });

  if (error) throw new Error(`Gagal memuat daftar accord: ${error.message}`);

  type Row = {
    id: string;
    version_no: number;
    formula: { id: string; name: string } | null;
    lines: {
      id: string; tier: Tier; line_type: "raw_material" | "accord" | "fo";
      raw_material_id: string | null; accord_version_id: string | null;
      fo_id: string | null; pct: number; is_locked: boolean;
      user_dilution_pct: number; user_solvent_id: string | null; sort_order: number;
    }[];
  };

  // Satu baris per formula: versi tersimpan tertinggi.
  const latest = new Map<string, Row>();
  for (const row of (data ?? []) as unknown as Row[]) {
    if (!row.formula) continue;
    const prev = latest.get(row.formula.id);
    if (!prev || row.version_no > prev.version_no) {
      latest.set(row.formula.id, row);
    }
  }

  return [...latest.values()].map((row) => ({
    versionId: row.id,
    formulaId: row.formula!.id,
    label: versionLabel(row.formula!.name, row.version_no),
    materialCount: row.lines.length,
    lines: row.lines
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((l) => ({
        id: l.id,
        tier: l.tier,
        kind: l.line_type,
        refId:
          l.line_type === "raw_material"
            ? (l.raw_material_id ?? "")
            : l.line_type === "accord"
              ? (l.accord_version_id ?? "")
              : (l.fo_id ?? ""),
        pct: Number(l.pct),
        locked: l.is_locked,
        userDilutionPct: Number(l.user_dilution_pct),
        userSolventId: l.user_solvent_id,
        sortOrder: l.sort_order,
      })),
    disabledReason:
      row.formula!.id === excludeFormulaId
        ? "Formula tidak bisa memakai dirinya sendiri sebagai accord."
        : row.lines.length === 0
          ? "Versi ini masih kosong — isi dulu bahannya."
          : null,
  }));
}
