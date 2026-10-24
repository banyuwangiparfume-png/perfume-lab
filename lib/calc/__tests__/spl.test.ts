import { describe, expect, it } from "vitest";
import { analyze } from "../analyze";
import { splScore } from "../spl";
import type { ExpandedItem, FormulaContext, Material } from "../types";
import { fixtureContext } from "./fixture";

const mat = (id: string, extra: Partial<Material> = {}): Material =>
  ({
    id,
    name: id,
    facets: { woody: 1 },
    impact: 100,
    impactBasis: "as_sold",
    supplierDilutionPct: 100,
    isSolvent: false,
    functionCategory: "modifier",
    functionSource: "supplier",
    noteTierHint: null,
    ...extra,
  }) as unknown as Material;

const item = (refId: string, pct: number, tier: ExpandedItem["tier"] = "mid"): ExpandedItem => ({
  kind: "material",
  refId,
  tier,
  role: "ingredient",
  productPct: pct,
  activePct: pct,
  strengthBasisPct: pct,
  via: [],
  sourceLineId: refId,
});

const ctxOf = (materials: Material[]) =>
  ({ materials: new Map(materials.map((m) => [m.id, m])) }) as unknown as FormulaContext;

const base = [
  mat("top1", { impact: 150 }),
  mat("mid1", { impact: 150 }),
  mat("base1", { impact: 100 }),
  mat("diff", { functionCategory: "diffuser", impact: 200 }),
  mat("fix", { functionCategory: "fixative", impact: 80 }),
  mat("tec", { isSolvent: true, impact: null }),
];

describe("SPL", () => {
  it("skor 0–10 untuk ketiganya", () => {
    const s = splScore(ctxOf(base), [item("top1", 20, "top"), item("mid1", 30), item("base1", 50, "base")]);
    for (const k of ["sillage", "projection", "longevity"] as const) {
      expect(s[k]).toBeGreaterThanOrEqual(0);
      expect(s[k]).toBeLessThanOrEqual(10);
    }
  });

  it("menambah diffuser menaikkan projection", () => {
    const ctx = ctxOf(base);
    const without = splScore(ctx, [item("mid1", 50), item("base1", 50, "base")]);
    const withDiff = splScore(ctx, [item("mid1", 40), item("diff", 10), item("base1", 50, "base")]);
    expect(withDiff.projection).toBeGreaterThan(without.projection);
  });

  it("menambah fixative di base menaikkan longevity", () => {
    const ctx = ctxOf(base);
    const without = splScore(ctx, [item("mid1", 60), item("base1", 40, "base")]);
    const withFix = splScore(ctx, [item("mid1", 40), item("base1", 40, "base"), item("fix", 20, "base")]);
    expect(withFix.longevity).toBeGreaterThan(without.longevity);
  });

  it("diffuser di Top tidak menyumbang sillage — dia sudah habis sebelum jejaknya terbentuk", () => {
    const ctx = ctxOf(base);
    const top = splScore(ctx, [item("diff", 10, "top"), item("mid1", 90)]);
    const late = splScore(ctx, [item("diff", 10, "base"), item("mid1", 90)]);
    expect(late.sillage).toBeGreaterThan(top.sillage);
    expect(late.projection).toBeCloseTo(top.projection, 6);
  });

  it("mengencerkan formula dengan pelarut menurunkan intensitas dan ketiga skor", () => {
    const ctx = ctxOf(base);
    const neat = splScore(ctx, [item("mid1", 50), item("base1", 50, "base")]);
    const diluted = splScore(ctx, [item("mid1", 25), item("base1", 25, "base"), item("tec", 50, "base")]);
    const intensity = (s: typeof neat) => s.factors.find((f) => f.key === "intensity")!.value;
    expect(intensity(diluted)).toBeLessThan(intensity(neat));
    expect(diluted.longevity).toBeLessThan(neat.longevity);
  });

  it("pelarut tidak dihitung sebagai base aktif", () => {
    const s = splScore(ctxOf(base), [item("base1", 20, "base"), item("tec", 30, "base")]);
    expect(s.factors.find((f) => f.key === "baseActive")!.value).toBe(20);
  });

  it("peran yang ditebak dilaporkan, bukan disembunyikan", () => {
    const guessed = mat("g", { functionCategory: "fixative", functionSource: "derived" });
    const s = splScore(ctxOf([guessed]), [item("g", 100, "base")]);
    expect(s.derivedRolePct).toBeCloseTo(100, 6);
    expect(s.notes.join(" ")).toMatch(/ditebak/);
  });

  it("formula kosong tidak error", () => {
    const s = splScore(ctxOf(base), []);
    expect(s.longevity).toBe(0);
  });

  it("ikut keluar dari analyze()", () => {
    const r = analyze(fixtureContext());
    expect(r.spl.longevity).toBeGreaterThan(0);
  });
});
