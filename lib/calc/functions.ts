import type { StrengthResult } from "./strength";

/**
 * Peran bahan di dalam formula, menurut kategori fungsi supplier.
 *
 * Ini menjawab pertanyaan yang BERBEDA dari bridger. Bridger menjawab "dua sisi
 * ini tidak nyambung". Ini menjawab "formula ini kurang volume, atau akan mati
 * cepat" — dan sebelumnya tidak ada panel mana pun yang menjawabnya.
 */
export const FUNCTION_LABELS: Record<string, string> = {
  diffuser: "Diffuser",
  modifier: "Modifier",
  bridger: "Bridger",
  fixative: "Fixative",
};

export const FUNCTION_HINTS: Record<string, string> = {
  diffuser: "Proyeksi dan sillage — yang membawa formula keluar dari kulit.",
  modifier:
    "Watak. Yang membuat formula ini terdengar seperti dirinya — bukan yang mengatur performanya.",
  bridger:
    "Menyambung dua sisi yang kalau berdiri sendiri terdengar terpisah.",
  fixative:
    "Ketahanan. Menahan yang ringan supaya tidak hilang duluan; penentu panjang drydown.",
};

/**
 * Performa (sillage, proyeksi, ketahanan) TIDAK diatur oleh Modifier.
 *
 * Ini sumber salah paham yang paling sering: "modifier" di percakapan
 * sehari-hari sering dipakai untuk bahan yang dipakai mendongkrak performa,
 * padahal di kategori supplier dia berarti bahan yang mengatur watak. Yang
 * mengatur performa ada di dua kategori lain.
 */
export const SPL_NOTE =
  "Performa diatur Diffuser (proyeksi dan sillage) dan Fixative (ketahanan). Modifier mengatur watak, bukan performa.";

export const UNKNOWN_KEY = "unknown";

export type FunctionRow = {
  key: string;
  label: string;
  /** % dari bahan pewangi — pelarut dan FO tidak ikut penyebut */
  pct: number;
  /** porsi kekuatan kategori ini terhadap seluruh formula */
  strengthPct: number;
  materials: string[];
};

export type FunctionMix = {
  rows: FunctionRow[];
  /** % bahan pewangi yang kategori fungsinya sudah terisi */
  coverage: number;
  /** jumlah bahan pewangi (non-pelarut, non-FO) yang ikut dihitung */
  materialCount: number;
  /**
   * Yang sengaja dikeluarkan dari penyebut. Dilaporkan supaya user tidak
   * mencari-cari ke mana sisa persennya pergi.
   */
  excluded: { solventPct: number; foPct: number };
};

/**
 * Dihitung dari tabel kekuatan, bukan dari pembentangan ulang.
 *
 * Alasannya sama dengan di tempat lain: satu jalur hitung. `strengthTable`
 * sudah menggabungkan bahan yang datang dari beberapa tempat, dan sudah tahu
 * mana yang pelarut — mengulangnya di sini cuma menciptakan angka kedua yang
 * bisa berbeda.
 */
export function functionMix(strength: StrengthResult): FunctionMix {
  type Bucket = { pct: number; strengthPct: number; materials: string[] };
  const buckets = new Map<string, Bucket>();

  let solventPct = 0;
  let foPct = 0;
  let denominator = 0;
  let materialCount = 0;

  for (const row of strength.rows) {
    if (row.kind === "fo") {
      foPct += row.productPct;
      continue;
    }
    // Pelarut bukan bahan pewangi. Memasukkannya membuat porsi tiap peran
    // mengecil hanya karena formulanya diencerkan.
    if (row.isSolvent) {
      solventPct += row.productPct;
      continue;
    }

    denominator += row.productPct;
    materialCount++;

    const key = (row.functionCategory ?? "").toLowerCase() || UNKNOWN_KEY;
    const bucket = buckets.get(key) ?? { pct: 0, strengthPct: 0, materials: [] };
    bucket.pct += row.productPct;
    bucket.strengthPct += row.strengthPct ?? 0;
    bucket.materials.push(row.name);
    buckets.set(key, bucket);
  }

  const rows: FunctionRow[] = [...buckets.entries()].map(([key, b]) => ({
    key,
    label: FUNCTION_LABELS[key] ?? "Belum berkategori",
    pct: denominator ? (b.pct / denominator) * 100 : 0,
    strengthPct: b.strengthPct,
    materials: b.materials.sort((x, y) => x.localeCompare(y, "id")),
  }));

  // Yang belum berkategori selalu di bawah: dia bukan peran, dia pekerjaan
  // rumah yang belum selesai.
  rows.sort((a, b) => {
    if (a.key === UNKNOWN_KEY) return 1;
    if (b.key === UNKNOWN_KEY) return -1;
    return b.pct - a.pct;
  });

  const unknown = rows.find((r) => r.key === UNKNOWN_KEY)?.pct ?? 0;

  return {
    rows,
    coverage: denominator ? 100 - unknown : 0,
    materialCount,
    excluded: { solventPct, foPct },
  };
}

/** Porsi satu peran, 0 kalau perannya belum ada sama sekali. */
export const shareOf = (mix: FunctionMix, key: string): number =>
  mix.rows.find((r) => r.key === key)?.pct ?? 0;
