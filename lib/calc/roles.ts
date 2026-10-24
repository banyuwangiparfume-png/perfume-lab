import { aromaShares } from "./aroma";
import { itemsWithTier, linesAfterAdd } from "./simulate";
import type { ExpandedItem, FormulaContext, Material, Tier } from "./types";

/**
 * Perkiraan efek saran ke pie aroma, pada dosis awalnya.
 *
 * Yang dihitung cuma sumbangan bau bahan itu sendiri ke facet yang sama.
 * Sinergi — dua bahan barengan tercium lebih hidup dari jumlahnya — nyata
 * tapi tidak punya data terukur, jadi sengaja tidak dikarang di sini.
 */
export type RolePreview = { facet: string; beforePct: number; afterPct: number };

/**
 * Seberapa jauh satu facet bergeser kalau bahan ini ditambahkan lewat tombol
 * "+ Tier" — termasuk baris terbuka lain di tier itu yang ikut dibagi ulang
 * (lihat simulate.ts). Sebelumnya bahan cuma ditempel di atas formula, dan
 * angkanya meleset di formula yang barisnya belum dikunci.
 */
export function previewFacetShift(
  ctx: FormulaContext,
  items: ExpandedItem[],
  material: Material,
  dosePct: number,
  tier: Tier,
  facet: string,
  /** pie yang dibaca: seluruh formula (default), atau satu tier */
  scope: Tier = "all",
): RolePreview {
  const pctOf = (list: ExpandedItem[]) =>
    aromaShares(list, ctx.materials, scope === "all" ? undefined : scope).find(
      (s) => s.facet === facet,
    )?.pct ?? 0;

  const after = itemsWithTier(
    ctx,
    items,
    tier,
    linesAfterAdd(ctx, { kind: "raw_material", refId: material.id }, tier, dosePct),
  );
  return { facet, beforePct: pctOf(items), afterPct: pctOf(after) };
}
