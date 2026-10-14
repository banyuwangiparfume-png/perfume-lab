import type { Tier } from "./calc/types";

/**
 * Metadata tier. Warnanya sama dengan token di globals.css — dipakai di header
 * kartu tier, visual piramida, dan toggle pie per tier, supaya tier yang sama
 * selalu terbaca sebagai warna yang sama.
 */
export const TIER_META: Record<
  Tier,
  { label: string; color: string; soft: string; hint: string }
> = {
  top: {
    label: "Top",
    color: "var(--tier-top)",
    soft: "var(--tier-top-soft)",
    hint: "Biasanya diisi citrus, green, atau aldehyde.",
  },
  mid: {
    label: "Mid",
    color: "var(--tier-mid)",
    soft: "var(--tier-mid-soft)",
    hint: "Jantung formula — floral, fruity, spicy.",
  },
  base: {
    label: "Base",
    color: "var(--tier-base)",
    soft: "var(--tier-base-soft)",
    hint: "Woody, musk, amber, resin. Yang bertahan paling lama.",
  },
  all: {
    label: "Bahan",
    color: "var(--tier-all)",
    soft: "var(--tier-all-soft)",
    hint: "Mode piramida mati — semua bahan dalam satu daftar.",
  },
};

export const PYRAMID_TIERS: Tier[] = ["top", "mid", "base"];

/** Preset piramida yang sering dipakai, dari file 02 §3. */
export const PYRAMID_PRESETS: { top: number; mid: number; base: number }[] = [
  { top: 15, mid: 25, base: 60 },
  { top: 20, mid: 30, base: 50 },
  { top: 10, mid: 30, base: 60 },
  { top: 25, mid: 35, base: 40 },
];

/** Preset ukuran batch — dari RnD kecil sampai produksi. */
export const BATCH_PRESETS = [3, 10, 30, 50, 100] as const;

export const facetColor = (key: string) => `var(--facet-${key}, var(--facet-other))`;

/**
 * Nama baca facet. Kunci mentahnya ("white", "resin") cukup untuk perhitungan
 * tapi menyesatkan di layar: "White" sendirian tidak berarti apa-apa, "White
 * floral" langsung terbaca.
 *
 * Sumber aslinya tabel `facets` di database, dan layar editor memang memakai
 * yang dari sana. Salinan ini untuk tempat yang tidak membawa data itu —
 * panel analisa dipakai juga di halaman baca formula. Supaya dua sumber ini
 * tidak diam-diam menyimpang, isinya diikat ke `seed/facet-keywords.json`
 * lewat test.
 */
export const FACET_LABELS: Record<string, string> = {
  citrus: "Citrus",
  green: "Green",
  aromatic: "Aromatik/Herbal",
  fruity: "Fruity",
  floral: "Floral",
  rose: "Rose",
  white: "White floral",
  powdery: "Powdery/Iris",
  clean: "Clean/Aldehydic",
  aquatic: "Marine/Ozonic",
  spicy: "Spicy",
  woody: "Woody",
  earthy: "Earthy/Mossy",
  amber: "Amber",
  resin: "Balsamic/Resin",
  gourmand: "Sweet/Gourmand",
  creamy: "Creamy/Lactonic",
  musk: "Musk",
  animalic: "Animalic/Leather",
  smoky: "Smoky/Tobacco",
};

export const facetLabel = (key: string) => FACET_LABELS[key] ?? key;

/** Menerima koma desimal — "7,5" sama sahnya dengan "7.5". */
export function parseDecimal(input: string): number | null {
  const s = input.trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
