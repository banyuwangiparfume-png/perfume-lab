import "server-only";

import { MAX_ACCORD_DEPTH } from "../calc/expand";
import type {
  BridgeRule,
  Fo,
  FormulaContext,
  Line,
  Material,
  Tier,
  Version,
} from "../calc/types";
import { getOwnerId } from "../owner";
import { mergeSettings } from "../settings";
import { getDb } from "../supabase/db";
import type { FormulaRow, FormulaVersionRow } from "../supabase/database.types";
import { suggestFunctionCategory, type FunctionSource } from "../calc/functions";

/**
 * Kategori fungsi efektif beserta asalnya.
 *
 * Urutannya: koreksi user, lalu data supplier, lalu tebakan dari family.
 * Tebakan selalu kalah, dan selalu bisa dibedakan.
 */
function resolveFunction(
  override: string | null,
  supplier: string | null,
  family: string | null,
): { value: string | null; source: FunctionSource } {
  if (override) return { value: override, source: "user" };
  if (supplier) return { value: supplier, source: "supplier" };
  return { value: suggestFunctionCategory(family), source: "derived" };
}


/**
 * "all" dipakai formula tanpa piramida, bukan sebagai kebiasaan satu bahan —
 * jadi untuk tier hint dia sama artinya dengan tidak ada.
 */
const tierOrNull = (t: Tier | null | undefined): Tier | null =>
  t && t !== "all" ? t : null;


type Db = ReturnType<typeof getDb>;

const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** Baris database -> baris kalkulasi. Persen apa adanya, gram tidak disimpan. */
function toLine(row: {
  id: string;
  tier: Tier;
  line_type: "raw_material" | "accord" | "fo";
  raw_material_id: string | null;
  accord_version_id: string | null;
  fo_id: string | null;
  pct: number;
  is_locked: boolean;
  user_dilution_pct: number;
  user_solvent_id: string | null;
  sort_order: number;
}): Line {
  return {
    id: row.id,
    tier: row.tier,
    kind: row.line_type,
    refId:
      row.line_type === "raw_material"
        ? (row.raw_material_id ?? "")
        : row.line_type === "accord"
          ? (row.accord_version_id ?? "")
          : (row.fo_id ?? ""),
    pct: num(row.pct),
    locked: row.is_locked,
    userDilutionPct: num(row.user_dilution_pct, 100),
    userSolventId: row.user_solvent_id,
    sortOrder: row.sort_order,
  };
}

async function fetchVersionWithLines(
  db: Db,
  versionId: string,
): Promise<{ version: FormulaVersionRow; formula: FormulaRow; lines: Line[] } | null> {
  const { data, error } = await db
    .from("formula_versions")
    // Nama foreign key-nya WAJIB disebut. formula_lines punya dua kolom yang
    // menunjuk ke formula_versions — formula_version_id (induknya) dan
    // accord_version_id (accord yang dipakai) — jadi tanpa petunjuk ini
    // PostgREST menolak: "more than one relationship was found".
    .select(
      `*, formula:formulas(*), lines:formula_lines!formula_lines_formula_version_id_fkey(*)`,
    )
    .eq("id", versionId)
    .maybeSingle();

  if (error) throw new Error(`Gagal memuat versi: ${error.message}`);
  if (!data) return null;

  const row = data as unknown as FormulaVersionRow & {
    formula: FormulaRow | null;
    lines: Parameters<typeof toLine>[0][];
  };
  if (!row.formula) return null;

  const lines = row.lines
    .map(toLine)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  return { version: row, formula: row.formula, lines };
}

function toVersion(
  row: FormulaVersionRow,
  formula: FormulaRow,
  lines: Line[],
): Version {
  const hasPyramid =
    formula.pyramid_mode && row.top_pct != null && row.mid_pct != null;
  return {
    id: row.id,
    name: `${formula.name} · v${row.version_no}`,
    batchG: num(row.batch_g, 10),
    pyramid: hasPyramid
      ? {
          top: num(row.top_pct),
          mid: num(row.mid_pct),
          base: num(row.base_pct),
        }
      : null,
    priceTierOverride:
      row.price_tier_override == null ? null : num(row.price_tier_override),
    lines,
  };
}

type MaterialRowWithRelations = {
  id: string;
  name: string;
  category: string | null;
  odor_impact: number | null;
  odor_impact_override: number | null;
  impact_basis: "as_sold" | "active";
  supplier_dilution_pct: number;
  supplier_solvent_id: string | null;
  family: string | null;
  function_category: string | null;
  function_category_override: string | null;
  note_tier_hint: Tier | null;
  note_tier_hint_override: Tier | null;
  is_bridge_candidate: boolean;
  is_solvent: boolean;
  facets: { facet_key: string; weight: number }[] | null;
};

