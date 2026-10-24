import { describe, expect, it } from "vitest";
import { analyze } from "../analyze";
import { phaseLever } from "../phaseAdjust";
import { linesAfterAdd, linesAfterEdit, linesAfterPyramid, withLines } from "../simulate";
import type { FormulaContext } from "../types";
import { makeCtx, mat } from "./ctxHelper";
import { fixtureContext } from "./fixture";

const tierPct = (ctx: FormulaContext, phase: string, tier: "top" | "mid" | "base") =>
  analyze(ctx).phases.phases.find((p) => p.key === phase)!.tiers[tier];

describe("atur porsi tier per fase", () => {
  const ctx = fixtureContext();

  it("angka sebelum sama dengan kartu fase", () => {
    const l = phaseLever(ctx, "opening", "base", "down");
    expect(l.beforePct).toBeCloseTo(tierPct(ctx, "opening", "base"), 8);
  });

  it("geser piramida: pratinjau sama persis dengan setelah targetnya diubah", () => {
    const l = phaseLever(ctx, "opening", "base", "down");
    expect(l.pyramidShifts!.length).toBeGreaterThan(0);
    for (const s of l.pyramidShifts!) {
      const applied = withLines(ctx, linesAfterPyramid(ctx, s.pyramid), s.pyramid);
      expect(s.afterPct).toBeCloseTo(tierPct(applied, "opening", "base"), 8);
      expect(s.afterPct).toBeLessThan(l.beforePct);
      expect(s.pyramid.top + s.pyramid.mid + s.pyramid.base).toBeCloseTo(100, 8);
    }
  });

  it("kurangi baris: pratinjau sama persis, dan diurut dari yang paling bertanggung jawab", () => {
    const l = phaseLever(ctx, "opening", "base", "down");
    expect(l.lines.length).toBeGreaterThan(0);
    const resp = l.lines.map((x) => x.responsibility);
    expect([...resp].sort((a, b) => b - a)).toEqual(resp);
    for (const line of l.lines.slice(0, 2)) {
      for (const o of line.options) {
        const applied = withLines(ctx, linesAfterEdit(ctx, line.lineId, o.newPct));
        expect(o.afterPct).toBeCloseTo(tierPct(applied, "opening", "base"), 8);
      }
    }
  });

  it("tambah bahan: pratinjau sama persis dengan tombol + Tier, dan semuanya menaikkan", () => {
    // Baris Top TERBUKA: bahan baru membuatnya ikut dibagi ulang, jadi Top
    // tetap 20% berat — yang naik cuma kekuatannya.
    const { ctx: c } = makeCtx(
      [
        mat("t1", { noteTierHint: "top", impact: 100 }),
        mat("m1", { noteTierHint: "mid", impact: 100 }),
        mat("b1", { noteTierHint: "base", impact: 100 }),
        mat("kuat", { noteTierHint: "top", impact: 900 }),
        mat("sedang", { noteTierHint: "top", impact: 300 }),
      ],
      [
        { refId: "t1", pct: 20, tier: "top", locked: false },
        { refId: "m1", pct: 30, tier: "mid" },
        { refId: "b1", pct: 50, tier: "base" },
      ],
      { pyramid: { top: 20, mid: 30, base: 50 } },
    );
    const l = phaseLever(c, "opening", "top", "up");
    expect(l.candidates.map((x) => x.materialId)).toEqual(["kuat", "sedang"]);
    for (const cand of l.candidates) {
      const applied = withLines(
        c,
        linesAfterAdd(c, { kind: "raw_material", refId: cand.materialId }, "top", cand.dose),
      );
      expect(cand.afterPct).toBeCloseTo(tierPct(applied, "opening", "top"), 8);
      expect(cand.afterPct).toBeGreaterThan(l.beforePct);
    }
  });

  it("tier yang tidak hadir di fase itu tidak diberi saran bahan", () => {
    expect(phaseLever(ctx, "drydown", "top", "up").candidates).toEqual([]);
  });

  it("kandidat hanya bahan yang menguap di tier itu", () => {
    const { ctx: c } = makeCtx(
      [
        mat("t", { noteTierHint: "top" }),
        mat("b", { noteTierHint: "base" }),
        mat("kuatTop", { noteTierHint: "top", impact: 900 }),
        mat("kuatBase", { noteTierHint: "base", impact: 900 }),
      ],
      [
        { refId: "t", pct: 20, tier: "top" },
        { refId: "b", pct: 80, tier: "base" },
      ],
      { pyramid: { top: 20, mid: 0, base: 80 } },
    );
    const ids = phaseLever(c, "opening", "top", "up").candidates.map((x) => x.materialId);
    expect(ids).toContain("kuatTop");
    expect(ids).not.toContain("kuatBase");
  });

  it("tanpa piramida, tuas geser piramida tidak ditawarkan", () => {
    const { ctx: c } = makeCtx([mat("a", { noteTierHint: "top" })], [{ refId: "a", pct: 100, tier: "all" }]);
    expect(phaseLever(c, "opening", "top", "down").pyramidShifts).toBeNull();
  });
});

describe("efek ke aroma fase", () => {
  it("pergeseran aroma tiap opsi sama dengan profil fase setelah aksinya diterapkan", () => {
    const ctx = fixtureContext();
    const l = phaseLever(ctx, "opening", "base", "down");
    const opt = l.lines[0].options.find((o) => o.action === "remove")!;
    const applied = withLines(ctx, linesAfterEdit(ctx, l.lines[0].lineId, 0));
    const phase = analyze(applied).phases.phases.find((p) => p.key === "opening")!;
    for (const a of opt.aroma) {
      const real = phase.allFacets.find((f) => f.facet === a.facet)?.pct ?? 0;
      expect(a.after).toBeCloseTo(real, 8);
      expect(Math.abs(a.after - a.before)).toBeGreaterThanOrEqual(0.5);
    }
    expect(opt.aroma.length).toBeLessThanOrEqual(2);
  });
});
