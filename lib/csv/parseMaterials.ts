import type { FunctionCategoryEnum } from "../supabase/database.types";

/**
 * Parsing + validasi baris pricelist supplier.
 *
 * Fungsi murni: menerima baris yang sudah dibaca papaparse, bukan file.
 * Dengan begitu validasinya bisa diuji tanpa upload, dan dipakai ulang di
 * pratinjau maupun saat eksekusi import.
 *
 * Aturan yang tidak boleh dilanggar:
 *  - Kolom impact kosong disimpan sebagai NULL, jangan pernah diisi 0 atau 100.
 *    Rule 5 mengandalkan null untuk mendeteksi data yang belum lengkap.
 *  - Kunci pencocokan utama adalah CAS number, nama hanya cadangan.
 */

export const MATERIAL_COLUMNS = [
  "name",
  "synonym",
  "cas_number",
  "family",
  "category",
  "odour_profile",
  "function_category",
  "odor_impact",
  "tgsc_url",
  "price_5g",
  "price_10g",
  "price_50g",
  "price_100g",
  "price_500g",
] as const;

export type MaterialColumn = (typeof MATERIAL_COLUMNS)[number];

/** Nama header yang sering muncul di pricelist, dipetakan ke kolom database. */
const HEADER_ALIASES: Record<string, MaterialColumn> = {
  name: "name",
  material: "name",
  bahan: "name",
  "material name": "name",
  synonym: "synonym",
  synonyms: "synonym",
  sinonim: "synonym",
  cas: "cas_number",
  "cas no": "cas_number",
  "cas number": "cas_number",
  cas_number: "cas_number",
  family: "family",
  "odour family": "family",
  "odor family": "family",
  category: "category",
  kategori: "category",
  "odour profile": "odour_profile",
  "odor profile": "odour_profile",
  odour_profile: "odour_profile",
  odor_profile: "odour_profile",
  description: "odour_profile",
  "function category": "function_category",
  function_category: "function_category",
  function: "function_category",
  fungsi: "function_category",
  "odor impact": "odor_impact",
  "odour impact": "odor_impact",
  odor_impact: "odor_impact",
  impact: "odor_impact",
  tgsc: "tgsc_url",
  tgsc_url: "tgsc_url",
  "tgsc url": "tgsc_url",
  price_5g: "price_5g",
  "price 5g": "price_5g",
  "5g": "price_5g",
  price_10g: "price_10g",
  "price 10g": "price_10g",
  "10g": "price_10g",
  price_50g: "price_50g",
  "price 50g": "price_50g",
  "50g": "price_50g",
  price_100g: "price_100g",
  "price 100g": "price_100g",
  "100g": "price_100g",
  price_500g: "price_500g",
  "price 500g": "price_500g",
  "500g": "price_500g",
};

const normalizeHeader = (h: string) =>
  h.trim().toLowerCase().replace(/[.\-]/g, " ").replace(/\s+/g, " ");

/**
 * Menebak pemetaan kolom dari nama header. Tebakan ini jadi nilai awal di UI
 * dan tetap bisa diubah user — header pricelist supplier tidak selalu konsisten.
 */
export function guessColumnMap(
  headers: string[],
): Partial<Record<MaterialColumn, string>> {
  const map: Partial<Record<MaterialColumn, string>> = {};
  for (const header of headers) {
    const target = HEADER_ALIASES[normalizeHeader(header)];
    if (target && !map[target]) map[target] = header;
  }
  return map;
}

const FUNCTION_MAP: Record<string, FunctionCategoryEnum> = {
  diffuser: "diffuser",
  modifier: "modifier",
  bridger: "bridger",
  fixative: "fixative",
};

export const PRICE_TIERS: { column: MaterialColumn; grams: number }[] = [
  { column: "price_5g", grams: 5 },
  { column: "price_10g", grams: 10 },
  { column: "price_50g", grams: 50 },
  { column: "price_100g", grams: 100 },
  { column: "price_500g", grams: 500 },
];

export type ParsedMaterial = {
  /** nomor baris di file, 1 = baris data pertama setelah header */
  line: number;
  name: string;
  synonym: string | null;
  cas_number: string | null;
  family: string | null;
  category: string | null;
  odour_profile: string | null;
  function_category: FunctionCategoryEnum | null;
  odor_impact: number | null;
  tgsc_url: string | null
  prices: { tier_size: number; price_idr: number }[];
};

export type ParseFailure = { line: number; reason: string; raw: string };

export type ParseResult = {
  rows: ParsedMaterial[];
  failures: ParseFailure[];
};

const text = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  // Pricelist sering memakai penanda data kosong seperti ini.
  if (["-", "n/a", "na", "null", "tbd"].includes(s.toLowerCase())) return null;
  return s;
};