function toMaterial(
  row: MaterialRowWithRelations,
  prices: Record<number, number>,
): Material {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    // Koreksi user selalu menang atas angka supplier.
    impact:
      row.odor_impact_override != null
        ? num(row.odor_impact_override)
        : row.odor_impact != null
          ? num(row.odor_impact)
          : null,
    impactBasis: row.impact_basis,
    supplierDilutionPct: num(row.supplier_dilution_pct, 100),
    supplierSolventId: row.supplier_solvent_id,
    facets: Object.fromEntries(
      (row.facets ?? []).map((f) => [f.facet_key, num(f.weight)]),
    ),
    // Koreksi user menang atas data supplier, sama seperti odor_impact.
    functionCategory: resolveFunction(
      row.function_category_override,
      row.function_category,
      row.family,
    ).value,
    functionSource: resolveFunction(
      row.function_category_override,
      row.function_category,
      row.family,
    ).source,
    noteTierHint: tierOrNull(
      row.note_tier_hint_override ?? row.note_tier_hint,
    ),
    isBridgeCandidate: row.is_bridge_candidate,
    isSolvent: row.is_solvent,
    prices,
  };
}

const MATERIAL_SELECT =
  "id, name, category, family, odor_impact, odor_impact_override, impact_basis, supplier_dilution_pct, supplier_solvent_id, function_category, function_category_override, note_tier_hint, note_tier_hint_override, is_bridge_candidate, is_solvent, facets:raw_material_facets(facet_key, weight)";

/** Harga terbaru per tier, dari view rm_current_prices. */
async function fetchPrices(
  db: Db,
  materialIds: string[],
): Promise<Map<string, Record<number, number>>> {
  const out = new Map<string, Record<number, number>>();
  if (!materialIds.length) return out;

  const { data, error } = await db
    .from("rm_current_prices")
    .select("raw_material_id, tier_size, price_idr")
    .in("raw_material_id", materialIds);

  if (error) throw new Error(`Gagal memuat harga: ${error.message}`);

  for (const row of data ?? []) {
    if (!row.raw_material_id || row.tier_size == null) continue;
    const bucket = out.get(row.raw_material_id) ?? {};
    bucket[num(row.tier_size)] = num(row.price_idr);
    out.set(row.raw_material_id, bucket);
  }
  return out;
}

export async function fetchMaterials(
  db: Db,
  ids: string[],
): Promise<Map<string, Material>> {
  const out = new Map<string, Material>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return out;

  const { data, error } = await db
    .from("raw_materials")
    .select(MATERIAL_SELECT)
    .in("id", unique);

  if (error) throw new Error(`Gagal memuat bahan: ${error.message}`);

  const prices = await fetchPrices(db, unique);
  for (const row of (data ?? []) as unknown as MaterialRowWithRelations[]) {
    out.set(row.id, toMaterial(row, prices.get(row.id) ?? {}));
  }
  return out;
}

/**
 * Mengumpulkan seluruh bahan yang dibutuhkan sebuah formula jadi satu objek
 * yang bisa dihitung tanpa menyentuh database lagi.
 *
 * Accord dimuat REKURSIF: formula yang memakai accord, yang di dalamnya ada
 * accord lain, tetap bisa dibentangkan sampai bahan dasarnya. Kedalaman
 * dibatasi di sini supaya kueri tidak meledak — pembatasan yang sama diulang
 * di expand() sebagai jaring kedua.
 *
 * Satu baris pelarut yang dipakai mengencerkan bahan juga ikut dimuat sebagai
 * Material, karena dia memang bahan: punya harga, punya facet, dan ikut
 * dihitung di komposisi.
 */
