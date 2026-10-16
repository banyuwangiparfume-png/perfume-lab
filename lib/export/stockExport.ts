import ExcelJS from "exceljs";
import { FACET_LABELS } from "../tiers";

/**
 * Ekspor stok ke Excel — untuk dibaca sendiri, atau dilempar ke Claude untuk
 * dirancangkan formula dari bahan yang benar-benar ada di rak.
 *
 * Kolomnya mengikuti pricelist Ecofragrantica (name … price_500g) supaya
 * berkas ini terbaca sama dengan berkas supplier, lalu ditambah yang hanya
 * aplikasi ini punya: sisa stok, facet hasil hitung, kebiasaan tier, dilusi
 * bawaan, dan koreksi impact sendiri.
 *
 * Lembar kedua menjelaskan arti tiap kolom. Tanpa itu, "odor_impact 350" atau
 * "facets: Woody 62" cuma angka bagi siapa pun yang tidak memakai aplikasi
 * ini — termasuk Claude.
 *
 * Tidak menyentuh database: datanya disiapkan pemanggil.
 */

export const PRICE_SIZES = [5, 10, 50, 100, 500] as const;

export type StockExportRow = {
  type: "bahan" | "FO";
  name: string;
  synonym: string | null;
  casNumber: string | null;
  family: string | null;
  category: string | null;
  odourProfile: string | null;
  functionCategory: string | null;
  /** "supplier" | "user" | "derived" — tebakan harus bisa dibedakan dari data */
  functionSource: string | null;
  /** impact efektif: koreksi sendiri lebih dulu, baru supplier */
  impact: number | null;
  /** alasan koreksi impact, kalau ada */
  impactNote: string | null;
  noteTier: string | null;
  facets: Record<string, number>;
  /** 100 = neat */
  supplierDilutionPct: number | null;
  /** null = belum pernah dicatat; beda dari 0 = pernah ada lalu habis */
  onHandG: number | null;
  /** harga per kemasan, per ukuran gram */
  prices: Record<number, number>;
  /** harga per gram (FO menyimpan ini langsung) */
  pricePerGram: number | null;
  personalNote: string | null;
};

type Column = {
  key: string;
  width: number;
  /** penjelasan untuk lembar Keterangan */
  note: string;
  value: (r: StockExportRow) => string | number | null;
  numFmt?: string;
};

const RP = '"Rp"#,##0';

export const STOCK_COLUMNS: Column[] = [
  { key: "type", width: 7, note: "bahan = raw material; FO = fragrance oil jadi (isinya tidak diketahui).", value: (r) => r.type },
  { key: "name", width: 34, note: "Nama produk seperti dijual supplier. Angka + pelarut di nama (\"Indole 50 BB\") berarti sudah encer dari pabrik.", value: (r) => r.name },
  { key: "synonym", width: 28, note: "Nama lain. Untuk FO: parfum yang ditiru.", value: (r) => r.synonym },
  { key: "cas_number", width: 13, note: "Nomor CAS.", value: (r) => r.casNumber },
  { key: "family", width: 15, note: "Family dari supplier.", value: (r) => r.family },
  { key: "category", width: 15, note: "Kategori dari supplier (Aromachemical, Essential Oil, …).", value: (r) => r.category },
  { key: "odour_profile", width: 50, note: "Deskripsi bau dari supplier. Kata yang disebut duluan paling dominan.", value: (r) => r.odourProfile },
  { key: "function_category", width: 14, note: "Peran di formula: diffuser (proyeksi), modifier (karakter), bridger (penyambung), fixative (penahan).", value: (r) => r.functionCategory },
  { key: "function_source", width: 12, note: "Asal peran: supplier = data, user = koreksi sendiri, derived = DITEBAK dari family (jangan dianggap data).", value: (r) => r.functionSource },
  { key: "odor_impact", width: 11, note: "Daya pukul bau per gram (skala supplier, umumnya 10–1000). Kekuatan di formula ≈ porsi × impact. Kosong = belum diketahui. Sudah memakai koreksi sendiri kalau ada.", value: (r) => r.impact },
  { key: "impact_note", width: 26, note: "Alasan koreksi impact, kalau impact-nya dikoreksi sendiri.", value: (r) => r.impactNote },
  { key: "note_tier", width: 9, note: "Kebiasaan tier: top / mid / base (kecepatan menguap).", value: (r) => r.noteTier },
  { key: "facets", width: 40, note: "Arah bau hasil hitung dari odour profile, 0–100, dari yang terkuat. Bukan kekuatan — kekuatan ada di odor_impact.", value: (r) => formatFacets(r.facets) || null },
  { key: "supplier_dilution_pct", width: 10, note: "Konsentrasi bawaan dari pabrik dalam %. 100 = murni. 10 = hanya 10% bahan aktif.", value: (r) => r.supplierDilutionPct },
  { key: "on_hand_g", width: 10, note: "Sisa stok dalam gram dari catatan pembelian & produksi. Kosong = belum pernah dicatat (bukan berarti habis).", value: (r) => r.onHandG, numFmt: "0.0##" },
  ...PRICE_SIZES.map(
    (s): Column => ({
      key: `price_${s}g`,
      width: 11,
      note: `Harga kemasan ${s} g (Rp), harga terbaru.`,
      value: (r) => r.prices[s] ?? null,
      numFmt: RP,
    }),
  ),
  { key: "price_per_g", width: 11, note: "Harga per gram (Rp) pada ukuran kemasan yang biasa dipakai.", value: (r) => r.pricePerGram, numFmt: RP },
  { key: "personal_note", width: 30, note: "Catatan pribadi.", value: (r) => r.personalNote },
];

