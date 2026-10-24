import type { ExpandedItem, Material, Tier } from "./types";

/**
 * Item sintetis untuk pratinjau "kalau bahan ini ditambahkan": dilusi
 * supplier dan basis kekuatan mengikuti aturan yang sama persis dengan
 * expand(), supaya angka pratinjau sama dengan angka setelah benar-benar
 * ditambahkan.
 *
 * Baris lain tidak diskalakan turun. Untuk dosis 0,1–5% bedanya dengan
 * menormalisasi ulang ke 100% kecil, dan semua pembacanya (pie, arah tier)
 * memakai porsi relatif.
 */
export function syntheticItem(
  material: Material,
  dosePct: number,
  tier: Tier,
): ExpandedItem {
  const activePct = (dosePct * material.supplierDilutionPct) / 100;
  return {
    kind: "material",
    refId: material.id,
    tier,
    role: "ingredient",
    productPct: dosePct,
    activePct,
    strengthBasisPct: material.impactBasis === "active" ? activePct : dosePct,
    via: [],
    sourceLineId: "__preview",
  };
}
