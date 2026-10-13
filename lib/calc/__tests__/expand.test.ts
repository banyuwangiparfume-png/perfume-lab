import { describe, expect, it } from "vitest";
import { analyze } from "../analyze";
import { expand, ExpandError, mergeByMaterial } from "../expand";
import { parseSupplierDilution } from "../supplierDilution";
import { pricePerUnit } from "../price";
import { DEFAULT_SETTINGS } from "../../settings";
import type {
  FormulaContext,
  Line,
  Material,
  Version,
} from "../types";

const material = (
  id: string,
  over: Partial<Material> = {},
): Material => ({
  id,
  name: id,
  category: "Aromachemical",
  impact: 100,
  impactBasis: "as_sold",
  supplierDilutionPct: 100,
  supplierSolventId: null,
  facets: { woody: 1 },
  functionCategory: null,
  noteTierHint: null,
  isBridgeCandidate: false,
  isSolvent: false,
  prices: { 10: 10000 },
  ...over,
});

let seq = 0;
const line = (refId: string, pct: number, over: Partial<Line> = {}): Line => ({
  id: `l${++seq}`,
  tier: "all",
  kind: "raw_material",
  refId,
  pct,
  locked: true,
  userDilutionPct: 100,
  userSolventId: null,
  ...over,
});

const version = (lines: Line[], id = "v-root"): Version => ({
  id,
  name: id,
  batchG: 10,
  pyramid: null,
  priceTierOverride: null,
  lines,
});

const context = (
  v: Version,
  materials: Material[],
  accords: Version[] = [],
): FormulaContext => ({
  version: v,
  materials: new Map(materials.map((m) => [m.id, m])),
  accords: new Map(accords.map((a) => [a.id, a])),
  fos: new Map(),
  bridgeRules: [],
  stock: new Set(),
  settings: DEFAULT_SETTINGS,
});

describe("parseSupplierDilution — semua contoh di PRD §4.3", () => {
  it.each([
    ["1-Octen 3-One 1-TEC", 1, "TEC"],
    ["2-Methoxy 3-Isobutyl Pyrazine 0,04 TEC", 0.04, "TEC"],
    ["Indole 50 BB", 50, "BB"],
    ["Benzoin 50-etha", 50, "ETHA"],
    ["Galbanum Resin 50 - etha", 50, "ETHA"],
    ["Oud Resin 5 TEC Etha", 5, "TEC"],
    ["Aldehyde C-12 MNA 10-TEC", 10, "TEC"],
  ])("%s -> %s%% dalam %s", (name, pct, token) => {
    expect(parseSupplierDilution(name)).toEqual({
      pct,
      solventToken: token,
    });
  });

  it("nama tanpa dilusi menghasilkan null", () => {
    expect(parseSupplierDilution("Bergamot Oil Italy FCF")).toBeNull();
    expect(parseSupplierDilution("Hedione")).toBeNull();
  });

  it("angka di luar 0–100 ditolak", () => {
    expect(parseSupplierDilution("Sesuatu 150 BB")).toBeNull();
  });
});

describe("dilusi user dipecah jadi bahan + pelarut", () => {
  const bb = material("BB", { isSolvent: true, impact: 18 });
  const amb = material("Ambroxan", { impact: 400 });

  it("5% @10% jadi 0,5% bahan + 4,5% pelarut", () => {
    const ctx = context(
      version([line("Ambroxan", 5, { userDilutionPct: 10, userSolventId: "BB" })]),
      [amb, bb],
    );
    const items = expand(ctx);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ role: "ingredient", productPct: 0.5 });
    expect(items[1]).toMatchObject({ role: "user_solvent", productPct: 4.5 });
  });
});

describe("dilusi supplier dicatat tapi tidak dipecah", () => {
  it("Indole 50 BB: aktif separuh, pelarut bawaan tercatat", () => {
    const indole = material("Indole", {
      supplierDilutionPct: 50,
      supplierSolventId: "BB",
      impact: 350,
    });
    const ctx = context(version([line("Indole", 5)]), [
      indole,
      material("BB", { isSolvent: true }),
    ]);
    const [item] = expand(ctx);
    expect(item.productPct).toBe(5);
    expect(item.activePct).toBe(2.5);
    expect(item.hiddenSolvent).toEqual({ solventId: "BB", pct: 2.5 });
  });
});

