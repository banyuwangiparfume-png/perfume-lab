import { strengthOf } from "./strength";
import type {
  ExpandedItem,
  FacetVector,
  Material,
  Tier,
} from "./types";

export type AromaShare = {
  facet: string;
  pct: number;
  contributors: { refId: string; name: string; pct: number }[];
};

/**
 * Pie dominasi aroma.
 *
 * Dua hal yang gampang tertukar dan menghasilkan angka yang salah:
 *
 *  1. Facet adalah KOMPOSISI KARAKTER bahan (ke arah mana baunya), bukan
 *     kekuatannya. Jadi vektor facet tiap bahan dibagi L1 dulu supaya tiap
 *     bahan menyumbang persis sebanyak kekuatannya — bukan lebih banyak hanya
 *     karena facet-nya kebetulan tercatat lebih banyak.
 *
 *  2. Bobotnya kekuatan (porsi × impact), bukan porsi berat. Indole 5% bisa
 *     menggeser pie lebih jauh daripada Hedione 20%.
 *
 * FO tidak punya facet, jadi tidak masuk sama sekali — dan pemanggil wajib
 * menyebutkan berapa persen formula yang tidak ikut dihitung.
 */
export function aromaShares(
  items: ExpandedItem[],
  materials: Map<string, Material>,
  tierFilter?: Tier,
): AromaShare[] {
  const share = new Map<string, number>();
  const byFacet = new Map<string, Map<string, number>>();

  for (const item of items) {
    if (tierFilter && item.tier !== tierFilter) continue;
    if (item.kind !== "material") continue;

    const material = materials.get(item.refId);
    if (!material) continue;

    const facets = material.facets;
    const l1 = Object.values(facets).reduce((a, b) => a + b, 0);
    if (!l1) continue; // bahan tanpa facet: dilaporkan terpisah, tidak dikarang

    const s = strengthOf(item, material);
    if (s <= 0) continue;

    for (const [facet, weight] of Object.entries(facets)) {
      const add = (s * weight) / l1;
      share.set(facet, (share.get(facet) ?? 0) + add);

      if (!byFacet.has(facet)) byFacet.set(facet, new Map());
      const c = byFacet.get(facet)!;
      c.set(item.refId, (c.get(item.refId) ?? 0) + add);
    }
  }

  const total = [...share.values()].reduce((a, b) => a + b, 0);
  if (!total) return [];

  return [...share.entries()]
    .map(([facet, value]) => ({
      facet,
      pct: (value / total) * 100,
      contributors: [...(byFacet.get(facet) ?? new Map()).entries()]
        .map(([refId, v]) => ({
          refId,
          name: materials.get(refId)?.name ?? refId,
          pct: (v / total) * 100,
        }))
        .sort((a, b) => b.pct - a.pct),
    }))
    .sort((a, b) => b.pct - a.pct);
}

export type AromaPie = {
  slices: AromaShare[];
  /** gabungan sisa di luar 6 terbesar */
  other: number;
  /** nama bahan yang facet-nya belum ada */
  missingFacets: string[];
  /** % formula yang tidak ikut dihitung (FO + bahan tanpa facet) */
  excludedPct: number;
};

/** Pie maksimal 7 irisan: 6 terbesar + "Lainnya". */
export function aromaPie(
  items: ExpandedItem[],
  materials: Map<string, Material>,
  tierFilter?: Tier,
  topN = 6,
): AromaPie {
  const all = aromaShares(items, materials, tierFilter);
  const slices = all.slice(0, topN);
  const other = all.slice(topN).reduce((a, s) => a + s.pct, 0);

  const scoped = tierFilter
    ? items.filter((i) => i.tier === tierFilter)
    : items;
  const missing = new Set<string>();
  let excluded = 0;
  let total = 0;

  for (const item of scoped) {
    total += item.productPct;
    if (item.kind === "fo") {
      excluded += item.productPct;
      continue;
    }
    const m = materials.get(item.refId);
    if (!m || Object.keys(m.facets).length === 0) {
      excluded += item.productPct;
      if (m) missing.add(m.name);
    }
  }

  return {
    slices,
    other,
    missingFacets: [...missing],
    excludedPct: total ? (excluded / total) * 100 : 0,
  };
}

/**
 * Vektor arah aroma satu tier, untuk mengukur sambungan antar tier.
 *
 * Beda dari pie: di sini facet TIDAK dibagi L1, karena yang dicari adalah arah
 * gabungan tier itu, lalu dinormalisasi L2 supaya cosine similarity antar tier
 * tidak bias ke tier yang kebetulan lebih besar porsinya.
 */
export function tierVector(
  items: ExpandedItem[],
  materials: Map<string, Material>,
  tier: Tier,
): FacetVector {
  const v: FacetVector = {};

  for (const item of items) {
    if (item.tier !== tier || item.kind !== "material") continue;
    const material = materials.get(item.refId);
    if (!material) continue;

    const s = strengthOf(item, material);
    if (s <= 0) continue;

    for (const [facet, weight] of Object.entries(material.facets)) {
      v[facet] = (v[facet] ?? 0) + s * weight;
    }
  }

  return normalizeL2(v);
}

export function normalizeL2(v: FacetVector): FacetVector {
  const len = Math.sqrt(
    Object.values(v).reduce((a, b) => a + b * b, 0),
  );
  if (!len) return {};
  const out: FacetVector = {};
  for (const [f, w] of Object.entries(v)) out[f] = w / len;
  return out;
}

/**
 * Facet yang paling menentukan watak sebuah bahan.
 *
 * Satu kata, bukan daftar. Di daftar bahan yang panjang, satu label yang bisa
 * dibaca sekilas jauh lebih berguna daripada vektor lengkap — dan vektor
 * lengkapnya memang sudah ada di pie aroma.
 *
 * Seri diputuskan lewat abjad supaya label sebuah bahan tidak berubah-ubah
 * antar render hanya karena urutan objeknya berbeda.
 */
export function dominantFacet(v: FacetVector): string | null {
  let best: string | null = null;
  let bestWeight = 0;

  for (const [key, weight] of Object.entries(v)) {
    if (weight <= 0) continue;
    if (weight > bestWeight || (weight === bestWeight && best && key < best)) {
      best = key;
      bestWeight = weight;
    }
  }

  return best;
}
