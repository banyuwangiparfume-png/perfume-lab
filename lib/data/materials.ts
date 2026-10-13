import "server-only";

import { pickPrice, type PriceTier } from "../legacy/calc/pricing";
import { PRICING } from "../constants";
import { getOwnerId } from "../owner";
import { getDb } from "../supabase/db";
import type {
  FunctionCategoryEnum,
  RawMaterialRow,
  RmPriceRow,
} from "../supabase/database.types";

export type MaterialWithPrices = RawMaterialRow & {
  prices: PriceTier[];
};

export type MaterialListItem = MaterialWithPrices & {
  /** odor_impact_override ?? odor_impact — boleh null */
  effectiveImpact: number | null;
  pricePerGram: number | null;
  priceTierG: number | null;
};

const PRICE_SELECT = "tier_size, price_idr, effective_date";

export const effectiveImpact = (m: {
  odor_impact: number | null;
  odor_impact_override: number | null;
}): number | null =>
  m.odor_impact_override != null
    ? Number(m.odor_impact_override)
    : m.odor_impact != null
      ? Number(m.odor_impact)
      : null;

function decorate(m: MaterialWithPrices): MaterialListItem {
  const picked = pickPrice(m.prices, PRICING.preferredTierG);
  return {
    ...m,
    effectiveImpact: effectiveImpact(m),
    pricePerGram: picked?.pricePerGram ?? null,
    priceTierG: picked?.tierGrams ?? null,
  };
}

export type MaterialFilter = {
  search?: string;
  family?: string;
  functionCategory?: FunctionCategoryEnum;
  /** "yes" = punya data impact · "no" = belum */
  hasImpact?: "yes" | "no";
  includeInactive?: boolean;
};

/**
 * Master bahan yang terlihat oleh user: baris global (owner_id null, hasil
 * import pricelist) ditambah baris miliknya sendiri.
 */
export async function listMaterials(
  filter: MaterialFilter = {},
): Promise<MaterialListItem[]> {
  const db = getDb();
  const ownerId = await getOwnerId();

  let q = db
    .from("raw_materials")
    .select(`*, prices:rm_prices(${PRICE_SELECT})`)
    .or(`owner_id.is.null,owner_id.eq.${ownerId}`)
    .order("name");

  if (!filter.includeInactive) q = q.eq("is_active", true);
  if (filter.family) q = q.eq("family", filter.family);
  if (filter.functionCategory)
    q = q.eq("function_category", filter.functionCategory);

  if (filter.search) {
    const s = filter.search.replace(/[%,()]/g, " ").trim();
    if (s) {
      q = q.or(
        `name.ilike.%${s}%,synonym.ilike.%${s}%,cas_number.ilike.%${s}%`,
      );
    }
  }

  const { data, error } = await q;
  if (error) throw new Error(`Gagal memuat master bahan: ${error.message}`);

  let rows = (data ?? []).map((m) =>
    decorate(m as unknown as MaterialWithPrices),
  );

  // Filter "punya data impact" dilakukan di aplikasi karena nilainya turunan
  // dari dua kolom (override lebih dulu, baru nilai supplier).
  if (filter.hasImpact === "yes")
    rows = rows.filter((r) => r.effectiveImpact != null);
  if (filter.hasImpact === "no")
    rows = rows.filter((r) => r.effectiveImpact == null);

  return rows;
}

export async function getMaterial(
  id: string,
): Promise<(MaterialListItem & { allPrices: RmPriceRow[] }) | null> {
  const db = getDb();
  const { data, error } = await db
    .from("raw_materials")
    .select("*, prices:rm_prices(*)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Gagal memuat bahan: ${error.message}`);
  if (!data) return null;

  const allPrices = ((data as unknown as { prices: RmPriceRow[] }).prices ?? [])
    .slice()
    .sort(
      (a, b) =>
        b.effective_date.localeCompare(a.effective_date) ||
        Number(a.tier_size) - Number(b.tier_size),
    );

  return { ...decorate(data as unknown as MaterialWithPrices), allPrices };
}

export async function getMaterialsByIds(
  ids: string[],
): Promise<Map<string, MaterialListItem>> {
  if (!ids.length) return new Map();
  const db = getDb();
  const { data, error } = await db
    .from("raw_materials")
    .select(`*, prices:rm_prices(${PRICE_SELECT})`)
    .in("id", ids);

  if (error) throw new Error(`Gagal memuat bahan: ${error.message}`);
  return new Map(
    (data ?? []).map((m) => {
      const item = decorate(m as unknown as MaterialWithPrices);
      return [item.id, item];
    }),
  );
}

/**
 * Kandidat Bridger — dibuka dari tombol aksi di rules checker saat formula
 * mencakup banyak family tapi tidak punya penyambung.
 */
export async function listBridgerCandidates(): Promise<MaterialListItem[]> {
  return listMaterials({ functionCategory: "bridger" });
}

/** Statistik untuk stat tile dashboard dan badge halaman admin. */
export async function materialStats() {
  const db = getDb();
  const ownerId = await getOwnerId();
  const { data, error } = await db
    .from("raw_materials")
    .select("odor_impact, odor_impact_override")
    .or(`owner_id.is.null,owner_id.eq.${ownerId}`)
    .eq("is_active", true);

  if (error) throw new Error(`Gagal menghitung bahan: ${error.message}`);
  const rows = data ?? [];
  return {
    total: rows.length,
    withoutImpact: rows.filter((r) => effectiveImpact(r) == null).length,
    overridden: rows.filter((r) => r.odor_impact_override != null).length,
  };
}

/** Daftar family yang benar-benar ada di data, untuk isi dropdown filter. */
export async function listFamilies(): Promise<string[]> {
  const db = getDb();
  const ownerId = await getOwnerId();
  const { data, error } = await db
    .from("raw_materials")
    .select("family")
    .or(`owner_id.is.null,owner_id.eq.${ownerId}`)
    .not("family", "is", null);

  if (error) throw new Error(`Gagal memuat family: ${error.message}`);
  return [...new Set((data ?? []).map((r) => r.family as string))].sort();
}

/** Formula mana saja yang memakai bahan ini — untuk melihat kebiasaan sendiri. */
export async function materialUsage(materialId: string) {
  const db = getDb();
  const ownerId = await getOwnerId();
  const { data, error } = await db
    .from("formula_lines")
    .select(
      `weight_g, dilution_pct,
       version:formula_versions!formula_lines_formula_version_id_fkey(
         id, version_no,
         formula:formulas(id, name, owner_id, is_archived)
       )`,
    )
    .eq("raw_material_id", materialId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Gagal memuat pemakaian bahan: ${error.message}`);

  type UsageRow = {
    weight_g: number;
    dilution_pct: number;
    version: {
      id: string;
      version_no: number;
      formula: { id: string; name: string; owner_id: string; is_archived: boolean } | null;
    } | null;
  };

  return (data as unknown as UsageRow[])
    .filter((r) => r.version?.formula?.owner_id === ownerId)
    .map((r) => ({
      formulaId: r.version!.formula!.id,
      formulaName: r.version!.formula!.name,
      versionId: r.version!.id,
      versionNo: r.version!.version_no,
      weightG: Number(r.weight_g),
      dilutionPct: Number(r.dilution_pct),
      isArchived: r.version!.formula!.is_archived,
    }));
}
