import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { TEMPLATE_COLUMNS } from "../formulaImport";
import { buildFormulaTemplate, readFormulaWorkbook } from "../formulaWorkbook";

/** Mengisi baris tertentu per nama kolom — seperti AI mengisi dari baris 2. */
const fill = (ws: ExcelJS.Worksheet, n: number, values: Record<string, unknown>) => {
  const row = ws.getRow(n);
  for (const [k, v] of Object.entries(values)) row.getCell(k).value = v as ExcelJS.CellValue;
  row.commit();
};

const toBuffer = async (wb: ExcelJS.Workbook) =>
  (await wb.xlsx.writeBuffer()) as ArrayBuffer;

describe("template formula", () => {
  it("punya lembar Formula dan Petunjuk, tanpa daftar bahan sendiri", () => {
    const wb = buildFormulaTemplate();
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Formula", "Petunjuk"]);
  });

  it("setiap kolom dijelaskan di Petunjuk", () => {
    const help = buildFormulaTemplate().getWorksheet("Petunjuk")!;
    const documented = new Set<unknown>();
    help.eachRow((r) => documented.add(r.getCell(1).value));
    for (const c of TEMPLATE_COLUMNS) expect(documented.has(c)).toBe(true);
  });
});

describe("membaca berkas yang sudah diisi", () => {
  it("template yang diisi terbaca balik per kolom", async () => {
    const wb = buildFormulaTemplate();
    const ws = wb.getWorksheet("Formula")!;
    fill(ws, 2, { tier: "top", bahan: "Bergamot", persen: 15 });
    fill(ws, 3, { tier: "mid", bahan: "Hedione", persen: "25,5%", dilusi_pct: 10, pelarut: "TEC" });
    const rows = await readFormulaWorkbook(await toBuffer(wb));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ row: 2, values: expect.objectContaining({ tier: "top", bahan: "Bergamot", persen: 15 }) });
    expect(rows[1].values).toMatchObject({ persen: "25,5%", dilusi_pct: 10, pelarut: "TEC" });
  });

  it("kolom dikenali dari judulnya, bukan posisinya, dan lembar dengan nama lain tetap terbaca", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Sheet1");
    ws.addRow(["Persen", "Bahan", "Tier"]);
    ws.addRow([10, "Bergamot", "top"]);
    const rows = await readFormulaWorkbook(await toBuffer(wb));
    expect(rows[0].values).toMatchObject({ persen: 10, bahan: "Bergamot", tier: "top" });
  });

  it("hasil rumus dibaca sebagai nilainya", async () => {
    const wb = buildFormulaTemplate();
    const ws = wb.getWorksheet("Formula")!;
    fill(ws, 2, { tier: "top", bahan: "Bergamot" });
    ws.getCell("D2").value = { formula: "10+5", result: 15 };
    const rows = await readFormulaWorkbook(await toBuffer(wb));
    expect(rows[0].values.persen).toBe(15);
  });

  it("berkas tanpa kolom bahan ditolak dengan pesan yang jelas", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("x").addRow(["nama", "jumlah"]);
    await expect(readFormulaWorkbook(await toBuffer(wb))).rejects.toThrow(/Kolom "bahan"/);
  });
});