export async function loadFormulaContext(
  versionId: string,
): Promise<FormulaContext | null> {
  const db = getDb();
  const ownerId = await getOwnerId();

  const root = await fetchVersionWithLines(db, versionId);
  if (!root || root.formula.owner_id !== ownerId) return null;

  const accords = new Map<string, Version>();
  const materialIds = new Set<string>();
  const foIds = new Set<string>();

  const collect = (lines: Line[]) => {
    for (const l of lines) {
      if (l.kind === "raw_material") materialIds.add(l.refId);
      if (l.kind === "fo") foIds.add(l.refId);
      if (l.userSolventId) materialIds.add(l.userSolventId);
    }
  };
  collect(root.lines);

  // Telusuri accord tingkat demi tingkat.
  let frontier = root.lines
    .filter((l) => l.kind === "accord")
    .map((l) => l.refId);

  for (let depth = 1; depth <= MAX_ACCORD_DEPTH && frontier.length; depth++) {
    const next: string[] = [];
    for (const accordId of [...new Set(frontier)]) {
      if (accords.has(accordId)) continue;
      const sub = await fetchVersionWithLines(db, accordId);
      if (!sub) continue;
      accords.set(accordId, toVersion(sub.version, sub.formula, sub.lines));
      collect(sub.lines);
      next.push(
        ...sub.lines.filter((l) => l.kind === "accord").map((l) => l.refId),
      );
    }
    frontier = next;
  }

  const [materials, fos, bridgeRules, stock, settings] = await Promise.all([
    fetchMaterials(db, [...materialIds]),
    fetchFos(db, [...foIds]),
    fetchBridgeRules(db, ownerId),
    fetchStock(db, ownerId),
    fetchSettings(db, ownerId),
  ]);

  return {
    version: toVersion(root.version, root.formula, root.lines),
    materials,
    accords,
    fos,
    bridgeRules,
    stock,
    settings,
  };
}

async function fetchFos(db: Db, ids: string[]): Promise<Map<string, Fo>> {
  const out = new Map<string, Fo>();
  if (!ids.length) return out;
  const { data, error } = await db
    .from("fragrance_oils")
    .select("id, name, price_per_gram")
    .in("id", ids);
  if (error) throw new Error(`Gagal memuat FO: ${error.message}`);
  for (const row of data ?? []) {
    out.set(row.id, {
      id: row.id,
      name: row.name,
      pricePerGram:
        row.price_per_gram == null ? null : num(row.price_per_gram),
    });
  }
  return out;
}

async function fetchBridgeRules(
  db: Db,
  ownerId: string,
): Promise<BridgeRule[]> {
  const { data, error } = await db
    .from("bridge_rules")
    .select("id, raw_material_id, facet_a, facet_b, note, source")
    .or(`owner_id.is.null,owner_id.eq.${ownerId}`);
  if (error) throw new Error(`Gagal memuat aturan jembatan: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    materialId: r.raw_material_id,
    facetA: r.facet_a,
    facetB: r.facet_b,
    note: r.note,
    source: r.source,
  }));
}

async function fetchStock(db: Db, ownerId: string): Promise<Set<string>> {
  const { data, error } = await db
    .from("user_stock")
    .select("raw_material_id, fragrance_oil_id")
    .eq("owner_id", ownerId);
  if (error) throw new Error(`Gagal memuat stok: ${error.message}`);
  // Raw material dan FO dalam satu himpunan: id-nya acak dan pertanyaannya
  // sama — ada di rak atau tidak.
  return new Set(
    (data ?? [])
      .flatMap((r) => [r.raw_material_id, r.fragrance_oil_id])
      .filter((v): v is string => !!v),
  );
}

async function fetchSettings(db: Db, ownerId: string) {
  const { data, error } = await db
    .from("app_settings")
    .select("settings")
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw new Error(`Gagal memuat setting: ${error.message}`);
  return mergeSettings(
    (data?.settings ?? null) as Parameters<typeof mergeSettings>[0],
  );
}

/**
 * Seluruh bahan kandidat jembatan, untuk panel bridger.
 *
 * Dimuat terpisah dari konteks formula karena isinya ratusan bahan yang tidak
 * ada hubungannya dengan formula yang sedang dibuka — menariknya di setiap
 * pemuatan formula akan memperlambat editor tanpa alasan.
 */
export async function loadBridgeCandidates(): Promise<Map<string, Material>> {
  const db = getDb();
  const ownerId = await getOwnerId();

  const { data, error } = await db
    .from("raw_materials")
    .select(MATERIAL_SELECT)
    .or(`owner_id.is.null,owner_id.eq.${ownerId}`)
    .eq("is_active", true)
    .eq("is_bridge_candidate", true);

  if (error) throw new Error(`Gagal memuat kandidat jembatan: ${error.message}`);

  const rows = (data ?? []) as unknown as MaterialRowWithRelations[];
  const prices = await fetchPrices(
    db,
    rows.map((r) => r.id),
  );

  const out = new Map<string, Material>();
  for (const row of rows) {
    out.set(row.id, toMaterial(row, prices.get(row.id) ?? {}));
  }
  return out;
}
