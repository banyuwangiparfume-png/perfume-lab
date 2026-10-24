import { describe, expect, it } from "vitest";
import { editLinePct, removeLine, tierTarget } from "../allocate";
import { analyze } from "../analyze";
import { facetReducers } from "../reduce";
import type { FormulaContext, Line } from "../types";
import { fixtureContext } from "./fixture";

/** Terapkan aksi persis seperti store editor, lalu baca pie dari analyze(). */
function apply(ctx: FormulaContext, lineId: string, action: "half" | "remove") {
  const line = ctx.version.lines.find((l) => l.id === lineId)!;
  const tierLines = ctx.version.lines.filter((l) => l.tier === line.tier);
  const target = tierTarget(ctx.version.pyramid, line.tier);
  const next: Line[] =
    action === "remove"
      ? removeLine(tierLines, lineId, target)
      : editLinePct(tierLines, lineId, line.pct / 2, target);
  return {
    ...ctx,
    version: {
      ...ctx.version,
      lines: [...ctx.version.lines.filter((l) => l.tier !== line.tier), ...next],
    },
  };
}

const pieOf = (ctx: FormulaContext, facet: string, scope: "all" | "top" | "mid" | "base") =>
  analyze(ctx).aroma[scope].slices.find((s) => s.facet === facet)?.pct ?? 0;

describe("turunkan", () => {
  const ctx = fixtureContext();
  const facet = analyze(ctx).aroma.all.slices[0].facet;
  const r = facetReducers(ctx, facet);

  it("menemukan baris yang membawa irisan itu, diurut dari yang paling bertanggung jawab", () => {
    expect(r.lines.length).toBeGreaterThan(0);
    const resp = r.lines.map((l) => l.responsibility);
    expect([...resp].sort((a, b) => b - a)).toEqual(resp);
  });

  it("angka sebelum sama dengan pie sekarang", () => {
    expect(r.beforePct).toBeCloseTo(pieOf(ctx, facet, "all"), 8);
  });

  it("pratinjau sama persis dengan pie setelah aksinya benar-benar diterapkan — termasuk pembagian ulang tier", () => {
    for (const line of r.lines.slice(0, 3)) {
      for (const opt of line.options) {
        expect(opt.afterPct).toBeCloseTo(pieOf(apply(ctx, line.lineId, opt.action), facet, "all"), 8);
      }
    }
  });

  it("semua opsi menurunkan irisannya", () => {
    for (const line of r.lines) {
      expect(line.options.find((o) => o.action === "remove")!.afterPct).toBeLessThan(r.beforePct);
    }
  });

  it("pie satu tier hanya membaca baris di tier itu", () => {
    for (const t of ["top", "mid", "base"] as const) {
      const sl = analyze(ctx).aroma[t].slices[0];
      if (!sl) continue;
      const rt = facetReducers(ctx, sl.facet, t);
      for (const line of rt.lines) expect(line.tier).toBe(t);
      expect(rt.beforePct).toBeCloseTo(pieOf(ctx, sl.facet, t), 8);
    }
  });

  it("baris yang tidak membawa facet itu tidak disebut", () => {
    const none = facetReducers(ctx, "facet-yang-tidak-ada");
    expect(none.lines).toEqual([]);
  });
});
