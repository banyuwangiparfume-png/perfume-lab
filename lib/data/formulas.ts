import "server-only";

import { getOwnerId } from "../owner";
import { getDb } from "../supabase/db";
import type {
  FormulaRow,
  FormulaSourceEnum,
  FormulaTypeEnum,
  FormulaVersionRow,
} from "../supabase/database.types";

export type FormulaFilter = {
  search?: string;
  type?: FormulaTypeEnum;
  source?: FormulaSourceEnum;
  targetCategory?: string;
  archived?: boolean;
};

export type FormulaCard = FormulaRow & {
  versionCount: number;
  latestVersion: FormulaVersionRow | null;
  evaluationCount: number;
};

export async function listFormulas(
  filter: FormulaFilter = {},
): Promise<FormulaCard[]> {
  const db = getDb();
  const ownerId = await getOwnerId();

  let q = db
    .from("formulas")
    .select("*, versions:formula_versions(*)")
    .eq("owner_id", ownerId)
    .eq("is_archived", filter.archived ?? false)
    .order("updated_at", { ascending: false });

  if (filter.type) q = q.eq("type", filter.type);
  if (filter.source) q = q.eq("source", filter.source);
  if (filter.targetCategory) q = q.eq("target_category", filter.targetCategory);
  if (filter.search) {
    const s = filter.search.replace(/[%,()]/g, " ").trim();
    if (s) q = q.ilike("name", `%${s}%`);
  }

  const { data, error } = await q;
  if (error) throw new Error(`Gagal memuat daftar formula: ${error.message}`);

  type Row = FormulaRow & { versions: FormulaVersionRow[] };
  const rows = (data ?? []) as unknown as Row[];

  const versionIds = rows.flatMap((f) => f.versions.map((v) => v.id));
  const evalCounts = await countEvaluationsByVersion(versionIds);

  return rows.map((f) => {
    const sorted = f.versions
      .slice()
      .sort((a, b) => b.version_no - a.version_no);
    const { versions: _versions, ...formula } = f;
    return {
      ...formula,
      versionCount: sorted.length,
      latestVersion: sorted[0] ?? null,
      evaluationCount: sorted.reduce(
        (a, v) => a + (evalCounts.get(v.id) ?? 0),
        0,
      ),
    };
  });
}

async function countEvaluationsByVersion(
  versionIds: string[],
): Promise<Map<string, number>> {
  if (!versionIds.length) return new Map();
  const db = getDb();
  const { data, error } = await db
    .from("evaluations")
    .select("formula_version_id")
    .in("formula_version_id", versionIds);
  if (error) throw new Error(`Gagal menghitung evaluasi: ${error.message}`);

  const out = new Map<string, number>();
  for (const row of data ?? []) {
    out.set(
      row.formula_version_id,
      (out.get(row.formula_version_id) ?? 0) + 1,
    );
  }
  return out;
}

export async function getFormula(id: string): Promise<
  | (FormulaRow & {
      versions: FormulaVersionRow[];
    })
  | null
> {
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
    versions: row.versions
      .slice()
      .sort((a, b) => b.version_no - a.version_no),
  };
}

/**
 * Versi yang dipilih secara default saat membuka detail formula:
 * versi tertinggi. Kalau user memilih versi lain lewat dropdown, pilihannya
 * yang menang.
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
  return versions.reduce((a, b) => (b.version_no > a.version_no ? b : a));
}

export async function formulaStats() {
  const db = getDb();
  const ownerId = await getOwnerId();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const since = monthStart.toISOString();

  const [formulas, versions, evaluations] = await Promise.all([
    db
      .from("formulas")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ownerId)
      .eq("is_archived", false),
    db
      .from("formula_versions")
      .select("id, formula:formulas!inner(owner_id)", {
        count: "exact",
        head: true,
      })
      .eq("formula.owner_id", ownerId)
      .gte("created_at", since),
    db
      .from("evaluations")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ownerId)
      .gte("created_at", since),
  ]);

  for (const r of [formulas, versions, evaluations]) {
    if (r.error) throw new Error(`Gagal memuat statistik: ${r.error.message}`);
  }

  return {
    formulaCount: formulas.count ?? 0,
    versionsThisMonth: versions.count ?? 0,
    evaluationsThisMonth: evaluations.count ?? 0,
  };
}

/** Formula yang baru diubah — daftar di dashboard. */
export async function recentFormulas(limit = 5): Promise<FormulaCard[]> {
  const all = await listFormulas();
  return all.slice(0, limit);
}

