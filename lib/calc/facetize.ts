import { normalizeL2 } from "./aroma";
import type { FacetVector, Tier } from "./types";

/**
 * Menghitung vektor facet sebuah bahan dari teks Odour Profile supplier.
 *
 * Dipakai saat import pricelist, bukan saat menghitung formula. Hasilnya bisa
 * ditimpa admin (`facets_manual`), dan koreksi itu tidak pernah ditimpa balik
 * oleh import berikutnya.
 *
 * Yang perlu dipahami soal angka yang keluar dari sini: dia **arah karakter**,
 * bukan kekuatan. Bergamot dan Hedione bisa sama-sama punya sisi citrus, tapi
 * seberapa keras baunya ditentukan `impact`, bukan facet.
 */

export type FacetKeywordConfig = {
  version: number;
  facets: Record<string, { label: string; keywords: string[] }>;
  family_to_facet: Record<string, string>;
  weights: {
    descriptor_first: number;
    descriptor_last: number;
    name_or_synonym_hit: number;
    family: number;
    generic_sweet: number;
    subfacet_to_floral: number;
    min_kept_after_normalize: number;
  };
  phrase_joins: Record<string, string>;
  manual_overrides: Record<string, Record<string, number>>;
  bridge_candidate: {
    categories: string[];
    exclude_impact_gte: number;
    exclude_if_first4_descriptors_contain: string[];
  };
  note_tier_hint_from_family: Record<string, string>;
};

export type FacetizeInput = {
  name: string;
  synonym?: string | null;
  family?: string | null;
  odourProfile?: string | null;
};

/**
 * Memecah teks jadi token.
 *
 * Tanda hubung sengaja DIPERTAHANKAN: beberapa keyword memang berbentuk
 * "violet-leaf" dan "bois-de-rose", dan frasa dua kata digabung jadi bentuk
 * itu sebelum dipecah. Angka dan tanda baca lain jadi pemisah.
 */
export function tokenize(text: string, dedupe = true): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.toLowerCase().split(/[^a-z-]+/)) {
    const t = raw.replace(/^-+|-+$/g, "");
    if (!t) continue;
    if (dedupe) {
      if (seen.has(t)) continue;
      seen.add(t);
    }
    out.push(t);
  }
  return out;
}

function applyPhraseJoins(
  text: string,
  joins: Record<string, string>,
): string {
  let out = text.toLowerCase();
  for (const [phrase, joined] of Object.entries(joins)) {
    out = out.split(phrase).join(joined);
  }
  return out;
}

export function facetize(
  input: FacetizeInput,
  config: FacetKeywordConfig,
): FacetVector {
  const w = config.weights;

  // 9. Override manual menang atas seluruh perhitungan di bawah.
  const lowerName = input.name.toLowerCase();
  for (const [key, override] of Object.entries(config.manual_overrides)) {
    if (lowerName.includes(key)) return trim(normalizeL2(override), w);
  }

  // Peta keyword -> facet, dibangun sekali per panggilan.
  const facetOf = new Map<string, string[]>();
  for (const [facet, def] of Object.entries(config.facets)) {
    for (const kw of def.keywords) {
      const list = facetOf.get(kw) ?? [];
      list.push(facet);
      facetOf.set(kw, list);
    }
  }

  const v: FacetVector = {};
  const add = (facet: string, value: number) => {
    v[facet] = (v[facet] ?? 0) + value;
  };

  // 1–3. Deskriptor, dibobot menurun: yang disebut duluan paling menentukan.
  const descriptors = tokenize(
    applyPhraseJoins(input.odourProfile ?? "", config.phrase_joins),
  );
  const n = descriptors.length;
  descriptors.forEach((token, i) => {
    const weight =
      w.descriptor_first -
      (w.descriptor_first - w.descriptor_last) * (i / Math.max(1, n));
    for (const facet of facetOf.get(token) ?? []) add(facet, weight);
  });

  // 4. Token di nama DAN sinonim, dihitung TERPISAH dan TANPA dedupe.
  //    Pengulangan di situ bukan kebetulan: sinonim "Styrax Benzoin Dryander
  //    Resinoid / Sumatra Benzoin Resinoid" menyebut benzoin dua kali karena
  //    memang itu bahannya, dan "Black Piper Nigrum Fruit Oil / Piper Nigrum
  //    l. Fruit Oil Black" menyebut fruit dua kali. Membuang duplikatnya
  //    menghapus penekanan yang sengaja ditulis supplier.
  //    Frasa digabung dulu, supaya "Violet Leaf Aldehyde" terbaca green
  //    (violet-leaf) dan bukan powdery (violet).
  for (const text of [input.name, input.synonym ?? ""]) {
    const joined = applyPhraseJoins(text, config.phrase_joins);
    for (const token of tokenize(joined, false)) {
      for (const facet of facetOf.get(token) ?? []) {
        add(facet, w.name_or_synonym_hit);
      }
    }
  }

  // 5. Family supplier. Herbal yang deskriptor awalnya spicy dipetakan ke
  //    spicy — family Herbal di pricelist menampung terlalu banyak hal.
  if (input.family) {
    const isSpicyHerbal =
      input.family === "Herbal" && descriptors.slice(0, 3).includes("spicy");
    const facet = isSpicyHerbal
      ? "spicy"
      : config.family_to_facet[input.family];
    if (facet) add(facet, w.family);
  }

  // 6. "sweet" tidak ada di daftar keyword mana pun, tapi tetap menandakan
  //    arah gourmand kalau belum ada penanda lain.
  if (descriptors.includes("sweet") && !v.gourmand) {
    add("gourmand", w.generic_sweet);
  }

  // 7. Rose dan white floral adalah bagian dari floral, jadi ikut menambahnya.
  const sub = (v.rose ?? 0) + (v.white ?? 0);
  if (sub > 0) add("floral", w.subfacet_to_floral * sub);

  return trim(normalizeL2(v), w);
}

/** Facet yang terlalu tipis dibuang — dia cuma bikin pie penuh tanpa arti. */
function trim(
  v: FacetVector,
  w: FacetKeywordConfig["weights"],
): FacetVector {
  const out: FacetVector = {};
  for (const [f, value] of Object.entries(v)) {
    if (value >= w.min_kept_after_normalize) out[f] = value;
  }
  return out;
}

/**
 * Apakah bahan ini pantas muncul sebagai saran jembatan.
 *
 * Yang dibuang: kategori yang bukan bahan pewangi tunggal, bahan yang terlalu
 * keras sampai sulit dipakai sebagai penyambung, dan bahan yang empat
 * deskriptor pertamanya memuat off-note — jembatan yang bau keringat bukan
 * jembatan.
 */
export function isBridgeCandidate(
  input: FacetizeInput & { category?: string | null; impact?: number | null },
  facets: FacetVector,
  config: FacetKeywordConfig,
): boolean {
  const rule = config.bridge_candidate;
  if (!input.category || !rule.categories.includes(input.category)) return false;
  if (!Object.keys(facets).length) return false;
  if ((input.impact ?? 0) >= rule.exclude_impact_gte) return false;

  const first4 = tokenize(input.odourProfile ?? "").slice(0, 4);
  return !first4.some((t) => rule.exclude_if_first4_descriptors_contain.includes(t));
}

export function tierHintFromFamily(
  family: string | null | undefined,
  config: FacetKeywordConfig,
): Tier | null {
  if (!family) return null;
  const hint = config.note_tier_hint_from_family[family];
  return hint === "top" || hint === "mid" || hint === "base" ? hint : null;
}