describe("accord", () => {
  const a = material("A");
  const b = material("B");
  const accord = version(
    [line("A", 60), line("B", 40)],
    "accord-v1",
  );

  it("dibentangkan proporsional ke porsinya di formula induk", () => {
    const ctx = context(
      version([line("accord-v1", 10, { kind: "accord" })]),
      [a, b],
      [accord],
    );
    const items = expand(ctx);
    expect(items.map((i) => i.productPct)).toEqual([6, 4]);
    expect(items[0].via).toEqual(["accord-v1"]);
  });

  it("accord dua tingkat dibentangkan benar", () => {
    const inner = version([line("A", 50), line("B", 50)], "inner");
    const outer = version(
      [line("inner", 100, { kind: "accord" })],
      "outer",
    );
    const ctx = context(
      version([line("outer", 20, { kind: "accord" })]),
      [a, b],
      [inner, outer],
    );
    const items = expand(ctx);
    expect(items.map((i) => i.productPct)).toEqual([10, 10]);
    expect(items[0].via).toEqual(["outer", "inner"]);
  });

  it("bahan yang sama langsung DAN lewat accord dijumlahkan, R11 menyala", () => {
    const ctx = context(
      version([
        line("A", 20),
        line("accord-v1", 10, { kind: "accord" }),
      ]),
      [a, b],
      [accord],
    );
    const merged = mergeByMaterial(expand(ctx));
    expect(merged.get("A")!.productPct).toBeCloseTo(26, 10);

    const result = analyze(ctx, { skipBridges: true });
    const r11 = result.warnings.find((w) => w.code === "R11")!;
    expect(r11.message).toContain("A");
  });

  it("siklus ditolak dengan pesan yang menyebut nama formulanya", () => {
    const selfRef = version(
      [line("loop", 100, { kind: "accord" })],
      "loop",
    );
    const ctx = context(
      version([line("loop", 10, { kind: "accord" })]),
      [a],
      [selfRef],
    );
    expect(() => expand(ctx)).toThrow(ExpandError);
    try {
      expand(ctx);
    } catch (e) {
      expect((e as ExpandError).kind).toBe("cycle");
      expect((e as ExpandError).message).toContain("loop");
    }
  });

  it("kedalaman lebih dari 3 ditolak", () => {
    const l4 = version([line("A", 100)], "l4");
    const l3 = version([line("l4", 100, { kind: "accord" })], "l3");
    const l2 = version([line("l3", 100, { kind: "accord" })], "l2");
    const l1 = version([line("l2", 100, { kind: "accord" })], "l1");
    const ctx = context(
      version([line("l1", 100, { kind: "accord" })]),
      [a],
      [l1, l2, l3, l4],
    );
    expect(() => expand(ctx)).toThrow(/tingkat/);
  });

  it("analyze menangkap error accord tanpa melempar, dan menandai R12", () => {
    const selfRef = version([line("loop", 100, { kind: "accord" })], "loop");
    const ctx = context(
      version([line("loop", 10, { kind: "accord" })]),
      [a],
      [selfRef],
    );
    const result = analyze(ctx);
    expect(result.error).toContain("siklus");
    expect(result.warnings[0].code).toBe("R12");
    expect(result.warnings[0].level).toBe("critical");
  });
});

describe("FO", () => {
  it("dikeluarkan dari kekuatan dan pie, tapi coverage dilaporkan", () => {
    const ctx: FormulaContext = {
      ...context(
        version([line("A", 70), line("fo-1", 30, { kind: "fo" })]),
        [material("A")],
      ),
      fos: new Map([["fo-1", { id: "fo-1", name: "FO Tabbac", pricePerGram: 1000 }]]),
    };
    const result = analyze(ctx, { skipBridges: true });

    const foRow = result.strength.rows.find((r) => r.kind === "fo")!;
    expect(foRow.strengthPct).toBeNull();
    expect(result.coverage).toBeCloseTo(70, 6);
    expect(result.warnings.some((w) => w.code === "R9")).toBe(true);

    // tapi biayanya tetap terhitung
    expect(result.cost.rows.find((r) => r.name === "FO Tabbac")!.cost).toBeCloseTo(
      3 * 1000,
      6,
    );
  });
});

describe("bahan tanpa impact", () => {
  it("dihitung sebagai 100 dan ditandai, bukan diam-diam nol", () => {
    const ctx = context(
      version([line("A", 50), line("Kosong", 50)]),
      [material("A"), material("Kosong", { impact: null })],
    );
    const result = analyze(ctx, { skipBridges: true });

    expect(result.strength.missingImpact).toEqual(["Kosong"]);
    // impact 100 vs 100 -> porsinya sama besar, bukan nol
    expect(
      result.strength.rows.find((r) => r.name === "Kosong")!.strengthPct,
    ).toBeCloseTo(50, 6);
    expect(result.warnings.some((w) => w.code === "R6")).toBe(true);
  });

  it("pelarut tanpa impact dihitung nol — dia memang tidak berbau", () => {
    const ctx = context(
      version([line("A", 50), line("DPG", 50)]),
      [material("A"), material("DPG", { impact: null, isSolvent: true })],
    );
    const result = analyze(ctx, { skipBridges: true });
    expect(
      result.strength.rows.find((r) => r.name === "DPG")!.strengthPct,
    ).toBeCloseTo(0, 6);
    expect(result.strength.missingImpact).toEqual([]);
  });
});

describe("harga fallback", () => {
  const m = (prices: Record<number, number>) => material("X", { prices });

  it("tier yang diminta ada: dipakai langsung", () => {
    expect(pricePerUnit(m({ 10: 50000 }), 10)).toEqual({
      pricePerUnit: 5000,
      usedTier: 10,
      fallback: false,
    });
  });

  it("tier kosong: turun ke tier lebih kecil (harga/g lebih mahal)", () => {
    const pick = pricePerUnit(m({ 5: 30000, 100: 400000 }), 50);
    expect(pick.usedTier).toBe(5);
    expect(pick.fallback).toBe(true);
  });

  it("tidak ada yang lebih kecil: naik ke tier lebih besar", () => {
    const pick = pricePerUnit(m({ 100: 400000 }), 50);
    expect(pick.usedTier).toBe(100);
    expect(pick.fallback).toBe(true);
  });

  it("tanpa harga sama sekali: null, bukan nol", () => {
    expect(pricePerUnit(m({}), 10).pricePerUnit).toBeNull();
  });
});
