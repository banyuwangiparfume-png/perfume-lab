import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { analyze } from "../../calc/analyze";
import { fixtureContext } from "../../calc/__tests__/fixture";
import { matchFormulaRows } from "../../import/formulaImport";
import { readFormulaWorkbook } from "../../import/formulaWorkbook";
import { formulaXlsxBuffer, type FormulaExportInput } from "../formulaExport";

const ctx = fixtureContext();
const analysis = analyze(ctx);
const input = (includeCost: boolean): FormulaExportInput => ({
  name: "Uji",
  category: "fragrance",
  versionLabel: "v1",
  changeNote: null,
  batchG: ctx.version.batchG,
  pyramid: ctx.version.pyramid,
  analysis,
  meta: new Map(
    [...ctx.materials.values()].map((m) => [
      m.id,
      { cas: null, functionCategory: m.functionCategory, facets: m.facets },
    ]),
  ),
  includeCost,
  exportedAt: new Date("2026-10-24T00:00:00Z"),
});

const load = async (buf: ArrayBuffer) => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return wb;
};

describe("ekspor formula", () => {
  it("lembar HPP hanya ada kalau dicentang", async () => {
    const withCost = await load(await formulaXlsxBuffer(input(true)));
    const without = await load(await formulaXlsxBuffer(input(false)));
    expect(withCost.getWorksheet("HPP")).toBeDefined();
    expect(without.getWorksheet("HPP")).toBeUndefined();
    const text = (wb: ExcelJS.Workbook) => {
      const out: string[] = [];
      wb.getWorksheet("Ringkasan")!.eachRow((r) => out.push(String(r.getCell(1).value)));
      return out.join("|");
    };
    expect(text(without)).not.toMatch(/HPP|Per gram/);
  });

  it("satu baris per baris formula, persennya sama", async () => {
    const wb = await load(await formulaXlsxBuffer(input(false)));
    const ws = wb.getWorksheet("Formula")!;
    expect(ws.rowCount - 1).toBe(analysis.lines.rows.length);
    const total = analysis.lines.rows.reduce((s, r) => s + r.pct, 0);
    let sum = 0;
    ws.eachRow((r, n) => { if (n > 1) sum += Number(r.getCell(4).value); });
    expect(sum).toBeCloseTo(total, 6);
  });

  it("bisa diimpor balik — nama, persen, dan dilusinya cocok semua", async () => {
    const raw = await readFormulaWorkbook(await formulaXlsxBuffer(input(true)));
    const result = matchFormulaRows(
      raw,
      {
        entries: [...ctx.materials.values()].map((m) => ({
          id: m.id, kind: "raw_material" as const, name: m.name, tierHint: m.noteTierHint,
        })),
        solvents: [...ctx.materials.values()].filter((m) => m.isSolvent).map((m) => ({ id: m.id, name: m.name })),
      },
      { pyramid: ctx.version.pyramid != null },
    );
    const rawLines = analysis.lines.rows.filter((r) => r.kind === "raw_material");
    expect(result.importable).toBe(rawLines.length);
    expect(result.totalPct).toBeCloseTo(rawLines.reduce((s, r) => s + r.pct, 0), 6);
  });
});
