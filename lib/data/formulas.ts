import "server-only";

import { getOwnerId } from "../owner";
import { getDb } from "../supabase/db";
import type {
  FormulaCategoryEnum,
  FormulaRow,
  FormulaVersionRow,
} from "../supabase/database.types";

export type FormulaFilter = {
  search?: string;
  category?: FormulaCategoryEnum;
  targetFamily?: string;
  archived?: boolean;
};

export type FormulaCard = FormulaRow & {
  /** jumlah versi TERSIMPAN; draf tidak dihitung */
  versionCount: number;
  latestVersion: FormulaVersionRow | null;
  draft: FormulaVersionRow | null;
  lineCount: number;
};

export async function listFormulas(
  filter: FormulaFilter = {},
): Promise<FormulaCard[]> {
  const db = getDb();
  const ownerId = await getOwnerId();

  let q = db
    .from("formulas")
    .select("*, versions:formula_versions(*, lines:formula_lines(id))")
    .eq("owner_id", ownerId)
    .eq("is_archived", filter.archived ?? false)
    .order("updated_at", { ascending: false });

  if (filter.category) q = q.eq("category", filter.category);
  if (filter.targetFamily) q = q.eq("target_family", filter.targetFamily);
  if (filter.search) {
    const s = filter.search.replace(/[%,()]/g, " ").trim();
    if (s) q = q.ilike("name", `%${s}%`);
  }

  const { data, error } = await q;
  if (error) throw new Error(`Gagal memuat daftar formula: ${error.message}`);

  type Row = FormulaRow & {
    versions: (FormulaVersionRow & { lines: { id: string }[] })[];
  };

  return ((data ?? []) as unknown as Row[]).map((f) => {
    const { versions, ...formula } = f;
    const saved = versions
      .filter((v) => v.version_no > 0)
      .sort((a, b) => b.version_no - a.version_no);
    const draft = versions.find((v) => v.version_no === 0) ?? null;

    // Jumlah bahan diambil dari apa yang sedang dikerjakan: draf kalau ada
    // isinya, kalau tidak versi tersimpan terakhir.
    const counted =
      draft && draft.lines.length ? draft : (saved[0] ?? draft);

    return {
      ...formula,
      versionCount: saved.length,
      latestVersion: saved[0] ?? null,
      draft,
      lineCount: counted?.lines.length ?? 0,
    };
  });
}

export async function getFormula(
  id: string,
): Promise<(FormulaRow & { versions: FormulaVersionRow[] }) | null> {
  const db = getDb();
  const ownerId = await getOwnerId();

  const { data, error } = await db
    .from("formulas")
    .select("*, versions:formula_versions(*)")
    .eq("id", id)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error) throw new Error(`Gagal memuat formula: ${error.message}`);
  if (!data) return null;

  const row = data as unknown as FormulaRow & { versions: FormulaVersionRow[] };
  return {
    ...row,
    versions: row.versions.slice().sort((a, b) => b.version_no - a.version_no),
  };
}

/**
 * Versi yang dibuka saat user masuk ke detail formula: versi tersimpan
 * tertinggi, atau draf kalau belum ada versi tersimpan sama sekali.
 */
export function pickVersion(
  versions: FormulaVersionRow[],
  requestedId?: string,
): FormulaVersionRow | null {
  if (!versions.length) return null;
  if (requestedId) {
    const found = versions.find((v) => v.id === requestedId);
    if (found) return found;
  }
  const saved = versions.filter((v) => v.version_no > 0);
  if (saved.length) {
    return saved.reduce((a, b) => (b.version_no > a.version_no ? b : a));
  }
  return versions.find((v) => v.version_no === 0) ?? versions[0];
}

export async function formulaStats() {
  const db = getDb();
  const ownerId = await getOwnerId();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const since = monthStart.toISOString();

  const [fragrance, accord, evaluations] = await Promise.all([
    db
      .from("formulas")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ownerId)
      .eq("is_archived", false)
      .eq("category", "fragrance"),
    db
      .from("formulas")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ownerId)
      .eq("is_archived", false)
      .eq("category", "accord"),
    db
      .from("evaluations")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ownerId)
      .gte("created_at", since),
  ]);

  for (const r of [fragrance, accord, evaluations]) {
    if (r.error) throw new Error(`Gagal memuat statistik: ${r.error.message}`);
  }

  return {
    fragranceCount: fragrance.count ?? 0,
    accordCount: accord.count ?? 0,
    evaluationsThisMonth: evaluations.count ?? 0,
  };
}

/** Formula yang baru diubah — kartu "Terakhir diedit" di dashboard. */
export async function recentFormulas(limit = 5): Promise<FormulaCard[]> {
  return (await listFormulas()).slice(0, limit);
}

/** Accord ini dipakai di formula mana saja — ditampilkan di detail accord. */
export async function accordUsage(formulaId: string) {
  const db = getDb();
  const ownerId = await getOwnerId();

  const { data: versions } = await db
    .from("formula_versions")
    .select("id")
    .eq("formula_id", formulaId);
  const ids = (versions ?? []).map((v) => v.id);
  if (!ids.length) return [];

  const { data, error } = await db
    .from("formula_lines")
    .select(
      `accord_version_id,
       version:formula_versions!formula_lines_formula_version_id_fkey(
         id, version_no, formula:formulas(id, name, owner_id)
       )`,
    )
    .in("accord_version_id", ids);

  if (error) throw new Error(`Gagal memuat pemakaian accord: ${error.message}`);

  type Row = {
    version: {
      id: string;
      version_no: number;
      formula: { id: string; name: string; owner_id: string } | null;
    } | null;
  };

  const seen = new Map<string, { formulaId: string; name: string }>();
  for (const row of (data ?? []) as unknown as Row[]) {
    const f = row.version?.formula;
    if (!f || f.owner_id !== ownerId) continue;
    if (f.id === formulaId) continue;
    seen.set(f.id, { formulaId: f.id, name: f.name });
  }
  return [...seen.values()];
}