/**
 * Facet sebagai teks yang bisa dibaca manusia dan mesin sekaligus:
 * "Woody 62; Earthy/Mossy 41". Diurut dari yang terkuat.
 */
export function formatFacets(facets: Record<string, number>): string {
  return Object.entries(facets)
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([k, w]) => `${FACET_LABELS[k] ?? k} ${Math.round(w * 100)}`)
    .join("; ");
}

/**
 * Harga terbaru per ukuran kemasan dari riwayat harga.
 *
 * Riwayat tidak pernah dihapus, jadi satu ukuran bisa punya banyak baris.
 * Yang dipakai yang tanggal berlakunya paling baru.
 */
export function currentPrices(
  history: { tier_size: number; price_idr: number; effective_date: string }[],
): Record<number, number> {
  const latest = new Map<number, { price: number; date: string }>();
  for (const p of history) {
    const prev = latest.get(p.tier_size);
    if (!prev || p.effective_date > prev.date) {
      latest.set(p.tier_size, { price: Number(p.price_idr), date: p.effective_date });
    }
  }
  return Object.fromEntries(
    [...latest.entries()].map(([size, v]) => [size, v.price]),
  );
}

/** Workbook dua lembar: Stok (data) dan Keterangan (arti tiap kolom). */
export function buildStockWorkbook(rows: StockExportRow[]): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Perfumer's Notebook";
  wb.created = new Date();

  const ws = wb.addWorksheet("Stok", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  ws.columns = STOCK_COLUMNS.map((c) => ({
    header: c.key,
    key: c.key,
    width: c.width,
    style: c.numFmt ? { numFmt: c.numFmt } : undefined,
  }));

  for (const r of rows) {
    // Angka disimpan sebagai angka, bukan teks — supaya bisa dijumlah dan
    // diurutkan di Excel, dan dibaca sebagai angka oleh pembaca mesin.
    ws.addRow(Object.fromEntries(STOCK_COLUMNS.map((c) => [c.key, c.value(r) ?? null])));
  }

  const header = ws.getRow(1);
  header.font = { bold: true };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0ECE2" } };
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: STOCK_COLUMNS.length },
  };
  // Odour profile dan facet panjang; dibungkus supaya terbaca tanpa melebarkan
  // kolom sampai layar.
  for (const key of ["odour_profile", "facets"]) {
    ws.getColumn(key).alignment = { wrapText: true, vertical: "top" };
  }

  const help = wb.addWorksheet("Keterangan");
  help.columns = [
    { header: "kolom", key: "kolom", width: 22 },
    { header: "arti", key: "arti", width: 110 },
  ];
  help.getRow(1).font = { bold: true };
  for (const c of STOCK_COLUMNS) help.addRow({ kolom: c.key, arti: c.note });
  help.addRow({});
  help.addRow({
    kolom: "catatan",
    arti: "Berisi bahan & FO yang ditandai ada di stok. Persen di formula dihitung dari bentuk yang dibeli; bahan yang sudah encer dari pabrik (supplier_dilution_pct < 100) menyumbang bahan aktif lebih sedikit dari porsinya.",
  });
  help.getColumn("arti").alignment = { wrapText: true, vertical: "top" };

  return wb;
}

export async function stockXlsxBuffer(rows: StockExportRow[]): Promise<ArrayBuffer> {
  const buf = await buildStockWorkbook(rows).xlsx.writeBuffer();
  return buf as ArrayBuffer;
}
