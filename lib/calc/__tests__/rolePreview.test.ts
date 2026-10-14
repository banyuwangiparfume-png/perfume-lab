import { describe, expect, it } from "vitest";
import { liftsOf, previewFacetShift } from "../roles";
import type { ExpandedItem, Material } from "../types";

const material = (
  id: string,
  facets: Record<string, number>,
  extra: Partial<Material> = {},
): Material =>
  ({
    id,
    name: id,
    facets,
    impact: 100,
    impactBasis: "as_sold",
    supplierDilutionPct: 100,
    isSolvent: false,
    ...extra,
  }) as unknown as Material;

const item = (refId: string, pct: number, tier: "top" | "mid" | "base" = "mid") =>
  ({
    kind: "material",
    refId,
    tier,
    role: "ingredient",
    productPct: pct,
    activePct: pct,
    strengthBasisPct: pct,
    via: [],
    sourceLineId: refId,
  }) as ExpandedItem;

describe("pratinjau sebelum → sesudah", () => {
  const materials = new Map([
    ["floral", material("floral", { floral: 1 })],
    ["kayu", material("kayu", { woody: 1 })],
    ["hedione", material("hedione", { floral: 0.8, citrus: 0.6 })],
  ]);
  const items = [item("floral", 50), item("kayu", 50, "base")];

  it("menambah bahan searah menaikkan porsi facet itu", () => {
    const p = previewFacetShift(items, materials, materials.get("hedione")!, 10, "mid", "floral");
    expect(p.beforePct).toBeCloseTo(50, 6);
    expect(p.afterPct).toBeGreaterThan(p.beforePct);
  });

  it("angkanya persis pie seandainya bahan itu benar-benar ditambahkan", () => {
    // floral 50 + hedione 10 × (0,8/1,4) = 55,71…; total 110.
    const p = previewFacetShift(items, materials, materials.get("hedione")!, 10, "mid", "floral");
    expect(p.afterPct).toBeCloseTo(((50 + (10 * 0.8) / 1.4) / 110) * 100, 6);
  });

  it("dilusi supplier ikut dihitung, sama seperti expand()", () => {
    const encer = material("encer", { floral: 1 }, {
      supplierDilutionPct: 10,
      impactBasis: "active",
    });
    const pekat = material("pekat", { floral: 1 });
    const m = new Map([...materials, ["encer", encer], ["pekat", pekat]]);
    const a = previewFacetShift(items, m, encer, 10, "mid", "floral");
    const b = previewFacetShift(items, m, pekat, 1, "mid", "floral");
    expect(a.afterPct).toBeCloseTo(b.afterPct, 6);
  });

  it("tidak mengubah daftar item aslinya", () => {
    const copy = [...items];
    previewFacetShift(items, materials, materials.get("hedione")!, 10, "mid", "floral");
    expect(items).toEqual(copy);
  });
});

describe("searah dengan", () => {
  it("mengurutkan dari yang paling mirip dan membuang yang di bawah ambang", () => {
    const m = new Map([
      ["a", material("a", { floral: 1 })],
      ["b", material("b", { floral: 0.6, woody: 0.8 })],
      ["c", material("c", { woody: 1 })],
      ["x", material("x", { floral: 1 })],
    ]);
    const lifts = liftsOf(m.get("x")!, [item("a", 10), item("b", 10), item("c", 10)], m, "all");
    expect(lifts.map((l) => l.refId)).toEqual(["a", "b"]);
  });

  it("menghormati scope tier", () => {
    const m = new Map([
      ["a", material("a", { floral: 1 })],
      ["x", material("x", { floral: 1 })],
    ]);
    expect(liftsOf(m.get("x")!, [item("a", 10, "base")], m, "top")).toEqual([]);
    expect(liftsOf(m.get("x")!, [item("a", 10, "base")], m, "base")).toHaveLength(1);
  });
});
