import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
  STOCK_COLUMNS,
  currentPrices,
  formatFacets,
  stockXlsxBuffer,
  type StockExportRow,
} from "../stockExport";

const base: StockExportRow = {
  type: "bahan",
  name: "Hedione / Methyl Dihydrojasmonate",
  synonym: null,
  casNumber: "24851-98-7",
  family: "Floral",
  category: "Aromachemical",
  odourProfile: 'jasmine, "floral", citrus,\nfresh',
  functionCategory: "diffuser",
  functionSource: "supplier",
  impact: 65,
  impactNote: null,
  noteTier: "mid",
  facets: { floral: 0.8, citrus: 0.5 },
  supplierDilutionPct: 100,
  onHandG: 12.5,
  prices: { 10: 10300, 100: 75000 },
  pricePerGram: 1030,
  personalNote: null,
};

/** Tulis lalu baca balik — yang diuji adalah berkas yang benar-benar diunduh. */
async function roundTrip(rows: StockExportRow[]) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await stockXlsxBuffer(rows));
  const ws = wb.getWorksheet("Stok")!;
  const headers = (ws.getRow(1).values as unknown[]).slice(1);
  const cell = (row: number, key: string) =>
    ws.getRow(row).getCell(headers.indexOf(key) + 1).value;
  return { wb, ws, headers, cell };
}

describe("ekspor stok ke Excel", () => {
  it("header mengikuti daftar kolom", async () => {
    const { headers } = await roundTrip([base]);
    expect(headers).toEqual(STOCK_COLUMNS.map((c) => c.key));
  });

  it("teks berkoma, berkutip, dan berbaris baru terbaca balik utuh", async () => {
    const { cell } = await roundTrip([base]);
    expect(cell(2, "odour_profile")).toBe('jasmine, "floral", citrus,\nfresh');
  });

  it("angka disimpan sebagai angka, bukan teks", async () => {
    const { cell } = await roundTrip([base]);
    expect(cell(2, "odor_impact")).toBe(65);
    expect(cell(2, "price_10g")).toBe(10300);
    expect(cell(2, "on_hand_g")).toBe(12.5);
  });

  it("ukuran tanpa harga dan stok yang belum dicatat dibiarkan kosong", async () => {
    const { cell } = await roundTrip([{ ...base, onHandG: null }, { ...base, onHandG: 0 }]);
    expect(cell(2, "price_5g")).toBeNull();
    expect(cell(2, "on_hand_g")).toBeNull();
    // Habis bukan sama dengan belum dicatat.
    expect(cell(3, "on_hand_g")).toBe(0);
  });

  it("ada lembar Keterangan yang menjelaskan setiap kolom", async () => {
    const { wb } = await roundTrip([base]);
    const help = wb.getWorksheet("Keterangan")!;
    const documented = new Set<unknown>();
    help.eachRow((row) => documented.add(row.getCell(1).value));
    for (const c of STOCK_COLUMNS) expect(documented.has(c.key)).toBe(true);
  });

  it("stok kosong tetap menghasilkan berkas yang valid", async () => {
    const { ws } = await roundTrip([]);
    expect(ws.rowCount).toBe(1);
  });
});

describe("formatFacets", () => {
  it("diurut dari yang terkuat, dengan nama baca", () => {
    expect(formatFacets({ citrus: 0.5, white: 0.8 })).toBe("White floral 80; Citrus 50");
  });
});

describe("currentPrices", () => {
  it("memakai harga dengan tanggal berlaku paling baru per ukuran", () => {
    expect(
      currentPrices([
        { tier_size: 10, price_idr: 9000, effective_date: "2025-01-01" },
        { tier_size: 10, price_idr: 10300, effective_date: "2026-01-01" },
        { tier_size: 100, price_idr: 75000, effective_date: "2025-06-01" },
      ]),
    ).toEqual({ 10: 10300, 100: 75000 });
  });
});
