/**
 * Tipe inti lapisan kalkulasi.
 *
 * Semua fungsi di lib/calc/ adalah FUNGSI MURNI tanpa akses database,
 * supaya bisa dipakai di server (render tabel) maupun client (panel live
 * di editor) dan gampang ditulis unit test-nya.
 */

export type FunctionCategory = "diffuser" | "modifier" | "bridger" | "fixative";

export type LineType = "raw_material" | "fo" | "sub_formula";

export type CalcLine = {
  id: string;
  lineType: LineType;
  /** nama RM / FO / "Jasmine Accord v3" */
  label: string;
  /** BERAT SEPERTI DITIMBANG — bukan berat murni */
  weightG: number;
  /** 100 = neat */
  dilutionPct: number;
  /** pelarut, hanya relevan kalau dilutionPct < 100 */
  solvent?: string | null;
  /** harga per gram bahan murni; null = data harga belum ada */
  pricePerGram?: number | null;
  note?: string | null;

  // --- hanya untuk raw_material ---
  functionCategory?: FunctionCategory | null;
  family?: string | null;
  /** effective_impact = odor_impact_override ?? odor_impact */
  impact?: number | null;

  // --- hanya untuk fo ---
  foFamily?: string | null;

  // --- hanya untuk sub_formula — sudah di-resolve saat memuat data ---
  subLines?: CalcLine[];
  /** tipe formula sumber, untuk badge "Accord" / "Booster" */
  subFormulaType?: string | null;
};

export type CalcRow = CalcLine & {
  /** berat_murni = weightG × dilutionPct / 100 */
  neatWeightG: number;
  /** porsi terhadap total berat timbang */
  weightPct: number;
  /** porsi terhadap total berat murni */
  neatPct: number;
  /**
   * porsi kekuatan bau. null untuk baris FO (tidak punya impact) dan untuk
   * baris yang nilai impact-nya belum ada. null BUKAN nol.
   */
  strengthPct: number | null;
  /** impact yang dipakai menghitung; untuk sub_formula ini rata-rata tertimbang */
  effectiveImpact: number | null;
  /** true kalau effectiveImpact berasal dari rata-rata penyusun sub-formula */
  impactIsAggregate: boolean;
  /** biaya baris ini, dihitung dari berat MURNI */
  costIdr: number | null;
};

export type FormulaResult = {
  rows: CalcRow[];
  totals: {
    weighedG: number;
    neatG: number;
    costIdr: number | null;
    /** biaya per gram berat murni; null kalau ada baris yang harganya belum ada */
    costPerGram: number | null;
    /** nama baris yang harganya belum ada — biaya di atas belum lengkap */
    missingPrice: string[];
  };

  /** berapa % formula (berbasis berat murni) yang ikut dinilai kekuatannya */
  strengthBasis: number;
  /** porsi FO terhadap total berat murni — dipakai Rule 6 */
  foNeatShare: number;
  hasFO: boolean;
  foCount: number;
  /** family tiap baris FO, untuk Rule 7 */
  foFamilies: string[];
  /** porsi neat tiap baris FO, diurut dari terbesar — untuk Rule 7 */
  foShares: { label: string; share: number; family: string | null }[];

  /** true hanya kalau SELURUH formula ikut dinilai dan tidak ada impact kosong */
  strengthComplete: boolean;
  /** nama bahan yang nilai impact-nya belum ada */
  missingImpact: string[];

  /** sebaran % kekuatan per kategori fungsi (hanya dari baris yang dinilai) */
  functionShares: Record<FunctionCategory, number>;
  /** baris dengan % kekuatan tertinggi */
  lead: { label: string; share: number } | null;
};
