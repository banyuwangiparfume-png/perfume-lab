import type { Material, Settings } from "./types";

/**
 * Tier harga dipilih dari ukuran batch, bukan dari jumlah yang dipakai.
 *
 * Alasannya praktis: kalau bikin 120 g, bahannya memang dibeli dalam ukuran
 * 100 g — jadi harga per gram yang realistis adalah harga tier 100 g, walau
 * yang dipakai cuma 2 g. Aturannya bisa diubah di /admin/settings dan
 * di-override per formula.
 */
export function pickTier(
  batchG: number,
  settings: Settings,
  override?: number | null,
): number {
  if (override != null && override > 0) return override;

  for (const rule of settings.priceTierRules) {
    if (rule.maxBatchExclusive == null || batchG < rule.maxBatchExclusive) {
      return rule.tier;
    }
  }
  return settings.priceTierRules.at(-1)?.tier ?? 10;
}

export type PricePick = {
  /** harga per gram pada tier yang benar-benar dipakai */
  pricePerUnit: number | null;
  usedTier: number | null;
  /** true kalau tier yang diminta kosong dan dipakai tier lain */
  fallback: boolean;
};

/**
 * Harga per gram sebuah bahan di tier tertentu.
 *
 * Kalau tier yang diminta kosong, turun ke tier LEBIH KECIL dulu — harganya
 * per gram lebih mahal, jadi HPP-nya konservatif. Lebih baik kemahalan di
 * atas kertas daripada margin yang ternyata tidak ada.
 */
export function pricePerUnit(material: Material, tier: number): PricePick {
  const tiers = Object.keys(material.prices)
    .map(Number)
    .filter((t) => t > 0 && Number.isFinite(material.prices[t]))
    .sort((a, b) => a - b);

  if (!tiers.length) {
    return { pricePerUnit: null, usedTier: null, fallback: false };
  }

  if (tiers.includes(tier)) {
    return {
      pricePerUnit: material.prices[tier] / tier,
      usedTier: tier,
      fallback: false,
    };
  }

  const smaller = tiers.filter((t) => t < tier).at(-1);
  const larger = tiers.find((t) => t > tier);
  const used = smaller ?? larger!;

  return {
    pricePerUnit: material.prices[used] / used,
    usedTier: used,
    fallback: true,
  };
}
