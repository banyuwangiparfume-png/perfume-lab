/**
 * Tipe inti lapisan kalkulasi v2.
 *
 * Semua fungsi di lib/calc/ adalah FUNGSI MURNI tanpa akses database. Loader
 * (lib/data/loadFormulaContext.ts) yang mengumpulkan versi, baris, bahan,
 * facet, harga, dan accord jadi satu FormulaContext.
 *
 * Perbedaan paling penting dari v1: **persen adalah sumber kebenaran, gram
 * adalah turunan.** v2 sering mengubah skala batch (3 g ↔ 120 g); menyimpan
 * gram akan memaksa konversi ulang tiap kali.
 */

export type Tier = "top" | "mid" | "base" | "all";

export const TIERS: Tier[] = ["top", "mid", "base"];

export type LineKind = "raw_material" | "accord" | "fo";

export type ImpactBasis = "as_sold" | "active";

/** Vektor facet, dinormalisasi L2 (panjang 1). Boleh kosong. */
export type FacetVector = Record<string, number>;

export type Material = {
  id: string;
  name: string;
  category: string | null;
  /** odor_impact_override ?? odor_impact. null = belum ada data. */
  impact: number | null;
  impactBasis: ImpactBasis;
  /** 100 = neat. "Indole 50 BB" -> 50 */
  supplierDilutionPct: number;
  supplierSolventId: string | null;
  facets: FacetVector;
  functionCategory: string | null;
  noteTierHint: Tier | null;
  isBridgeCandidate: boolean;
  /**
   * Dikeluarkan dari "bahan aktif" di piramida nyata, walau ditambahkan
   * langsung sebagai baris biasa. BB 10% yang diketik user tetap pelarut.
   */
  isSolvent: boolean;
  /** tier_size -> price_idr (harga terbaru per tier) */
  prices: Record<number, number>;
};

export type Line = {
  id: string;
  tier: Tier;
  kind: LineKind;
  /** id raw_material / formula_version (accord) / fragrance_oil */
  refId: string;
  /** % TIMBANG dari total formula — bukan dari tier, bukan % aktif */
  pct: number;
  locked: boolean;
  /** 100 = tidak diencerkan user */
  userDilutionPct: number;
  userSolventId: string | null;
  sortOrder?: number;
};

export type Pyramid = { top: number; mid: number; base: number };

export type Version = {
  id: string;
  name?: string;
  batchG: number;
  /** null = mode piramida OFF, semua baris di tier 'all' */
  pyramid: Pyramid | null;
  priceTierOverride: number | null;
  lines: Line[];
};

export type Fo = {
  id: string;
  name: string;
  pricePerGram: number | null;
};

export type BridgeRule = {
  id: string;
  materialId: string;
  facetA: string;
  facetB: string;
  note: string | null;
  source: "temen" | "klasik" | "saya";
};

export type Settings = {
  priceTierRules: { maxBatchExclusive: number | null; tier: number }[];
  bridgeThresholds: { connected: number; loose: number };
  solventWarn: { singlePct: number; totalPct: number };
  dominance: { minStrengthPct: number; ratio: number };
  functionMix: {
    /** di bawah ini, porsi fixative dilaporkan sebagai catatan */
    fixativeWarnPct: number;
    /** di bawah ini, kategori fungsi dianggap belum cukup untuk dinilai */
    minCoveragePct: number;
    /** formula sekecil ini belum pantas dinilai komposisi perannya */
    minMaterials: number;
  };
  supplierSolventTokens: Record<string, string | null>;
};

export type FormulaContext = {
  version: Version;
  materials: Map<string, Material>;
  /** versionId -> versi accord, isinya ikut dimuat */
  accords: Map<string, Version>;
  fos: Map<string, Fo>;
  bridgeRules: BridgeRule[];
  /** bahan yang ada di stok user, untuk filter "hanya stok saya" */
  stock: Set<string>;
  settings: Settings;
};

/** Satu entri hasil pembentangan formula jadi komposisi nyata. */
export type ExpandedItem = {
  kind: "material" | "fo";
  refId: string;
  /** tier baris asal di formula induk */
  tier: Tier;
  /**
   * `ingredient` = bahan yang sengaja ditambahkan
   * `user_solvent` = pelarut yang ikut masuk karena user mengencerkan baris
   */
  role: "ingredient" | "user_solvent";
  /** % dari total formula, dalam bentuk yang dibeli/ditimbang */
  productPct: number;
  /** productPct × dilusi supplier — molekul murni */
  activePct: number;
  /** basis yang dipakai menghitung kekuatan (as_sold -> productPct) */
  strengthBasisPct: number;
  /** pelarut bawaan supplier yang ikut terbawa baris ini */
  hiddenSolvent?: { solventId: string | null; pct: number };
  /** jalur accord, contoh ["Jasmine Accord v3"] */
  via: string[];
  /** id baris formula induk asalnya */
  sourceLineId: string;
};

export const round = (n: number, d: number) => {
  const f = 10 ** d;
  return Math.round((n + Number.EPSILON) * f) / f;
};

/** Persen disimpan 5 desimal — presisi cukup supaya reproduksi tidak rusak. */
export const round5 = (n: number) => round(n, 5);

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
