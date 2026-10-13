/**
 * Membaca dilusi yang sudah menempel di produk supplier, dari NAMANYA.
 *
 * Ecofragrantica menjual sebagian bahan dalam bentuk sudah encer dan menulis
 * itu di nama produk: "Indole 50 BB" = 50% dalam Benzyl Benzoate. Tanpa
 * dibaca, piramida "60% base" bisa ternyata cuma 45% bahan aktif, dan BB
 * menumpuk diam-diam.
 *
 * Hasil parsing ini ditampilkan di pratinjau import dan BISA DIKOREKSI admin —
 * nama produk bukan kontrak, jadi tebakannya tidak pernah final.
 */

export const SOLVENT_TOKENS = [
  "TEC",
  "BB",
  "DPG",
  "IPM",
  "ETHA",
  "ETHANOL",
  "CASTOR",
] as const;

export type SolventToken = (typeof SOLVENT_TOKENS)[number];

export type SupplierDilution = { pct: number; solventToken: SolventToken };

// Angka boleh desimal koma ("0,04"), boleh dipisah tanda hubung atau spasi
// dari token pelarutnya ("10-TEC", "50 BB", "50 - etha").
const PATTERN = new RegExp(
  String.raw`(\d+(?:[.,]\d+)?)\s*-?\s*(${SOLVENT_TOKENS.join("|")})\b`,
  "i",
);

/**
 * Mengembalikan null kalau nama tidak menyebut dilusi sama sekali.
 *
 * Yang diambil adalah kecocokan PERTAMA: "Oud Resin 5 TEC Etha" berarti 5%
 * dalam TEC, dan "Etha" di belakangnya bagian dari nama produk — bukan dilusi
 * kedua.
 */
export function parseSupplierDilution(name: string): SupplierDilution | null {
  const match = PATTERN.exec(name);
  if (!match) return null;

  const pct = Number(match[1].replace(",", "."));
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return null;

  return {
    pct,
    solventToken: match[2].toUpperCase() as SolventToken,
  };
}

/**
 * Produk pelarut itu sendiri, dikenali dari namanya.
 *
 * Dipakai untuk dua hal: menandai `is_solvent` dan menyambungkan baris encer
 * ke baris pelarutnya (`supplier_solvent_id`).
 *
 * Polanya sengaja menuntut nama lengkap, bukan tokennya. "Indolene 50 Castor"
 * memakai castor sebagai pelarut — dia bukan castor oil, dan menandainya
 * sebagai pelarut akan mengeluarkannya dari hitungan bahan aktif.
 */
export const SOLVENT_PRODUCTS: Record<SolventToken, RegExp> = {
  TEC: /triethyl\s*citrate/i,
  BB: /benzyl\s*benzoate/i,
  DPG: /dipropylene\s*glycol/i,
  IPM: /isopropyl\s*myristate/i,
  ETHA: /\bethanol\b/i,
  ETHANOL: /\bethanol\b/i,
  CASTOR: /castor\s*oil/i,
};

/**
 * Apakah bahan ini pelarut.
 *
 * Kategori supplier saja tidak cukup: Benzyl Benzoate ada di kategori
 * "Aromachemical" padahal dia pelarut dilusi yang paling sering dipakai.
 * Kalau tidak ditandai, BB yang menumpuk dari belasan baris encer akan
 * terhitung sebagai bahan pewangi aktif dan piramida nyatanya jadi bohong.
 */
export function isSolventProduct(
  name: string,
  category?: string | null,
): boolean {
  if (category && category.trim().toLowerCase() === "solvent") return true;
  return Object.values(SOLVENT_PRODUCTS).some((re) => re.test(name));
}
