import { describe, expect, it } from "vitest";
import { analyze } from "../analyze";
import { previewFacetShift } from "../roles";
import { linesAfterAdd, withLines } from "../simulate";
import { makeCtx, mat } from "./ctxHelper";

const floralPie = (ctx: Parameters<typeof analyze>[0]) =>
  analyze(ctx).aroma.all.slices.find((s) => s.facet === "floral")?.pct ?? 0;

describe("pratinjau sebelum → sesudah", () => {
  const materials = [
    mat("floral", { facets: { floral: 1 } }),
    mat("kayu", { facets: { woody: 1 } }),
    mat("hedione", { facets: { floral: 0.8, citrus: 0.6 } }),
  ];

  it("menambah bahan searah menaikkan porsi facet itu", () => {
    const { ctx, items } = makeCtx(materials, [
      { refId: "floral", pct: 50 },
      { refId: "kayu", pct: 50, tier: "base" },
    ]);
    const p = previewFacetShift(ctx, items, ctx.materials.get("hedione")!, 10, "mid", "floral");
    expect(p.beforePct).toBeCloseTo(50, 6);
    expect(p.afterPct).toBeGreaterThan(p.beforePct);
  });

  it("baris terbuka di tier tujuan ikut dibagi ulang — sama persis dengan tombol + Tier", () => {
    // floral TERBUKA: menambah hedione 10% di Mid membuat floral turun ke 40%
    // supaya Mid tetap 50. Pratinjau lama (cuma menempel) melewatkan ini.
    const { ctx, items } = makeCtx(
      materials,
      [
        { refId: "floral", pct: 50, locked: false },
        { refId: "kayu", pct: 50, tier: "base" },
      ],
      { pyramid: { top: 0, mid: 50, base: 50 } },
    );
    const p = previewFacetShift(ctx, items, ctx.materials.get("hedione")!, 10, "mid", "floral");
    const real = floralPie(
      withLines(ctx, linesAfterAdd(ctx, { kind: "raw_material", refId: "hedione" }, "mid", 10)),
    );
    expect(p.afterPct).toBeCloseTo(real, 8);
    // floral murni digantikan sebagian oleh hedione yang cuma 57% floral
    expect(p.afterPct).toBeLessThan(p.beforePct);
  });

  it("dilusi supplier ikut dihitung, sama seperti expand()", () => {
    const encer = mat("encer", { facets: { floral: 1 }, supplierDilutionPct: 10, impactBasis: "active" });
    const pekat = mat("pekat", { facets: { floral: 1 } });
    const { ctx, items } = makeCtx([...materials, encer, pekat], [
      { refId: "floral", pct: 50 },
      { refId: "kayu", pct: 50, tier: "base" },
    ]);
    const a = previewFacetShift(ctx, items, encer, 10, "mid", "floral");
    const b = previewFacetShift(ctx, items, pekat, 1, "mid", "floral");
    expect(a.afterPct).toBeCloseTo(b.afterPct, 6);
  });

  it("tidak mengubah formula aslinya", () => {
    const { ctx, items } = makeCtx(materials, [{ refId: "floral", pct: 50, locked: false }]);
    const before = JSON.stringify(ctx.version.lines);
    previewFacetShift(ctx, items, ctx.materials.get("hedione")!, 10, "mid", "floral");
    expect(JSON.stringify(ctx.version.lines)).toBe(before);
  });
});
