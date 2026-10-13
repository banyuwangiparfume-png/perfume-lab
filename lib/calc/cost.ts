import { mergeByMaterial } from "./expand";
import { pickTier, pricePerUnit } from "./price";
import type { ExpandedItem, FormulaContext } from "./types";

export type CostRow = {
  refId: string;
  name: string;
  grams: number;
  pricePerG: number | null;
  cost: number | null;
  sharePct: number;
  fallback: boolean;
  usedTier: number | null;
};

export type CostBreakdown = {
  tier: number;
  rows: CostRow[];
  total: number;
  perGram: number;
  per100g: number;
  /** nama bahan yang harganya belum ada — total di atas belum lengkap */
  missing: string[];
  fallbackCount: number;
};

/**
 * Biaya satu batch.
 *
 * Dua hal yang menentukan angkanya benar atau tidak:
 *
 *  1. Yang dihargai adalah MASSA PRODUK, bukan massa aktif. "Indole 50 BB"
 *     dibeli sebagai cairan encer — harga per gramnya sudah harga cairan itu,
 *     jadi pelarut bawaannya tidak dihargai lagi terpisah.
 *
 *  2. Pelarut dari dilusi user DIHARGAI, karena dia memang dibeli dan dituang.
 *     Itu yang membuat BB muncul 14,5% di biaya, bukan 10%.
 */
export function costBreakdown(
  ctx: FormulaContext,
  items: ExpandedItem[],
): CostBreakdown {
  const tier = pickTier(
    ctx.version.batchG,
    ctx.settings,
    ctx.version.priceTierOverride,
  );
  const merged = mergeByMaterial(items);
  const rows: CostRow[] = [];
  const missing: string[] = [];
  let total = 0;
  let fallbackCount = 0;

  for (const [refId, m] of merged) {
    const grams = (m.productPct / 100) * ctx.version.batchG;

    if (m.kind === "fo") {
      const fo = ctx.fos.get(refId);
      const perG = fo?.pricePerGram ?? null;
      const cost = perG == null ? null : grams * perG;
      if (cost == null) missing.push(fo?.name ?? "(FO)");
      else total += cost;
      rows.push({
        refId,
        name: fo?.name ?? "(FO)",
        grams,
        pricePerG: perG,
        cost,
        sharePct: 0,
        fallback: false,
        usedTier: null,
      });
      continue;
    }

    const material = ctx.materials.get(refId);
    if (!material) {
      missing.push("(bahan tidak ditemukan)");
      continue;
    }

    const pick = pricePerUnit(material, tier);
    const cost = pick.pricePerUnit == null ? null : grams * pick.pricePerUnit;
    if (cost == null) missing.push(material.name);
    else total += cost;
    if (pick.fallback) fallbackCount++;

    rows.push({
      refId,
      name: material.name,
      grams,
      pricePerG: pick.pricePerUnit,
      cost,
      sharePct: 0,
      fallback: pick.fallback,
      usedTier: pick.usedTier,
    });
  }

  for (const r of rows) {
    r.sharePct = total && r.cost != null ? (r.cost / total) * 100 : 0;
  }
  rows.sort((a, b) => (b.cost ?? -1) - (a.cost ?? -1));

  const perGram = ctx.version.batchG ? total / ctx.version.batchG : 0;

  return {
    tier,
    rows,
    total,
    perGram,
    per100g: perGram * 100,
    missing: [...new Set(missing)],
    fallbackCount,
  };
}