/**
 * Angka dari pricelist bisa ditulis "1.500.000", "1,500,000", atau "15048,5".
 * Pemisah ribuan dibuang, koma desimal diubah jadi titik.
 */
function parseNumber(v: unknown): number | null | "invalid" {
  const s = text(v);
  if (s == null) return null;

  const cleaned = s.replace(/\s|rp/gi, "");
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  let normalized = cleaned;
  if (hasComma && hasDot) {
    // Pemisah desimal = yang muncul paling belakang.
    normalized =
      cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (hasComma) {
    // "1,500" bisa berarti seribu lima ratus atau 1.5 — pola tiga digit
    // setelah koma jauh lebih umum di pricelist, jadi itu yang dipakai.
    normalized = /,\d{3}(\D|$)/.test(cleaned)
      ? cleaned.replace(/,/g, "")
      : cleaned.replace(",", ".");
  } else if (hasDot && /\.\d{3}(\D|$)/.test(cleaned)) {
    normalized = cleaned.replace(/\./g, "");
  }

  const n = Number(normalized);
  if (!Number.isFinite(n)) return "invalid";
  return n;
}

export function parseMaterialRows(
  rawRows: Record<string, unknown>[],
  columnMap: Partial<Record<MaterialColumn, string>>,
): ParseResult {
  const rows: ParsedMaterial[] = [];
  const failures: ParseFailure[] = [];
  const seenCas = new Map<string, number>();
  const seenName = new Map<string, number>();

  const pick = (row: Record<string, unknown>, col: MaterialColumn) => {
    const source = columnMap[col];
    return source ? row[source] : undefined;
  };

  rawRows.forEach((row, i) => {
    const line = i + 1;
    const raw = JSON.stringify(row);

    const name = text(pick(row, "name"));
    if (!name) {
      failures.push({ line, reason: "nama kosong", raw });
      return;
    }

    const cas = text(pick(row, "cas_number"));
    if (cas) {
      const previous = seenCas.get(cas);
      if (previous) {
        failures.push({
          line,
          reason: `CAS ganda dengan baris ${previous}`,
          raw,
        });
        return;
      }
    } else {
      // Tanpa CAS, nama jadi kunci pencocokan — jadi nama ganda juga ditolak,
      // kalau tidak import jadi tidak idempoten.
      const previous = seenName.get(name.toLowerCase());
      if (previous) {
        failures.push({
          line,
          reason: `nama ganda dengan baris ${previous} dan tidak punya CAS untuk membedakan`,
          raw,
        });
        return;
      }
    }

    const impactRaw = parseNumber(pick(row, "odor_impact"));
    if (impactRaw === "invalid") {
      failures.push({
        line,
        reason: `odor_impact bukan angka ("${String(pick(row, "odor_impact")).trim()}")`,
        raw,
      });
      return;
    }
    if (impactRaw != null && impactRaw < 0) {
      failures.push({ line, reason: "odor_impact negatif", raw });
      return;
    }

    const fnRaw = text(pick(row, "function_category"));
    let functionCategory: FunctionCategoryEnum | null = null;
    if (fnRaw) {
      const mapped = FUNCTION_MAP[fnRaw.toLowerCase()];
      if (!mapped) {
        failures.push({
          line,
          reason: `kategori fungsi "${fnRaw}" tidak dikenal (harus Diffuser / Modifier / Bridger / Fixative)`,
          raw,
        });
        return;
      }
      functionCategory = mapped;
    }

    const prices: { tier_size: number; price_idr: number }[] = [];
    let priceFailed = false;
    for (const tier of PRICE_TIERS) {
      const value = parseNumber(pick(row, tier.column));
      if (value === "invalid") {
        failures.push({
          line,
          reason: `${tier.column} bukan angka ("${String(pick(row, tier.column)).trim()}")`,
          raw,
        });
        priceFailed = true;
        break;
      }
      if (value != null && value > 0) {
        prices.push({ tier_size: tier.grams, price_idr: value });
      }
    }
    if (priceFailed) return;

    if (cas) seenCas.set(cas, line);
    else seenName.set(name.toLowerCase(), line);

    rows.push({
      line,
      name,
      synonym: text(pick(row, "synonym")),
      cas_number: cas,
      family: text(pick(row, "family")),
      category: text(pick(row, "category")),
      odour_profile: text(pick(row, "odour_profile")),
      function_category: functionCategory,
      odor_impact: impactRaw,
      tgsc_url: text(pick(row, "tgsc_url")),
      prices,
    });
  });

  return { rows, failures };
}

/** CSV berisi baris yang gagal, supaya bisa diperbaiki lalu diimpor ulang. */
export function failuresToCsv(failures: ParseFailure[]): string {
  const header = "line,reason,raw";
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  return [
    header,
    ...failures.map((f) => [f.line, escape(f.reason), escape(f.raw)].join(",")),
  ].join("\n");
}
