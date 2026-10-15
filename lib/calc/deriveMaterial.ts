import {
  facetize,
  isBridgeCandidate,
  tierHintFromFamily,
  type FacetKeywordConfig,
} from "./facetize";
import {
  isSolventProduct,
  parseSupplierDilution,
  type SolventToken,
} from "./supplierDilution";
import type { FacetVector, Tier } from "./types";

export type MaterialSource = {
  name: string;
  synonym?: string | null;
  family?: string | null;
  category?: string | null;
  odourProfile?: string | null;
  impact?: number | null;
};

export type DerivedMaterial = {
  facets: FacetVector;
  /** 100 = neat. Dibaca dari nama produk, "Indole 50 BB" -> 50 */
  supplierDilutionPct: number;
  /** pelarut bawaan, untuk disambungkan ke baris pelarutnya di master */
  solventToken: SolventToken | null;
  isSolvent: boolean;
  isBridgeCandidate: boolean;
  noteTierHint: Tier | null;
};

/**
 * Semua yang DITURUNKAN dari data sebuah bahan, bukan diketik.
 *
 * Satu fungsi untuk dua pintu masuk: import pricelist dan form bahan baru.
 * Kalau keduanya menurunkan sendiri-sendiri, bahan yang diketik manual pelan-
 * pelan dinilai dengan aturan yang berbeda dari bahan supplier — facet-nya,
 * kandidat bridger-nya, dilusinya — dan tidak ada yang sadar sampai saran
 * bridger mulai aneh.
 */
export function deriveMaterial(
  source: MaterialSource,
  config: FacetKeywordConfig,
): DerivedMaterial {
  const input = {
    name: source.name,
    synonym: source.synonym ?? null,
    family: source.family ?? null,
    odourProfile: source.odourProfile ?? null,
  };
  const facets = facetize(input, config);
  const dilution = parseSupplierDilution(source.name);

  return {
    facets,
    supplierDilutionPct: dilution?.pct ?? 100,
    solventToken: dilution?.solventToken ?? null,
    isSolvent: isSolventProduct(source.name, source.category),
    isBridgeCandidate: isBridgeCandidate(
      { ...input, category: source.category, impact: source.impact },
      facets,
      config,
    ),
    noteTierHint: tierHintFromFamily(source.family, config),
  };
}

/**
 * Family yang dikenali aturan tier hint. Ditawarkan di form bahan baru supaya
 * kebiasaan tier-nya bisa diturunkan — family yang diketik bebas tidak akan
 * cocok dengan kunci apa pun.
 */
export const knownFamilies = (config: FacetKeywordConfig): string[] =>
  Object.keys(config.note_tier_hint_from_family);

/** Nama untuk perbandingan duplikat: huruf kecil, spasi dirapatkan. */
export const normalizeName = (name: string) =>
  name.trim().toLowerCase().replace(/\s+/g, " ");
