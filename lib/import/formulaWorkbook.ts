import ExcelJS from "exceljs";
import { TEMPLATE_COLUMNS } from "./formulaImport";

/**
 * Template formula dan pembacanya.
 *
 * Template dirancang untuk diisi AI: lembar Petunjuk menjelaskan aturan yang
 * tidak bisa ditebak dari nama kolom — persen dihitung dari total formula,
 * bukan dari tier; dilusi bawaan pabrik jangan diencerkan dua kali; nama harus
 * persis dari berkas ekspor stok. AI yang tidak diberi tahu hal-hal itu akan
 * mengisi dengan anggapan yang paling umum, dan anggapan itu salah di sini.
 */

const COLUMN_NOTES: Record<(typeof TEMPLATE_COLUMNS)[number], { width: number; note: string }> = {
  tier: {
    width: 8,
    note: "top / mid / base. Kosongkan kalau formulanya tanpa piramida.",
  },
  bahan: {
    width: 42,
    note: "Nama bahan PERSIS seperti kolom `name` di berkas ekspor stok (stok-*.xlsx). Boleh juga nama accord atau FO yang sudah ada di aplikasi.",
  },
  cas: {
    width: 14,
    note: "Opsional. Diisi kalau nama bahan bisa tertukar dengan bahan lain.",
  },
  persen: {
    width: 9,
    note: "Persen TIMBANG dari TOTAL formula (bukan dari tier), dalam bentuk seperti yang dibeli. Seluruh baris berjumlah 100.",
  },
  dilusi_pct: {
    width: 10,
    note: "Opsional. Kalau bahan diencerkan SENDIRI sebelum dimasukkan: 10 = larutan 10%. Kosong atau 100 = neat. Bahan yang sudah encer dari pabrik (supplier_dilution_pct < 100 di berkas stok) jangan diencerkan lagi.",
  },
  pelarut: {
    width: 14,
    note: "Wajib kalau dilusi_pct diisi: TEC, DPG, BB, IPM, atau Ethanol.",
  },
  catatan: {
    width: 40,
    note: "Opsional. Alasan bahan ini dipakai — tidak diimpor, untuk dibaca sendiri.",
  },
};

export function buildFormulaTemplate(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Perfumer's Notebook";
  wb.created = new Date();

  const ws = wb.addWorksheet("Formula", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  ws.columns = TEMPLATE_COLUMNS.map((key) => ({
    header: key,
    key,
    width: COLUMN_NOTES[key].width,
  }));
  const header = ws.getRow(1);
  header.font = { bold: true };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0ECE2" } };

  // Pilihan tier sebagai dropdown untuk yang mengisi manual; AI menulis
  // teksnya langsung, dan importnya tetap memeriksa.
  for (let r = 2; r <= 101; r++) {
    ws.getCell(r, 1).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"top,mid,base"'],
    };
  }

  const help = wb.addWorksheet("Petunjuk");
  help.columns = [
    { header: "kolom", key: "kolom", width: 14 },
    { header: "aturan", key: "aturan", width: 120 },
  ];
  help.getRow(1).font = { bold: true };
  for (const key of TEMPLATE_COLUMNS) {
    help.addRow({ kolom: key, aturan: COLUMN_NOTES[key].note });
  }
  help.addRow({});
  for (const [kolom, aturan] of [
    ["isi", "Satu baris per bahan di lembar Formula, mulai baris 2. Jangan ubah nama kolom atau nama lembar."],
    ["bahan", "Pakai hanya bahan dari berkas ekspor stok. Kalau butuh bahan yang tidak ada di sana, sebutkan terpisah di luar berkas ini — jangan dimasukkan ke lembar Formula."],
    ["kekuatan", "odor_impact di berkas stok adalah daya pukul per gram. Bahan ber-impact tinggi (≥ 300) biasanya cukup di bawah 1–2%; kekuatan di formula ≈ persen × impact."],
    ["piramida", "Umumnya Top 10–25%, Mid 25–35%, Base 40–60% dari total. Jumlah persen per tier menjadi target piramida saat diimpor."],
    ["angka", "Pakai titik atau koma desimal; tanda % boleh. Jangan pakai rumus Excel."],
  ]) {
    help.addRow({ kolom, aturan });
  }
  help.getColumn("aturan").alignment = { wrapText: true, vertical: "top" };

  return wb;
}

export async function formulaTemplateBuffer(): Promise<ArrayBuffer> {
  return (await buildFormulaTemplate().xlsx.writeBuffer()) as ArrayBuffer;
}

/** Nilai sel Excel jadi nilai polos: rumus → hasilnya, teks kaya → teksnya. */
function plain(v: ExcelJS.CellValue): unknown {
  if (v == null) return null;
  if (typeof v !== "object") return v;
  if (v instanceof Date) return v.toISOString();
  if ("result" in v) return plain(v.result as ExcelJS.CellValue);
  if ("richText" in v) return v.richText.map((t) => t.text).join("");
  if ("text" in v) return v.text;
  return String(v);
}

/**
 * Baris mentah dari berkas yang diunggah.
 *
 * Mencari lembar "Formula"; kalau tidak ada, lembar pertama — AI kadang
 * mengganti nama lembar. Kolom dikenali dari judulnya (huruf besar/kecil dan
 * spasi diabaikan), bukan dari posisinya.
 */
export async function readFormulaWorkbook(
  data: ArrayBuffer,
): Promise<{ row: number; values: Record<string, unknown> }[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);
  const ws =
    wb.worksheets.find((w) => w.name.trim().toLowerCase() === "formula") ??
    wb.worksheets[0];
  if (!ws) throw new Error("Berkasnya tidak punya lembar sama sekali.");

  const headers = new Map<number, string>();
  ws.getRow(1).eachCell((cell, col) => {
    const key = String(plain(cell.value) ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
    if (key) headers.set(col, key);
  });
  if (![...headers.values()].includes("bahan")) {
    throw new Error(
      'Kolom "bahan" tidak ditemukan di baris pertama. Pakai template dari aplikasi tanpa mengubah judul kolomnya.',
    );
  }

  const out: { row: number; values: Record<string, unknown> }[] = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const values: Record<string, unknown> = {};
    for (const [col, key] of headers) values[key] = plain(row.getCell(col).value);
    out.push({ row: n, values });
  });
  return out;
}
