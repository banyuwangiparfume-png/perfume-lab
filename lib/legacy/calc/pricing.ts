import type { RmPriceRow } from "../../supabase/database.types";

export type PriceTier = Pick<
  RmPriceRow,
  "tier_size" | "price_idr" | "effective_date"
>;

export type PricePick = {
  pricePerGram: number;
  tierGrams: number;
  effectiveDate: string;
};

/** price_per_gram = price_idr / tier_size */
export const pricePerGram = (t: PriceTier) =>
  t.tier_size > 0 ? Number(t.price_idr) / Number(t.tier_size) : 0;

/**
 * Memilih harga yang dipakai untuk kalkulasi.
 *
 * Aturannya: dari effective_date TERBARU, ambil tier terbesar yang masih
 * realistis dibeli (<= preferredTierG). Kalau semua tier lebih besar dari
 * preferensi, ambil yang terkecil — lebih baik harga tier kecil yang nyata
 * daripada tidak ada angka sama sekali.
 *
 * Mengembalikan null kalau bahan itu belum punya harga. Jangan pernah
 * menggantinya dengan 0 — biaya nol dan biaya tidak diketahui adalah dua hal
 * yang berbeda, dan aplikasi harus menyebutkannya.
 */
export function pickPrice(
  prices: PriceTier[],
  preferredTierG: number,
): PricePick | null {
  if (!prices.length) return null;

  const latest = prices.reduce(
    (a, b) => (b.effective_date > a.effective_date ? b : a),
    prices[0],
  ).effective_date;

  const current = prices.filter((p) => p.effective_date === latest);
  if (!current.length) return null;

  const affordable = current.filter(
    (p) => Number(p.tier_size) <= preferredTierG,
  );
  const pool = affordable.length ? affordable : current;
  const chosen = affordable.length
    ? pool.reduce((a, b) => (Number(b.tier_size) > Number(a.tier_size) ? b : a))
    : pool.reduce((a, b) => (Number(b.tier_size) < Number(a.tier_size) ? b : a));

  return {
    pricePerGram: pricePerGram(chosen),
    tierGrams: Number(chosen.tier_size),
    effectiveDate: chosen.effective_date,
  };
}

/** Tier termurah per gram — ditandai di tabel harga halaman detail bahan. */
export function cheapestTier(prices: PriceTier[]): PriceTier | null {
  if (!prices.length) return null;
  const latest = prices.reduce(
    (a, b) => (b.effective_date > a.effective_date ? b : a),
    prices[0],
  ).effective_date;
  const current = prices.filter((p) => p.effective_date === latest);
  if (!current.length) return null;
  return current.reduce((a, b) => (pricePerGram(b) < pricePerGram(a) ? b : a));
}
