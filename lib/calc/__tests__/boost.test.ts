import { describe, expect, it } from "vitest";
import { analyze } from "../analyze";
import { facetBoosts } from "../boost";
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
    noteTierHint: "base",
    ...extra,
  }) as unknown as Material;

const item = (refId: string, pct: number): ExpandedItem => ({
  kind: "material",
  refId,
  tier: "mid",
  role: "ingredient",
  productPct: pct,
  activePct: pct,
  strengthBasisPct: pct,
  via: [],
  sourceLineId: refId,
});

const ctxOf = (materials: Material[], stock: string[] = []) =>
  ({
    materials: new Map(materials.map((m) => [m.id, m])),
    stock: new Set(stock),
    settings: undefined,
  }) as unknown as FormulaContext;

const formula = [mat("rose", { facets: { rose: 1 }, noteTierHint: "mid" }), mat("cedar", { facets: { woody: 0.8, smoky: 0.6 } })];
const items = [item("rose", 70), item("cedar", 30)];

describe("saran per irisan aroma", () => {
  it("dikelompokkan per peran, dan tiap saran menaikkan irisan yang diminta", () => {
    const ctx = ctxOf([
      ...formula,
      mat("woodMod", { facets: { woody: 1 } }),
      mat("woodDiff", { facets: { woody: 0.9, amber: 0.4 }, functionCategory: "diffuser" }),
      mat("woodFix", { facets: { woody: 0.7, amber: 0.7 }, functionCategory: "fixative" }),
    ]);
    const b = facetBoosts(ctx, items, ["woody"]).woody;
    expect(b.modifier.map((s) => s.materialId)).toEqual(["woodMod"]);
    expect(b.diffuser.map((s) => s.materialId)).toEqual(["woodDiff"]);
    expect(b.fixative.map((s) => s.materialId)).toEqual(["woodFix"]);
    for (const s of [...b.modifier, ...b.diffuser, ...b.fixative]) {
      expect(s.afterPct).toBeGreaterThan(s.beforePct);
    }
  });

  it("diurut dari kenaikan nyata, bukan kemiripan facet saja", () => {
    // pure tapi lemah vs kurang murni tapi kuat
    const ctx = ctxOf([
      ...formula,
      mat("weak", { facets: { woody: 1 }, impact: 20 }),
      mat("strong", { facets: { woody: 0.6, amber: 0.8 }, impact: 400 }),
    ]);
    const list = facetBoosts(ctx, items, ["woody"]).woody.modifier;
    expect(list[0].materialId).toBe("strong");
  });

  it("bahan yang tidak membawa facet itu tidak disarankan", () => {
    const ctx = ctxOf([...formula, mat("citrus", { facets: { citrus: 1 } })]);
    expect(facetBoosts(ctx, items, ["woody"]).woody.modifier).toEqual([]);
  });

  it("bahan yang sudah dipakai dan pelarut tidak disarankan", () => {
    const ctx = ctxOf([...formula, mat("tec", { facets: { woody: 1 }, isSolvent: true })]);
    const all = Object.values(facetBoosts(ctx, items, ["woody"]).woody).flat();
    expect(all.map((s) => s.materialId)).not.toContain("cedar");
    expect(all.map((s) => s.materialId)).not.toContain("tec");
  });

  it("fixative diarahkan ke Base", () => {
    const ctx = ctxOf([...formula, mat("fx", { facets: { woody: 1 }, functionCategory: "fixative", noteTierHint: "top" })]);
    expect(facetBoosts(ctx, items, ["woody"]).woody.fixative[0].tier).toBe("base");
  });

  it("filter stok berlaku", () => {
    const mats = [...formula, mat("a", { facets: { woody: 1 } }), mat("b", { facets: { woody: 1 } })];
    const list = facetBoosts(ctxOf(mats, ["b"]), items, ["woody"], { onlyStock: true }).woody.modifier;
    expect(list.map((s) => s.materialId)).toEqual(["b"]);
  });

  it("peran tebakan ditandai", () => {
    const ctx = ctxOf([...formula, mat("g", { facets: { woody: 1 }, functionSource: "derived" })]);
    expect(facetBoosts(ctx, items, ["woody"]).woody.modifier[0].guessedRole).toBe(true);
  });

  it("analyze() menghitungnya untuk irisan pie, dan melewatinya saat mengetik", () => {
    const c = fixtureContext();
    const full = analyze(c);
    expect(Object.keys(full.boosts.all).sort()).toEqual(full.aroma.all.slices.map((s) => s.facet).sort());
    for (const t of ["top", "mid", "base"] as const) {
      expect(Object.keys(full.boosts[t]).sort()).toEqual(full.aroma[t].slices.map((s) => s.facet).sort());
    }
    expect(analyze(c, { skipBridges: true }).boosts.all).toEqual({});
  });
});

describe("tingkatkan per tier", () => {
  it("hanya menyarankan bahan yang menguap di tier itu, dan mengukur pie tier itu", () => {
    const ctx = ctxOf([
      ...formula,
      mat("woodTop", { facets: { woody: 1 }, noteTierHint: "top" }),
      mat("woodMid", { facets: { woody: 1 }, noteTierHint: "mid" }),
    ]);
    const mid = facetBoosts(ctx, items, ["woody"], { scope: "mid" }).woody.modifier;
    expect(mid.map((s) => s.materialId)).toEqual(["woodMid"]);
    expect(mid[0].tier).toBe("mid");
  });

  it("fixative hanya muncul di Base", () => {
    const ctx = ctxOf([...formula, mat("fx", { facets: { woody: 1 }, functionCategory: "fixative" })]);
    expect(facetBoosts(ctx, items, ["woody"], { scope: "mid" }).woody.fixative).toEqual([]);
  });
});
