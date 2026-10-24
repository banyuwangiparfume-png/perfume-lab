import { aromaShares } from "./aroma";
import { syntheticItem } from "./synthetic";
import type { ExpandedItem, Material, Tier } from "./types";

/**
 * Perkiraan efek saran ke pie aroma SELURUH formula, pada dosis awalnya.
 *
 * Yang dihitung cuma sumbangan bau bahan itu sendiri ke facet yang sama.
 * Sinergi — dua bahan barengan tercium lebih hidup dari jumlahnya — nyata
 * tapi tidak punya data terukur, jadi sengaja tidak dikarang di sini.
 */
export type RolePreview = { facet: string; beforePct: number; afterPct: number };

/**
 * Seberapa jauh satu facet di pie seluruh formula bergeser kalau bahan ini
 * ditambahkan pada dosis tertentu.
 *
 * Baris lain tidak diskalakan turun. Untuk dosis 0,1–5% bedanya dengan
 * menormalisasi ulang ke 100% kecil, dan pie memang membaca porsi relatif.
 */
export function previewFacetShift(
  items: ExpandedItem[],
  materials: Map<string, Material>,
  material: Material,
  dosePct: number,
  tier: Tier,
  facet: string,
  /** pie yang dibaca: seluruh formula (default), atau satu tier */
  scope: Tier = "all",
): RolePreview {
  const pctOf = (list: ExpandedItem[]) =>
    aromaShares(list, materials, scope === "all" ? undefined : scope).find(
      (s) => s.facet === facet,
    )?.pct ?? 0;

  return {
    facet,
    beforePct: pctOf(items),
    afterPct: pctOf([...items, syntheticItem(material, dosePct, tier)]),
  };
}
